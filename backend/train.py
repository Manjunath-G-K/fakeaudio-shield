"""Train the LCNN classifier and save the checkpoint the API loads.

    python train.py --asvspoof-root ../data/LA --indic-root ../data/indic

Training data (each source is used if present on disk):
  * English: ASVspoof 2019 LA (fetch_asvspoof_subset.py). train -> train, dev -> dev,
    eval -> test (the eval split has attack types A07-A19 never seen in training).
  * Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali: Kathbath (real) and
    IndicSynth (fake) clips from fetch_indic_subset.py, already split by speaker.

The best epoch is picked on the dev set; the test set is only used once at the end.
Wav2Vec2 is frozen, so its features are computed once and cached in --cache-dir; only the
LCNN is trained. Reported metric: Equal Error Rate (EER), overall and per language.
"""
import argparse
import csv
import random
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import roc_curve
from torch import nn

from app import config
from app.features import Wav2Vec2Embedder, extract
from app.inference import pipeline_settings
from app.model import FakeAudioLCNN
from app.preprocess import AudioError, load_audio, preprocess, training_segment

SPLITS = ["train", "dev", "test"]
ASVSPOOF_PROTOCOLS = {  # ASVspoof split -> (protocol file, our split)
    "train": ("ASVspoof2019.LA.cm.train.trn.txt", "train"),
    "dev": ("ASVspoof2019.LA.cm.dev.trl.txt", "dev"),
    "eval": ("ASVspoof2019.LA.cm.eval.trl.txt", "test"),
}


def asvspoof_items(root: Path) -> list[dict]:
    items = []
    for asv_split, (proto_name, split) in ASVSPOOF_PROTOCOLS.items():
        proto = root / "ASVspoof2019_LA_cm_protocols" / proto_name
        if not proto.exists():
            continue
        for line in proto.read_text().splitlines():
            parts = line.split()
            path = root / f"ASVspoof2019_LA_{asv_split}" / "flac" / f"{parts[1]}.flac" if len(parts) == 5 else None
            if path and path.exists():
                items.append({"path": path, "label": config.LABELS.index(parts[4]), "lang": "English",
                              "split": split, "cache_key": f"{asv_split}/{parts[1]}",
                              "attack": parts[3] if parts[3] != "-" else ""})
    return items


def indic_items(root: Path) -> list[dict]:
    items = []
    for kind in ("real", "fake"):
        manifest = root / f"manifest_{kind}.csv"
        if not manifest.exists():
            continue
        with manifest.open(newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                path = root / r["path"]
                if path.exists():
                    items.append({"path": path, "label": config.LABELS.index(r["label"]), "lang": r["lang"],
                                  "split": r["split"], "cache_key": f"indic/{Path(r['path']).with_suffix('')}",
                                  "attack": r.get("generator", "")})
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
        "attacks": np.array([it.get("attack", "") for it in kept]),   # spoofing system / generator
    }


def compute_eer(labels: np.ndarray, spoof_scores: np.ndarray) -> float:
    fpr, tpr, _ = roc_curve(labels, spoof_scores, pos_label=1)
    fnr = 1 - tpr
    i = np.nanargmin(np.abs(fnr - fpr))
    return float((fpr[i] + fnr[i]) / 2)


def summarise(y: np.ndarray, scores: np.ndarray) -> dict:
    pred = (scores >= 0.5).astype(int)
    return {
        "eer": compute_eer(y, scores) if len(set(y)) == 2 else None,
        "accuracy": float((pred == y).mean()),
        "bonafide_correct": int(((pred == 0) & (y == 0)).sum()), "bonafide_total": int((y == 0).sum()),
        "spoof_correct": int(((pred == 1) & (y == 1)).sum()), "spoof_total": int((y == 1).sum()),
    }


@torch.no_grad()
def evaluate(model, data, batch_size=64) -> dict:
    model.eval()
    scores = []
    for i in range(0, len(data["labels"]), batch_size):
        logits = model(data["w2v"][i:i + batch_size].float(), data["spec"][i:i + batch_size].float())
        scores.append(torch.softmax(logits, 1)[:, 1])
    scores = torch.cat(scores).numpy()
    y = data["labels"].numpy()
    result = summarise(y, scores)
    result["by_language"] = {lang: summarise(y[data["langs"] == lang], scores[data["langs"] == lang])
                             for lang in sorted(set(data["langs"]))}
    # fake-detection rate per spoofing system (ASVspoof attack ID or IndicSynth generator)
    attacks = data.get("attacks")
    if attacks is not None:
        result["by_attack"] = {str(a): summarise(y[attacks == a], scores[attacks == a])
                               for a in sorted(set(attacks[y == 1])) if a}
    return result


def fmt(m):
    eer = "  n/a " if m["eer"] is None else f"{m['eer'] * 100:5.2f}%"
    return (f"EER {eer}  acc {m['accuracy'] * 100:5.1f}%  "
            f"(real {m['bonafide_correct']}/{m['bonafide_total']}, fake {m['spoof_correct']}/{m['spoof_total']})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--asvspoof-root", default="../data/LA")
    ap.add_argument("--indic-root", default="../data/indic")
    ap.add_argument("--cache-dir", default="../data/cache")
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--patience", type=int, default=5, help="stop after this many epochs without dev improvement")
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--languages", nargs="+", help="train on these languages only, e.g. --languages English")
    ap.add_argument("--extract-only", action="store_true",
                    help="only compute and cache features (e.g. while downloads are still running)")
    args = ap.parse_args()

    random.seed(args.seed), np.random.seed(args.seed), torch.manual_seed(args.seed)
    items = asvspoof_items(Path(args.asvspoof_root)) + indic_items(Path(args.indic_root))
    if args.languages:
        items = [it for it in items if it["lang"] in args.languages]
    if not any(it["split"] == "train" for it in items) or not any(it["split"] == "dev" for it in items):
        raise SystemExit("No training data found. Run fetch_asvspoof_subset.py and/or fetch_indic_subset.py first.")

    print("Clips per language and split:")
    for lang in sorted({it["lang"] for it in items}):
        c = Counter((it["split"], it["label"]) for it in items if it["lang"] == lang)
        print(f"  {lang:10s} " + "  ".join(f"{s}: {c[(s, 0)]} real / {c[(s, 1)]} fake" for s in SPLITS))

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

    train = data["train"]
    counts = torch.bincount(train["labels"], minlength=2).float()
    model = FakeAudioLCNN()
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss(weight=counts.sum() / (2 * counts))   # balances the two classes
    best, best_state, best_epoch, stale = None, None, 0, 0
    langs = sorted(set(train["langs"]))
    datasets = (["ASVspoof 2019 LA (English)"] if "English" in langs else []) + \
               (["Kathbath + IndicSynth (Indian languages)"] if set(langs) - {"English"} else [])

    def save_checkpoint(state, metrics, epoch):
        config.CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = config.CHECKPOINT_PATH.with_suffix(".tmp")
        torch.save({
            "state_dict": state,
            "pipeline": pipeline_settings(),
            "metrics": metrics,
            "train_info": {
                "datasets": "; ".join(datasets),
                "languages": langs,
                "train_bonafide": int(counts[0]), "train_spoof": int(counts[1]),
                "best_epoch": epoch,
            },
            "trained_at": datetime.now().isoformat(timespec="seconds"),
        }, tmp)
        tmp.replace(config.CHECKPOINT_PATH)   # atomic, so the API never loads a half-written file

    for epoch in range(1, args.epochs + 1):
        model.train()
        t0, total = time.time(), 0.0
        perm = torch.randperm(len(train["labels"]))
        for i in range(0, len(perm), args.batch_size):
            idx = perm[i:i + args.batch_size]
            if len(idx) < 2:
                continue
            logits = model(train["w2v"][idx].float(), train["spec"][idx].float())
            loss = loss_fn(logits, train["labels"][idx])
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
        dev = evaluate(model, data["dev"])
        print(f"epoch {epoch:2d}  loss {total / len(perm):.4f}  dev {fmt(dev)}  [{time.time() - t0:.0f} s]")
        if best is None or dev["eer"] < best["eer"]:
            best, best_epoch, stale = dev, epoch, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            save_checkpoint(best_state, {"dev": best}, epoch)   # usable model even if stopped early
        else:
            stale += 1
            if stale >= args.patience:
                print("Dev EER stopped improving - early stop.")
                break

    model.load_state_dict(best_state)
    metrics = {"dev": best}
    print(f"\nBest epoch {best_epoch}: dev {fmt(best)}")
    if "test" in data:
        metrics["test"] = evaluate(model, data["test"])
        print(f"Test (unseen speakers; English: unseen attacks A07-A19): {fmt(metrics['test'])}")
        for lang, m in metrics["test"]["by_language"].items():
            print(f"  {lang:10s} {fmt(m)}")

    save_checkpoint(best_state, metrics, best_epoch)
    print(f"Saved checkpoint to {config.CHECKPOINT_PATH}")


if __name__ == "__main__":
    main()
