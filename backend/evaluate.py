"""Score the saved checkpoint on the test split and store the result in the checkpoint.

    python evaluate.py --languages English

Use this when training was stopped before it finished (train.py saves the best model
after every improving epoch, but only measures the test split at the very end).
The test split is never used to choose the model, so this is an honest final number.
Features must already be cached (train.py caches them).
"""
import argparse
from pathlib import Path

import torch

from app import config
from app.model import FakeAudioLCNN
from train import asvspoof_items, evaluate, fmt, indic_items, load_features


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--asvspoof-root", default="../data/LA")
    ap.add_argument("--indic-root", default="../data/indic")
    ap.add_argument("--cache-dir", default="../data/cache")
    ap.add_argument("--languages", nargs="+", help="defaults to the languages the model was trained on")
    args = ap.parse_args()

    ckpt = torch.load(config.CHECKPOINT_PATH, map_location="cpu", weights_only=False)
    langs = args.languages or ckpt["train_info"]["languages"]
    items = [it for it in asvspoof_items(Path(args.asvspoof_root)) + indic_items(Path(args.indic_root))
             if it["split"] == "test" and it["lang"] in langs]
    if not items:
        raise SystemExit("No test clips found for " + ", ".join(langs))

    model = FakeAudioLCNN()
    model.load_state_dict(ckpt["state_dict"])
    test = evaluate(model, load_features(items, Path(args.cache_dir), []))

    print(f"Checkpoint from epoch {ckpt['train_info']['best_epoch']}, dev {fmt(ckpt['metrics']['dev'])}")
    print(f"Test: {fmt(test)}")
    for lang, m in test["by_language"].items():
        print(f"  {lang:10s} {fmt(m)}")

    ckpt["metrics"]["test"] = test
    tmp = config.CHECKPOINT_PATH.with_suffix(".tmp")
    torch.save(ckpt, tmp)
    tmp.replace(config.CHECKPOINT_PATH)
    print(f"Test results saved into {config.CHECKPOINT_PATH}")


if __name__ == "__main__":
    main()
