"""Train the LCNN classifier on the cleaned manifest and write the checkpoint + evaluation report.

    python prepare_dataset.py          # 1. build ../data/manifest.csv (cleaning, balancing, splits)
    python train.py                    # 2. extract features (cached), train, evaluate per language

The best epoch is chosen on the dev split; the test split is used once, at the end.
Wav2Vec2 is frozen, so its features are computed once and cached in --cache-dir; only the
LCNN is trained. The loss is weighted so every (language, label) group counts equally,
which stops the largest language from dominating training.

Metrics per language (test split): EER, accuracy at threshold 0.5, real-voice pass rate,
fake catch rate, each with a 95% confidence interval, plus sample and speaker counts.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
import argparse
import csv
import json
import random
import time
from collections import Counter, defaultdict
from datetime import datetime
from math import sqrt
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import roc_curve
from torch import nn

from app import config
from app.features import Wav2Vec2Embedder, extract
from app.inference import calibrate, pipeline_settings
from app.model import FakeAudioLCNN
from app.preprocess import AudioError, load_audio, preprocess, training_segment

SPLITS = ["train", "dev", "test"]
THRESHOLD = 0.5
# A language is "supported" when its test EER (upper 95% bound) is at most 10%, "experimental" up to 25%.
SUPPORT_RULE = {"supported": 0.10, "experimental": 0.25}
TEST_CONDITIONS = {
    "English": "ASVspoof 2019 LA evaluation set: unseen speakers and 13 voice-generation systems (A07-A19) never seen in training.",
    "_indic": "Unseen speakers (speaker-disjoint split). Same generator families as training (XTTS-v2, FreeVC from IndicSynth).",
}


def atomic_replace(tmp: Path, target: Path, attempts: int = 20):
    """os.replace with retries: on Windows, antivirus scanners briefly lock freshly written files."""
    for i in range(attempts):
        try:
            tmp.replace(target)
            return
        except PermissionError:
            if i == attempts - 1:
                raise
            time.sleep(0.5)


# ── data ────────────────────────────────────────────────────────────────────
def read_manifest(path: Path, data_root: Path, languages=None) -> list[dict]:
    items = []
    with path.open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if languages and r["lang"] not in languages:
                continue
            items.append({**r, "path": data_root / r["path"], "label": config.LABELS.index(r["label"])})
    return items


def load_features(items: list[dict], cache_dir: Path, embedder_holder: list, batch: int = 8):
    """Features for every item, computed once and cached as one .npz per file."""
    def cache_file(it):
        return cache_dir / f"{it['cache_key']}.npz"

    todo = [it for it in items if not cache_file(it).exists()]
    if todo:
        if not embedder_holder:
            print("Loading Wav2Vec2 (first run downloads ~360 MB from Hugging Face) ...")
            embedder_holder.append(Wav2Vec2Embedder())
        print(f"  extracting features for {len(todo)} files ...")
        t0 = time.time()
        for i in range(0, len(todo), batch):
            chunk = []
            for it in todo[i:i + batch]:
                try:
                    y, sr = load_audio(str(it["path"]))
                    chunk.append((it, training_segment(preprocess(y, sr))))
                except AudioError as exc:
                    print(f"  skipping {it['path'].name}: {exc}")
            if chunk:
                w2v, spec = extract(embedder_holder[0], [s for _, s in chunk])
                for (it, _), w, s in zip(chunk, w2v, spec):
                    out = cache_file(it)
                    out.parent.mkdir(parents=True, exist_ok=True)
                    tmp = out.with_suffix(".tmp.npz")             # rename when complete, so an interrupted
                    np.savez(tmp, w2v=w.astype(np.float16), spec=s.astype(np.float16))
                    tmp.replace(out)                              # run never leaves a broken cache file
            done = min(i + batch, len(todo))
            if done % 200 < batch or done == len(todo):
                rate = (time.time() - t0) / done
                print(f"  {done}/{len(todo)}  (~{rate * (len(todo) - done) / 60:.0f} min left)")

    kept = [it for it in items if cache_file(it).exists()]
    w2v, spec = [], []
    for it in kept:
        d = np.load(cache_file(it))
        w2v.append(d["w2v"]), spec.append(d["spec"])
    return {
        "w2v": torch.from_numpy(np.stack(w2v)),
        "spec": torch.from_numpy(np.stack(spec)),
        "labels": torch.tensor([it["label"] for it in kept]),
        "langs": np.array([it["lang"] for it in kept]),
        "attacks": np.array([it.get("attack", "") for it in kept]),
        "speakers": np.array([it.get("speaker", "") for it in kept]),
    }


# ── metrics ─────────────────────────────────────────────────────────────────
def compute_eer(labels: np.ndarray, spoof_scores: np.ndarray) -> float:
    fpr, tpr, _ = roc_curve(labels, spoof_scores, pos_label=1)
    fnr = 1 - tpr
    i = np.nanargmin(np.abs(fnr - fpr))
    return float((fpr[i] + fnr[i]) / 2)


def wilson(k: int, n: int, z: float = 1.96):
    """95% Wilson score interval for a proportion k/n."""
    if n == 0:
        return None
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, c - h), 4), round(min(1.0, c + h), 4)]


def eer_ci(y: np.ndarray, s: np.ndarray, rounds: int = 500, seed: int = 0):
    """95% bootstrap interval for the EER (resampling real and fake clips separately)."""
    rng = np.random.default_rng(seed)
    pos, neg = np.where(y == 1)[0], np.where(y == 0)[0]
    if len(pos) < 2 or len(neg) < 2:
        return None
    vals = []
    for _ in range(rounds):
        idx = np.concatenate([rng.choice(pos, len(pos)), rng.choice(neg, len(neg))])
        vals.append(compute_eer(y[idx], s[idx]))
    return [round(float(np.percentile(vals, 2.5)), 4), round(float(np.percentile(vals, 97.5)), 4)]


def summarise(y: np.ndarray, scores: np.ndarray, with_ci: bool = False) -> dict:
    pred = (scores >= THRESHOLD).astype(int)
    nb, ns = int((y == 0).sum()), int((y == 1).sum())
    bc, sc = int(((pred == 0) & (y == 0)).sum()), int(((pred == 1) & (y == 1)).sum())
    m = {
        "eer": compute_eer(y, scores) if nb and ns else None,
        "accuracy": float((pred == y).mean()) if len(y) else None,
        "bonafide_correct": bc, "bonafide_total": nb,
        "spoof_correct": sc, "spoof_total": ns,
    }
    if with_ci:
        m["eer_ci"] = eer_ci(y, scores) if nb and ns else None
        m["accuracy_ci"] = wilson(bc + sc, nb + ns)
        m["real_passed_ci"] = wilson(bc, nb)
        m["fake_caught_ci"] = wilson(sc, ns)
    return m


@torch.no_grad()
def scores_of(model, data, batch_size=64) -> np.ndarray:
    model.eval()
    out = []
    for i in range(0, len(data["labels"]), batch_size):
        logits = model(data["w2v"][i:i + batch_size].float(), data["spec"][i:i + batch_size].float())
        out.append(torch.softmax(logits, 1)[:, 1])
    return torch.cat(out).numpy()


def dev_threshold(model, dev) -> float:
    """Raw P(spoof) cut-off at the dev-set equal-error point, every language weighted equally."""
    s, y, langs = scores_of(model, dev), dev["labels"].numpy(), dev["langs"]
    count = Counter(langs)
    w = np.array([1.0 / count[l] for l in langs])
    fpr, tpr, thr = roc_curve(y, s, pos_label=1, sample_weight=w)
    i = np.nanargmin(np.abs((1 - tpr) - fpr))
    return float(min(max(thr[i], 1e-4), 1 - 1e-4))


def evaluate(model, data, with_ci: bool = False, threshold: float = THRESHOLD) -> dict:
    s = calibrate(scores_of(model, data), threshold)     # verdict flips at 0.5 after calibration
    y = data["labels"].numpy()
    langs, attacks = data["langs"], data["attacks"]
    result = summarise(y, s, with_ci)
    result["by_language"] = {}
    for lang in sorted(set(langs)):
        m = langs == lang
        r = summarise(y[m], s[m], with_ci)
        r["speakers"] = int(len(set(data["speakers"][m])))
        r["by_attack"] = {str(a): summarise(y[m & (attacks == a)], s[m & (attacks == a)])
                          for a in sorted(set(attacks[m & (y == 1)])) if a}
        result["by_language"][lang] = r
    eers = [r["eer"] for r in result["by_language"].values() if r["eer"] is not None]
    accs = [r["accuracy"] for r in result["by_language"].values() if r["accuracy"] is not None]
    result["macro_eer"] = float(np.mean(eers)) if eers else None
    result["macro_accuracy"] = float(np.mean(accs)) if accs else None
    result["by_attack"] = {str(a): summarise(y[attacks == a], s[attacks == a])   # kept for older UIs
                           for a in sorted(set(attacks[y == 1])) if a}
    return result


def fmt(m):
    eer = "  n/a " if m["eer"] is None else f"{m['eer'] * 100:5.2f}%"
    return (f"EER {eer}  acc {m['accuracy'] * 100:5.1f}%  "
            f"(real {m['bonafide_correct']}/{m['bonafide_total']}, fake {m['spoof_correct']}/{m['spoof_total']})")


def support_status(m: dict) -> str:
    if not m or m.get("eer") is None:
        return "not supported"
    upper = (m.get("eer_ci") or [m["eer"], m["eer"]])[1]
    if upper <= SUPPORT_RULE["supported"]:
        return "supported"
    if m["eer"] <= SUPPORT_RULE["experimental"]:
        return "experimental"
    return "not supported"


def build_report(model, metrics: dict, train_counts: dict, training: dict, dataset_report: dict | None,
                 threshold: float = THRESHOLD) -> dict:
    test = metrics.get("test", {})
    languages = {}
    for lang, m in test.get("by_language", {}).items():
        languages[lang] = {
            "status": support_status(m),
            "test": m,
            "dev": metrics.get("dev", {}).get("by_language", {}).get(lang),
            "train": train_counts.get(lang),
            "test_condition": TEST_CONDITIONS.get(lang, TEST_CONDITIONS["_indic"]),
        }
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "model": {
            "name": "Wav2Vec2 (wav2vec2-base, frozen) + LCNN",
            "frontend": f"{config.W2V_MODEL_NAME}, transformer layer {config.W2V_LAYER}, frozen (768 values / 20 ms)",
            "spectral_features": f"{config.N_MELS} log-mel + {config.N_MFCC} MFCC per 20 ms (Librosa)",
            "classifier": "Light CNN with Max-Feature-Map, 2 classes",
            "arch": model.arch,
            "trainable_parameters": int(sum(p.numel() for p in model.parameters())),
            "segment_seconds": config.SEGMENT_SECONDS,
            "threshold": 0.5,
            "raw_threshold": round(threshold, 4),
            "calibration": "Raw P(spoof) is re-mapped so the dev-set equal-error point (languages weighted equally) sits at 0.5.",
        },
        "training": training,
        "metric_definitions": {
            "eer": "Equal error rate: the operating point where the share of real voices flagged as fake equals the share of fakes passed as real. Lower is better; threshold-independent.",
            "accuracy": "Share of test clips classified correctly at the calibrated threshold (chosen on dev, never on test). Test sets are class-balanced.",
            "real_passed": "Share of real voices classified as real.",
            "fake_caught": "Share of AI-generated voices classified as AI-generated.",
            "ci": "95% intervals: bootstrap (500 resamples) for EER, Wilson score for proportions.",
            "support_rule": "supported: upper 95% bound of test EER <= 10%; experimental: test EER <= 25%; otherwise not supported.",
        },
        "overall": {k: test.get(k) for k in ("eer", "accuracy", "macro_eer", "macro_accuracy",
                                             "bonafide_correct", "bonafide_total", "spoof_correct", "spoof_total")},
        "languages": languages,
        "dataset": dataset_report,
    }


# ── training ────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-root", default="../data")
    ap.add_argument("--manifest", default="../data/manifest.csv")
    ap.add_argument("--cache-dir", default="../data/cache")
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--patience", type=int, default=3, help="stop after this many epochs without dev improvement")
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--languages", nargs="+", help="train on these languages only, e.g. --languages English")
    ap.add_argument("--extract-only", action="store_true", help="only compute and cache features")
    ap.add_argument("--proj-dim", type=int, default=64, help="Wav2Vec2 projection size (64 = fast, 128 = original)")
    ap.add_argument("--time-pool", type=int, default=2, help="average N 20 ms frames before the CNN (2 = fast, 1 = original)")
    args = ap.parse_args()

    random.seed(args.seed), np.random.seed(args.seed), torch.manual_seed(args.seed)
    root = Path(args.data_root)
    manifest = Path(args.manifest)
    if not manifest.exists():
        raise SystemExit(f"{manifest} not found. Run prepare_dataset.py first.")
    items = read_manifest(manifest, root, args.languages)
    dataset_report_path = root / "dataset_report.json"
    dataset_report = json.loads(dataset_report_path.read_text()) if dataset_report_path.exists() else None

    print("Clips per language and split (real / fake):")
    for lang in sorted({it["lang"] for it in items}):
        c = Counter((it["split"], it["label"]) for it in items if it["lang"] == lang)
        print(f"  {lang:10s} " + "  ".join(f"{s}: {c[(s, 0)]}/{c[(s, 1)]}" for s in SPLITS))

    embedder, data = [], {}
    for split in SPLITS:
        split_items = [it for it in items if it["split"] == split]
        if split_items:
            print(f"[{split}] {len(split_items)} clips")
            data[split] = load_features(split_items, Path(args.cache_dir), embedder)
    del embedder
    if args.extract_only:
        print("Features cached. Run train.py again without --extract-only to train.")
        return
    if "train" not in data or "dev" not in data:
        raise SystemExit("Need train and dev clips.")

    train = data["train"]
    y_train = train["labels"]
    groups = [f"{l}|{int(c)}" for l, c in zip(train["langs"], y_train)]
    gcount = Counter(groups)
    weights = torch.tensor([len(groups) / (len(gcount) * gcount[g]) for g in groups], dtype=torch.float32)
    train_counts = defaultdict(dict)
    for g, n in gcount.items():
        lang, c = g.split("|")
        train_counts[lang][config.LABELS[int(c)]] = n

    model = FakeAudioLCNN(proj_dim=args.proj_dim, time_pool=args.time_pool)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss(reduction="none")
    best, best_state, best_epoch, stale = None, None, 0, 0
    langs = sorted(set(train["langs"]))
    history, t_start = [], time.time()

    def save(state, metrics, epoch, report=None, threshold=THRESHOLD):
        config.CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = config.CHECKPOINT_PATH.with_suffix(".tmp")
        torch.save({
            "state_dict": state, "arch": model.arch, "pipeline": pipeline_settings(), "metrics": metrics,
            "train_info": {
                "datasets": "; ".join(sorted({s for l in langs for s in (dataset_report or {}).get("languages", {}).get(l, {}).get("sources", [])})) or "see report",
                "languages": langs, "train_bonafide": int((y_train == 0).sum()), "train_spoof": int((y_train == 1).sum()),
                "best_epoch": epoch,
            },
            "report": report, "threshold": threshold,
            "trained_at": datetime.now().isoformat(timespec="seconds"),
        }, tmp)
        atomic_replace(tmp, config.CHECKPOINT_PATH)   # atomic, so the API never loads a half-written file

    for epoch in range(1, args.epochs + 1):
        model.train()
        t0, total = time.time(), 0.0
        perm = torch.randperm(len(y_train))
        for i in range(0, len(perm), args.batch_size):
            idx = perm[i:i + args.batch_size]
            if len(idx) < 2:
                continue
            logits = model(train["w2v"][idx].float(), train["spec"][idx].float())
            loss = (loss_fn(logits, y_train[idx]) * weights[idx]).sum() / weights[idx].sum()
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
        dev = evaluate(model, data["dev"])
        history.append({"epoch": epoch, "loss": total / len(perm), "dev_eer": dev["eer"], "dev_macro_eer": dev["macro_eer"],
                        "seconds": round(time.time() - t0)})
        per_lang = "  ".join(f"{l[:3]} {m['eer'] * 100:4.1f}" for l, m in dev["by_language"].items() if m["eer"] is not None)
        print(f"epoch {epoch:2d}  loss {total / len(perm):.4f}  dev macro-EER {dev['macro_eer'] * 100:5.2f}%  [{per_lang}]  [{time.time() - t0:.0f} s]")
        if best is None or dev["macro_eer"] < best["macro_eer"]:        # model selection: mean EER over languages
            best, best_epoch, stale = dev, epoch, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            save(best_state, {"dev": best}, epoch)                     # usable model even if stopped early
        else:
            stale += 1
            if stale >= args.patience:
                print("Dev EER stopped improving - early stop.")
                break

    model.load_state_dict(best_state)
    threshold = dev_threshold(model, data["dev"])
    print(f"Calibrated threshold (dev equal-error point): raw P(spoof) >= {threshold:.4f}")
    metrics = {"dev": evaluate(model, data["dev"], with_ci=True, threshold=threshold)}
    print(f"\nBest epoch {best_epoch}: dev {fmt(metrics['dev'])}")
    if "test" in data:
        metrics["test"] = evaluate(model, data["test"], with_ci=True, threshold=threshold)
        print(f"Test: {fmt(metrics['test'])}")
        for lang, m in metrics["test"]["by_language"].items():
            print(f"  {lang:10s} {fmt(m)}  EER 95% CI {m['eer_ci']}  -> {support_status(m)}")
    training = {"epochs_run": len(history), "best_epoch": best_epoch, "max_epochs": args.epochs, "patience": args.patience,
                "batch_size": args.batch_size, "learning_rate": args.lr, "optimizer": "AdamW (weight decay 1e-4)",
                "balancing": "loss weighted so every (language, label) group counts equally",
                "model_selection": "lowest mean dev EER across languages",
                "seconds": round(time.time() - t_start), "history": history,
                "train_counts": dict(train_counts), "device": "CPU"}
    report = build_report(model, metrics, dict(train_counts), training, dataset_report, threshold)
    save(best_state, metrics, best_epoch, report, threshold)
    Path(config.CHECKPOINT_PATH.with_name("report.json")).write_text(json.dumps(report, indent=2))
    print(f"Saved checkpoint and report to {config.CHECKPOINT_PATH.parent}")


if __name__ == "__main__":
    main()
