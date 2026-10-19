"""Recording-condition shortcut test, per language.

    python shortcut_probe.py

If real and AI clips of a language come from different sources (e.g. crowd-sourced phone
recordings vs clean synthesis), a model can score well by recognising the *recording
conditions* instead of synthetic speech. This script trains a deliberately simple classifier
(logistic regression) on a recording-condition fingerprint only: the long-term average
spectrum (40 mel bands, averaged over time) plus the noise floor and loudness spread. It
knows nothing about voice detail. Its test EER per language is stored in the report:

  * channel EER <= 10%  -> real vs AI can be told apart by recording conditions alone, so
    the main model's score for that language may be optimistic; status is capped at
    "experimental" and the reason is shown on the website.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
import json
from pathlib import Path

import librosa
import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app import config
from app.preprocess import AudioError, load_audio, preprocess
from train import atomic_replace, compute_eer, read_manifest

CAP = 0.10            # channel-only EER at or below this caps the language at "experimental"
MAX_PER_CLASS = 300   # per language, per split, per class (keeps the run to a few minutes)


def fingerprint(path) -> np.ndarray:
    y, sr = load_audio(str(path))
    y = preprocess(y, sr)
    mel = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=config.SAMPLE_RATE, n_fft=512,
                                                              hop_length=160, n_mels=40) + 1e-10)
    frame_db = mel.mean(axis=0)
    return np.concatenate([mel.mean(axis=1) - mel.mean(),                        # spectral tilt / channel shape
                           [np.percentile(frame_db, 10) - np.percentile(frame_db, 90),  # noise floor vs speech level
                            frame_db.std()]])


def main():
    items = read_manifest(Path("../data/manifest.csv"), Path("../data"))
    rng = np.random.default_rng(0)
    results = {}
    for lang in sorted({it["lang"] for it in items}):
        feats = {}
        for split in ("train", "test"):
            X, Y = [], []
            for label in (0, 1):
                group = [it for it in items if it["lang"] == lang and it["split"] == split and it["label"] == label]
                for it in rng.permutation(group)[:MAX_PER_CLASS]:
                    try:
                        X.append(fingerprint(it["path"])), Y.append(label)
                    except AudioError:
                        pass
            feats[split] = (np.array(X), np.array(Y))
        clf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=1.0))
        clf.fit(*feats["train"])
        Xt, Yt = feats["test"]
        eer = compute_eer(Yt, clf.predict_proba(Xt)[:, 1])
        results[lang] = {"channel_eer": round(eer, 4), "test_clips": int(len(Yt)), "shortcut_risk": bool(eer <= CAP)}
        print(f"{lang:10s} channel-only EER {eer * 100:5.1f}%  ({len(Yt)} test clips)  {'SHORTCUT RISK' if eer <= CAP else 'ok'}", flush=True)

    out = config.CHECKPOINT_PATH.with_name("shortcut_probe.json")
    out.write_text(json.dumps({"cap": CAP, "method": __doc__.split("\n\n")[1].strip(), "results": results}, indent=2))

    # fold into the shipped report: cap status where recording conditions alone separate the classes
    ckpt = torch.load(config.CHECKPOINT_PATH, map_location="cpu", weights_only=False)
    rep = ckpt.get("report")
    if rep:
        for lang, r in results.items():
            L = rep["languages"].get(lang)
            if not L:
                continue
            L["shortcut_probe"] = r
            if r["shortcut_risk"] and L["status"] == "supported":
                L["status"] = "experimental"
                L["status_reason"] = (f"Real and AI clips can be told apart by recording conditions alone "
                                      f"(channel-only EER {r['channel_eer'] * 100:.1f}%), so this score may be optimistic.")
        rep["metric_definitions"]["shortcut_probe"] = ("Recording-condition check: a simple classifier that only sees the average "
                                                       f"spectrum and noise floor. If it reaches EER <= {CAP * 100:.0f}%, the language "
                                                       "is capped at 'experimental'.")
        tmp = config.CHECKPOINT_PATH.with_suffix(".tmp")
        torch.save(ckpt, tmp)
        atomic_replace(tmp, config.CHECKPOINT_PATH)
        config.CHECKPOINT_PATH.with_name("report.json").write_text(json.dumps(rep, indent=2))
        print("report updated with shortcut-probe results")


if __name__ == "__main__":
    main()
