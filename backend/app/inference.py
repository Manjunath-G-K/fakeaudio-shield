"""Runs the full pipeline on one file: preprocess -> features -> Wav2Vec2 + LCNN -> result."""
import logging
import threading
import time
from pathlib import Path

import numpy as np
import torch

from . import config
from .features import Wav2Vec2Embedder, extract
from .model import FakeAudioLCNN
from .preprocess import load_audio, preprocess, segment

log = logging.getLogger(__name__)

# settings that must match between training and prediction
PIPELINE_KEYS = ["SAMPLE_RATE", "SEGMENT_SECONDS", "TRIM_TOP_DB", "W2V_MODEL_NAME", "W2V_LAYER",
                 "N_FFT", "WIN_LENGTH", "HOP_LENGTH", "N_MELS", "N_MFCC"]


def pipeline_settings() -> dict:
    return {k: getattr(config, k) for k in PIPELINE_KEYS}


def calibrate(p, threshold: float):
    """Map raw P(spoof) so the dev-calibrated decision threshold sits at 0.5.

    Piecewise-linear and monotonic, so rankings (and EER) are unchanged; it only moves the
    point where the verdict flips, which train.py chose on the dev set (equal-error point).
    """
    p = np.asarray(p, dtype=float)
    t = min(max(threshold, 1e-6), 1 - 1e-6)
    return np.where(p >= t, 0.5 + 0.5 * (p - t) / (1 - t), 0.5 * p / t)


class ModelNotReady(RuntimeError):
    pass


class Detector:
    """Loads the multilingual model plus any per-language specialists and routes each request.

    Checkpoints are loaded with weights_only=True: they hold only tensors and plain data, so a
    tampered file cannot run code on load.
    """

    def __init__(self, checkpoint: Path = config.CHECKPOINT_PATH, specialists: dict | None = None):
        self.checkpoint_path = checkpoint
        self.specialist_paths = config.LANGUAGE_CHECKPOINTS if specialists is None else specialists
        self.models = {}          # key -> {"lcnn", "threshold", "name", "languages"}
        self.routes = {}          # language -> key of a specialist
        self.meta = {}
        self.report = None
        self.embedder = None
        self.load_error = None
        self._lock = threading.Lock()
        self._load()

    @staticmethod
    def _read(path: Path):
        ckpt = torch.load(path, map_location="cpu", weights_only=True)
        if not isinstance(ckpt, dict) or "state_dict" not in ckpt:
            raise ValueError(f"{path.name} is not a valid FakeAudio checkpoint")
        if ckpt.get("pipeline") != pipeline_settings():
            raise ValueError(f"{path.name} was trained with different preprocessing settings than app/config.py")
        # checkpoints from before the lighter architecture have no "arch" entry
        lcnn = FakeAudioLCNN(**ckpt.get("arch", {"proj_dim": 128, "time_pool": 1}))
        lcnn.load_state_dict(ckpt["state_dict"])
        lcnn.eval()
        return ckpt, {"lcnn": lcnn, "threshold": float(ckpt.get("threshold", 0.5)),   # dev-calibrated raw cut-off
                      "languages": list(ckpt.get("train_info", {}).get("languages", []))}

    def _load(self):
        if not self.checkpoint_path.exists():
            self.load_error = (
                f"No trained model found at {self.checkpoint_path.name}. "
                "Train it first (see README: Training)."
            )
            return
        try:
            ckpt, main = self._read(self.checkpoint_path)
            embedder = Wav2Vec2Embedder()
        except Exception:
            # Keep the API available so /api/health can explain the problem and
            # /api/predict can return a controlled 503 instead of killing startup.
            log.exception("Could not load checkpoint %s", self.checkpoint_path)
            self.load_error = (
                "The trained model could not be loaded. Retrain it with the current code "
                "and check the backend log for details."
            )
            return

        self.models["multilingual"] = {**main, "name": "Multilingual"}
        for lang, path in self.specialist_paths.items():
            if not Path(path).exists():
                log.warning("No %s specialist at %s: %s uses the multilingual model", lang, path, lang)
                continue
            try:
                _, spec = self._read(Path(path))
            except Exception:
                log.exception("Could not load the %s specialist: %s uses the multilingual model", lang, lang)
                continue
            key = lang.lower()
            self.models[key] = {**spec, "name": f"{lang} specialist"}
            self.routes[lang] = key

        self.meta = {k: ckpt.get(k) for k in ("train_info", "trained_at")}
        self.report = ckpt.get("report")   # full evaluation report for the results page
        self.embedder = embedder

    @property
    def ready(self) -> bool:
        return "multilingual" in self.models

    @property
    def languages(self) -> list[str]:
        """Languages with measured results: everything the models were trained and evaluated on."""
        langs = {l for m in self.models.values() for l in m["languages"]}
        return sorted(langs, key=lambda l: (l != "English", l))

    def status(self) -> dict:
        return {
            "model_loaded": self.ready,
            "message": "Model ready" if self.ready else self.load_error,
            "model": "Wav2Vec2 (wav2vec2-base, frozen) + LCNN",
            "languages": self.languages,
            "models": {lang: self.models[key]["name"] for lang, key in self.routes.items()},
            **self.meta,
        }

    @torch.inference_mode()
    def predict(self, path: str, language: str | None = None) -> dict:
        if not self.ready:
            raise ModelNotReady(self.load_error)
        t0 = time.perf_counter()
        m = self.models[self.routes.get(language, "multilingual")]

        y, orig_sr = load_audio(path)              # AudioError if invalid
        original_duration = len(y) / orig_sr
        clean = preprocess(y, orig_sr)
        segs = segment(clean)

        with self._lock:
            w2v, spec = extract(self.embedder, [s for _, _, s in segs])
            logits = m["lcnn"](torch.from_numpy(w2v), torch.from_numpy(spec))
        probs = torch.softmax(logits, dim=1).numpy()          # (n_segments, 2)

        # average raw P(spoof) over segments, weighted by how much real (unpadded) audio each
        # holds, then calibrate so the dev-chosen threshold sits at 0.5
        weights = np.array([b - a for a, b, _ in segs])
        p_spoof = float(calibrate(np.average(probs[:, 1], weights=weights), m["threshold"]))
        seg_p = calibrate(probs[:, 1], m["threshold"])
        label = "spoof" if p_spoof >= 0.5 else "bonafide"
        return {
            "label": label,
            "verdict": "AI-generated / Spoof" if label == "spoof" else "Real / Bona-fide",
            "confidence": p_spoof if label == "spoof" else 1 - p_spoof,
            "probabilities": {"bonafide": 1 - p_spoof, "spoof": p_spoof},
            "language": language,
            "model": m["name"],
            "segments": [
                {"start": round(a, 2), "end": round(b, 2), "spoof_probability": float(p)}
                for (a, b, _), p in zip(segs, seg_p)
            ],
            "audio": {
                "original_sample_rate": orig_sr,
                "original_duration_sec": round(original_duration, 2),
                "analysed_duration_sec": round(len(clean) / config.SAMPLE_RATE, 2),
                "processed_sample_rate": config.SAMPLE_RATE,
            },
            "processing_time_ms": round((time.perf_counter() - t0) * 1000),
        }
