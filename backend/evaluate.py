"""Measure the deployed models on dev/test, calibrate thresholds, and store the full report.

    python evaluate.py
    python evaluate.py --training-json training.json

Scores every language with the model the API uses for it: the multilingual checkpoint
(app/config.py CHECKPOINT_PATH), or a specialist from LANGUAGE_CHECKPOINTS (e.g. English).
Each threshold is chosen on the dev split (equal-error point, languages weighted equally);
the test split is never used to choose anything. Recording-condition results from
shortcut_probe.py (shortcut_probe.json) are folded in if present.

Writes the report into the multilingual checkpoint (served by /api/report) and report.json.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
import argparse
import json
from pathlib import Path

import numpy as np
import torch

from app import config
from app.inference import calibrate
from app.model import FakeAudioLCNN
from shortcut_probe import apply_to_report
from train import (build_report, dev_threshold, evaluate_scores, fmt, load_features, plain, read_manifest,
                   save_checkpoint, scores_of, support_status)


def load_model(path: Path):
    ckpt = torch.load(path, map_location="cpu", weights_only=True)
    model = FakeAudioLCNN(**ckpt.get("arch", {"proj_dim": 128, "time_pool": 1}))
    model.load_state_dict(ckpt["state_dict"])
    return ckpt, model


def subset(data: dict, mask: np.ndarray) -> dict:
    return {k: v[torch.from_numpy(mask)] if torch.is_tensor(v) else v[mask] for k, v in data.items()}


def model_info(model, ckpt, threshold, name, path, training=None) -> dict:
    return {"name": name, "checkpoint": Path(path).name, "arch": model.arch,
            "trainable_parameters": int(sum(p.numel() for p in model.parameters())),
            "raw_threshold": round(threshold, 4), "languages": ckpt["train_info"]["languages"],
            "training": training}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-root", default="../data")
    ap.add_argument("--manifest", default="../data/manifest.csv")
    ap.add_argument("--cache-dir", default="../data/cache")
    ap.add_argument("--training-json", help="JSON with training details of the multilingual model")
    args = ap.parse_args()

    ckpt, model = load_model(config.CHECKPOINT_PATH)
    langs = ckpt["train_info"]["languages"]
    items = read_manifest(Path(args.manifest), Path(args.data_root), langs)
    data = {s: load_features([it for it in items if it["split"] == s], Path(args.cache_dir), [])
            for s in ("dev", "test") if any(it["split"] == s for it in items)}

    # multilingual model: threshold on all dev languages, exactly as train.py does
    threshold = dev_threshold(model, data["dev"])
    print(f"multilingual: raw P(spoof) >= {threshold:.4f}")
    scores = {s: calibrate(scores_of(model, d), threshold) for s, d in data.items()}

    # specialists replace the scores of their language; their threshold comes from that language's dev clips
    specialists = {}
    for lang, path in config.LANGUAGE_CHECKPOINTS.items():
        if lang not in langs or not path.exists():
            continue
        sck, smodel = load_model(path)
        mask = {s: d["langs"] == lang for s, d in data.items()}
        sthr = dev_threshold(smodel, subset(data["dev"], mask["dev"]))
        print(f"{lang} specialist: raw P(spoof) >= {sthr:.4f}")
        for s, d in data.items():
            scores[s][mask[s]] = calibrate(scores_of(smodel, subset(d, mask[s])), sthr)
        training = (sck.get("report") or {}).get("training")
        specialists[lang] = (sck, smodel, sthr, path, training)

    metrics = {s: evaluate_scores(scores[s], d, with_ci=True) for s, d in data.items()}
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
    report = build_report(model, metrics, training.get("train_counts", {}), training, dataset_report, threshold)

    # which model answers for each language (the website shows this next to every result)
    report["models"] = {"multilingual": model_info(model, ckpt, threshold, "Multilingual", config.CHECKPOINT_PATH, training)}
    for lang, (sck, smodel, sthr, path, strain) in specialists.items():
        report["models"][lang.lower()] = model_info(smodel, sck, sthr, f"{lang} specialist", path, strain)
    for lang, L in report["languages"].items():
        L["model"] = lang.lower() if lang in specialists else "multilingual"
        if lang in specialists and strain_counts(specialists[lang][4], lang):
            L["train"] = strain_counts(specialists[lang][4], lang)
    report["model"]["routing"] = ("The language chosen on the website selects the model: "
                                  + ", ".join(f"{l} uses the {l} specialist" for l in specialists)
                                  + "; every other language uses the multilingual model. Specialists were chosen on dev EER.")

    probe = config.CHECKPOINT_PATH.with_name("shortcut_probe.json")
    if probe.exists():
        p = json.loads(probe.read_text())
        apply_to_report(report, p["results"], p["cap"])

    ckpt.update(arch=model.arch, metrics=metrics, threshold=threshold, report=report)
    out = config.CHECKPOINT_PATH
    save_checkpoint(ckpt, out)
    out.with_name("report.json").write_text(json.dumps(plain(report), indent=2))
    print(f"Saved report to {out} and report.json")


def strain_counts(training: dict | None, lang: str):
    return ((training or {}).get("train_counts") or {}).get(lang)


if __name__ == "__main__":
    main()
