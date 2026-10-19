"""Measure a saved checkpoint on dev/test, calibrate its threshold, and store the full report in it.

    python evaluate.py
    python evaluate.py --checkpoint path/to/model.pt --training-json training.json

Use this when training was stopped before it finished, or to (re-)evaluate an existing
model on the current cleaned manifest. The threshold is chosen on the dev split (equal-error
point, languages weighted equally); the test split is never used to choose anything.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
import argparse
import json
from pathlib import Path

import torch

from app import config
from app.model import FakeAudioLCNN
from train import (atomic_replace, build_report, dev_threshold, evaluate, fmt, load_features,
                   read_manifest, support_status)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-root", default="../data")
    ap.add_argument("--manifest", default="../data/manifest.csv")
    ap.add_argument("--cache-dir", default="../data/cache")
    ap.add_argument("--checkpoint", default=str(config.CHECKPOINT_PATH))
    ap.add_argument("--training-json", help="JSON with training details to include in the report")
    args = ap.parse_args()

    path = Path(args.checkpoint)
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    langs = ckpt["train_info"]["languages"]
    items = read_manifest(Path(args.manifest), Path(args.data_root), langs)
    model = FakeAudioLCNN(**ckpt.get("arch", {"proj_dim": 128, "time_pool": 1}))
    model.load_state_dict(ckpt["state_dict"])

    data = {s: load_features([it for it in items if it["split"] == s], Path(args.cache_dir), [])
            for s in ("dev", "test") if any(it["split"] == s for it in items)}
    threshold = dev_threshold(model, data["dev"])
    print(f"Calibrated threshold (dev equal-error point): raw P(spoof) >= {threshold:.4f}")
    metrics = {s: evaluate(model, d, with_ci=True, threshold=threshold) for s, d in data.items()}
    for s, m in metrics.items():
        print(f"{s}: {fmt(m)}")
    for lang, m in metrics.get("test", {}).get("by_language", {}).items():
        print(f"  {lang:10s} {fmt(m)}  EER 95% CI {m['eer_ci']}  -> {support_status(m)}")

    dataset_report_path = Path(args.data_root) / "dataset_report.json"
    dataset_report = json.loads(dataset_report_path.read_text()) if dataset_report_path.exists() else None
    if args.training_json:
        training = json.loads(Path(args.training_json).read_text())
    else:
        training = (ckpt.get("report") or {}).get("training") or {"best_epoch": ckpt["train_info"].get("best_epoch")}
    ckpt.update(arch=model.arch, metrics=metrics, threshold=threshold,
                report=build_report(model, metrics, training.get("train_counts", {}), training, dataset_report, threshold))
    ckpt["train_info"]["best_epoch"] = training.get("best_epoch", ckpt["train_info"].get("best_epoch"))

    out = config.CHECKPOINT_PATH
    tmp = out.with_suffix(".tmp")
    torch.save(ckpt, tmp)
    atomic_replace(tmp, out)
    out.with_name("report.json").write_text(json.dumps(ckpt["report"], indent=2))
    print(f"Saved model + report to {out} and report.json")


if __name__ == "__main__":
    main()
