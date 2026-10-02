"""Train the LCNN classifier on ASVspoof 2019 LA and save the checkpoint the API loads.

    python train.py --data-root ../data/LA

Uses every FLAC file present under the ASVspoof LA folder layout (the full LA.zip or
the subset from fetch_asvspoof_subset.py):
  train split -> training, dev split -> model selection, eval split -> final test
(the eval split contains attack types A07-A19 that are never seen in training).

Wav2Vec2 is frozen, so its features are computed once and cached in --cache-dir;
only the LCNN is trained. Reported metric: Equal Error Rate (EER), as in the PPT.
"""
import argparse
import random
import time
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

PROTOCOLS = {
    "train": "ASVspoof2019.LA.cm.train.trn.txt",
    "dev": "ASVspoof2019.LA.cm.dev.trl.txt",
    "eval": "ASVspoof2019.LA.cm.eval.trl.txt",
}


def list_split(root: Path, split: str):
    """(flac_path, label, attack) for protocol entries whose file exists on disk."""
    proto = root / "ASVspoof2019_LA_cm_protocols" / PROTOCOLS[split]
    if not proto.exists():
        return []
    flac_dir = root / f"ASVspoof2019_LA_{split}" / "flac"
    items = []
    for line in proto.read_text().splitlines():
        parts = line.split()
        if len(parts) != 5:
            continue
        path = flac_dir / f"{parts[1]}.flac"
        if path.exists():
            items.append((path, config.LABELS.index(parts[4]), parts[3]))
    return items


def load_features(items, split: str, cache_dir: Path, embedder_holder: list, batch: int = 8):
    """Features for every file, computed once and cached as one .npz per file."""
    out_dir = cache_dir / split
    out_dir.mkdir(parents=True, exist_ok=True)
    todo = [(p, l) for p, l, _ in items if not (out_dir / f"{p.stem}.npz").exists()]
    if todo:
        if not embedder_holder:
            print("Loading Wav2Vec2 (first run downloads ~360 MB from Hugging Face) ...")
            embedder_holder.append(Wav2Vec2Embedder())
        print(f"[{split}] extracting features for {len(todo)} files ...")
        t0 = time.time()
        for i in range(0, len(todo), batch):
            chunk = []
            for path, _ in todo[i:i + batch]:
                try:
                    y, sr = load_audio(str(path))
                    chunk.append((path, training_segment(preprocess(y, sr))))
                except AudioError as exc:
                    print(f"  skipping {path.name}: {exc}")
            if not chunk:
                continue
            w2v, spec = extract(embedder_holder[0], [s for _, s in chunk])
            for (path, _), w, s in zip(chunk, w2v, spec):
                tmp = out_dir / f"{path.stem}.tmp.npz"     # rename when complete, so an interrupted
                np.savez(tmp, w2v=w.astype(np.float16), spec=s.astype(np.float16))
                tmp.replace(out_dir / f"{path.stem}.npz")  # run never leaves a broken cache file
            done = min(i + batch, len(todo))
            if done % 200 < batch or done == len(todo):
                rate = (time.time() - t0) / done
                print(f"  {done}/{len(todo)}  (~{rate * (len(todo) - done) / 60:.0f} min left)")

    w2v, spec, labels = [], [], []
    for path, label, _ in items:
        f = out_dir / f"{path.stem}.npz"
        if f.exists():
            d = np.load(f)
            w2v.append(d["w2v"]), spec.append(d["spec"]), labels.append(label)
    return torch.from_numpy(np.stack(w2v)), torch.from_numpy(np.stack(spec)), torch.tensor(labels)


def compute_eer(labels: np.ndarray, spoof_scores: np.ndarray) -> float:
    fpr, tpr, _ = roc_curve(labels, spoof_scores, pos_label=1)
    fnr = 1 - tpr
    i = np.nanargmin(np.abs(fnr - fpr))
    return float((fpr[i] + fnr[i]) / 2)


@torch.no_grad()
def evaluate(model, data, batch_size=64):
    model.eval()
    w2v, spec, labels = data
    scores = []
    for i in range(0, len(labels), batch_size):
        logits = model(w2v[i:i + batch_size].float(), spec[i:i + batch_size].float())
        scores.append(torch.softmax(logits, 1)[:, 1])
    scores = torch.cat(scores).numpy()
    y = labels.numpy()
    pred = (scores >= 0.5).astype(int)
    return {
        "eer": compute_eer(y, scores),
        "accuracy": float((pred == y).mean()),
        "bonafide_correct": int(((pred == 0) & (y == 0)).sum()), "bonafide_total": int((y == 0).sum()),
        "spoof_correct": int(((pred == 1) & (y == 1)).sum()), "spoof_total": int((y == 1).sum()),
    }


def fmt(m):
    return (f"EER {m['eer'] * 100:.2f}%  acc {m['accuracy'] * 100:.1f}%  "
            f"(real {m['bonafide_correct']}/{m['bonafide_total']}, fake {m['spoof_correct']}/{m['spoof_total']})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-root", default="../data/LA")
    ap.add_argument("--cache-dir", default="../data/cache")
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--patience", type=int, default=5, help="stop after this many epochs without dev improvement")
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    random.seed(args.seed), np.random.seed(args.seed), torch.manual_seed(args.seed)
    root, cache = Path(args.data_root), Path(args.cache_dir)

    if not list_split(root, "train") or not list_split(root, "dev"):
        raise SystemExit(f"No ASVspoof train/dev audio found under {root.resolve()}. "
                         "Run fetch_asvspoof_subset.py first.")
    embedder, data = [], {}
    for split in PROTOCOLS:                      # listed one by one, in order train -> dev -> eval
        items = list_split(root, split)
        if items:
            data[split] = load_features(items, split, cache, embedder)
    del embedder

    y_train = data["train"][2]
    counts = torch.bincount(y_train, minlength=2).float()
    print(f"Train: {int(counts[0])} bona-fide, {int(counts[1])} spoof | "
          f"dev: {len(data['dev'][2])} | eval: {len(data['eval'][2]) if 'eval' in data else 0}")

    model = FakeAudioLCNN()
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss(weight=counts.sum() / (2 * counts))   # balances the two classes
    best, best_state, best_epoch, stale = None, None, 0, 0

    for epoch in range(1, args.epochs + 1):
        model.train()
        t0, total = time.time(), 0.0
        perm = torch.randperm(len(y_train))
        for i in range(0, len(perm), args.batch_size):
            idx = perm[i:i + args.batch_size]
            if len(idx) < 2:
                continue
            logits = model(data["train"][0][idx].float(), data["train"][1][idx].float())
            loss = loss_fn(logits, y_train[idx])
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
        dev = evaluate(model, data["dev"])
        print(f"epoch {epoch:2d}  loss {total / len(perm):.4f}  dev {fmt(dev)}  [{time.time() - t0:.0f} s]")
        if best is None or dev["eer"] < best["eer"]:
            best, best_epoch, stale = dev, epoch, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            stale += 1
            if stale >= args.patience:
                print("Dev EER stopped improving - early stop.")
                break

    model.load_state_dict(best_state)
    metrics = {"dev": best}
    print(f"\nBest epoch {best_epoch}: dev {fmt(best)}")
    if "eval" in data:
        metrics["eval"] = evaluate(model, data["eval"])
        print(f"Eval (unseen attacks A07-A19): {fmt(metrics['eval'])}")

    config.CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        "state_dict": model.state_dict(),
        "pipeline": pipeline_settings(),
        "metrics": metrics,
        "train_info": {
            "dataset": "ASVspoof 2019 LA",
            "train_bonafide": int(counts[0]), "train_spoof": int(counts[1]),
            "best_epoch": best_epoch,
        },
        "trained_at": datetime.now().isoformat(timespec="seconds"),
    }, config.CHECKPOINT_PATH)
    print(f"Saved checkpoint to {config.CHECKPOINT_PATH}")


if __name__ == "__main__":
    main()
