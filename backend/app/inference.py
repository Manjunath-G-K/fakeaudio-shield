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


class ModelNotReady(RuntimeError):
    pass


class Detector:
    def __init__(self, checkpoint: Path = config.CHECKPOINT_PATH):
        self.checkpoint_path = checkpoint
        self.lcnn = None
        self.meta = {}
        self.embedder = None
        self.load_error = None
        self._lock = threading.Lock()
        self._load()

    def _load(self):
        if not self.checkpoint_path.exists():
            self.load_error = (
                f"No trained model found at {self.checkpoint_path}. "
                "Train it first with: python train.py --asvspoof-root ../data/LA"
            )
            return
        try:
            ckpt = torch.load(self.checkpoint_path, map_location="cpu", weights_only=False)
            if not isinstance(ckpt, dict) or "state_dict" not in ckpt:
                raise ValueError("checkpoint is not a valid FakeAudio checkpoint")
            if ckpt.get("pipeline") != pipeline_settings():
                self.load_error = ("The checkpoint was trained with different preprocessing settings "
                                   "than app/config.py. Retrain the model.")
                return

            lcnn = FakeAudioLCNN()
            lcnn.load_state_dict(ckpt["state_dict"])
            lcnn.eval()
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

        self.lcnn = lcnn
        self.lcnn.eval()
        self.meta = {k: ckpt.get(k) for k in ("metrics", "train_info", "trained_at")}
        self.embedder = embedder

    @property
    def ready(self) -> bool:
        return self.lcnn is not None

    def status(self) -> dict:
        return {
            "model_loaded": self.ready,
            "message": "Model ready" if self.ready else self.load_error,
            "model": "Wav2Vec2 (wav2vec2-base, frozen) + LCNN",
            **self.meta,
        }

    @torch.inference_mode()
    def predict(self, path: str) -> dict:
        if not self.ready:
            raise ModelNotReady(self.load_error)
        t0 = time.perf_counter()

        y, orig_sr = load_audio(path)              # AudioError if invalid
        original_duration = len(y) / orig_sr
        clean = preprocess(y, orig_sr)
        segs = segment(clean)

        with self._lock:
            w2v, spec = extract(self.embedder, [s for _, _, s in segs])
            logits = self.lcnn(torch.from_numpy(w2v), torch.from_numpy(spec))
        probs = torch.softmax(logits, dim=1).numpy()          # (n_segments, 2)

        p_spoof = float(np.mean(probs[:, 1]))                 # average over segments
        label = "spoof" if p_spoof >= 0.5 else "bonafide"
        return {
            "label": label,
            "verdict": "AI-generated / Spoof" if label == "spoof" else "Real / Bona-fide",
            "confidence": p_spoof if label == "spoof" else 1 - p_spoof,
            "probabilities": {"bonafide": 1 - p_spoof, "spoof": p_spoof},
            "segments": [
                {"start": round(a, 2), "end": round(b, 2), "spoof_probability": float(p[1])}
                for (a, b, _), p in zip(segs, probs)
            ],
            "audio": {
                "original_sample_rate": orig_sr,
                "original_duration_sec": round(original_duration, 2),
                "analysed_duration_sec": round(len(clean) / config.SAMPLE_RATE, 2),
                "processed_sample_rate": config.SAMPLE_RATE,
            },
            "processing_time_ms": round((time.perf_counter() - t0) * 1000),
        }
