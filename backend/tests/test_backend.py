"""Backend tests: preprocessing, model shapes, dataset integrity and the HTTP API.

    cd backend
    .venv\\Scripts\\python -m pytest -q

API tests that need the trained checkpoint are skipped if it is missing.
"""
import csv
import io
import wave
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pytest
import torch

from app import config
from app.model import FakeAudioLCNN
from app.preprocess import AudioError, load_audio, preprocess, segment

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "frontend" / "public" / "samples"
MANIFEST = ROOT / "data" / "manifest.csv"


def wav_bytes(samples: np.ndarray, sr: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(sr)
        w.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())
    return buf.getvalue()


# ── preprocessing ────────────────────────────────────────────────────────────
def test_silent_audio_is_rejected():
    with pytest.raises(AudioError, match="silent"):
        preprocess(np.zeros(16000, np.float32), 16000)


def test_too_short_speech_is_rejected():
    tone = 0.5 * np.sin(2 * np.pi * 220 * np.arange(1600) / 16000).astype(np.float32)   # 0.1 s
    with pytest.raises(AudioError, match="Too little speech"):
        preprocess(np.concatenate([np.zeros(8000, np.float32), tone, np.zeros(8000, np.float32)]), 16000)


def test_resample_normalise_and_segment():
    t = np.arange(44100 * 9) / 44100
    y = (0.2 * np.sin(2 * np.pi * 300 * t)).astype(np.float32)          # 9 s at 44.1 kHz
    clean = preprocess(y, 44100)
    assert abs(len(clean) / config.SAMPLE_RATE - 9) < 0.05
    assert abs(np.max(np.abs(clean)) - 0.95) < 1e-3
    segs = segment(clean)
    assert len(segs) == 2                                                 # 4 s + 4 s; the 1 s tail is dropped
    assert all(len(s) == int(config.SEGMENT_SECONDS * config.SAMPLE_RATE) for _, _, s in segs)


def test_long_enough_tail_is_kept_and_short_clip_still_scored():
    sr = config.SAMPLE_RATE
    tone = lambda secs: (0.2 * np.sin(2 * np.pi * 300 * np.arange(int(secs * sr)) / sr)).astype(np.float32)
    assert [round(b - a, 1) for a, b, _ in segment(tone(10.5))] == [4.0, 4.0, 2.5]   # 2.5 s tail kept
    assert len(segment(tone(1.5))) == 1                                               # short clip: one window


def test_corrupted_file_is_rejected(tmp_path):
    bad = tmp_path / "bad.wav"
    bad.write_bytes(b"this is not audio")
    with pytest.raises(AudioError, match="Could not decode"):
        load_audio(str(bad))


# ── model ────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("arch", [{"proj_dim": 64, "time_pool": 2}, {"proj_dim": 128, "time_pool": 1}])
def test_model_output_shape(arch):
    m = FakeAudioLCNN(**arch).eval()
    with torch.no_grad():
        out = m(torch.randn(3, 199, config.W2V_DIM), torch.randn(3, 199, config.SPEC_DIM))
    assert out.shape == (3, 2)


# ── dataset integrity ────────────────────────────────────────────────────────
@pytest.mark.skipif(not MANIFEST.exists(), reason="run prepare_dataset.py first")
def test_manifest_is_speaker_disjoint_balanced_and_deduplicated():
    rows = list(csv.DictReader(MANIFEST.open(encoding="utf-8")))
    splits = defaultdict(set)
    for r in rows:
        splits[(r["lang"], r["speaker"])].add(r["split"])
    assert all(len(s) == 1 for s in splits.values()), "a speaker appears in more than one split"
    counts = Counter((r["lang"], r["split"], r["label"]) for r in rows)
    for (lang, split, _), _n in counts.items():
        assert counts[(lang, split, "bonafide")] == counts[(lang, split, "spoof")], f"{lang}/{split} unbalanced"
    hashes = [r["sha1"] for r in rows]
    assert len(hashes) == len(set(hashes)), "duplicate audio in manifest"


# ── HTTP API ─────────────────────────────────────────────────────────────────
needs_model = pytest.mark.skipif(not config.CHECKPOINT_PATH.exists(), reason="no trained checkpoint")


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c


@needs_model
def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["model_loaded"] is True


@needs_model
def test_unsupported_type_is_415(client):
    r = client.post("/api/predict", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 415


@needs_model
def test_empty_file_is_400(client):
    r = client.post("/api/predict", files={"file": ("empty.wav", b"", "audio/wav")})
    assert r.status_code == 400 and "empty" in r.json()["detail"]


@needs_model
def test_silent_wav_is_400(client):
    r = client.post("/api/predict", files={"file": ("silent.wav", wav_bytes(np.zeros(32000)), "audio/wav")})
    assert r.status_code == 400 and "silent" in r.json()["detail"]


@needs_model
def test_corrupted_wav_is_400(client):
    r = client.post("/api/predict", files={"file": ("broken.wav", b"RIFF....garbage", "audio/wav")})
    assert r.status_code == 400


@needs_model
@pytest.mark.parametrize("name,truth", [("real-voice-1.flac", "bonafide"), ("ai-voice-a17.flac", "spoof")])
def test_known_samples_are_classified(client, name, truth):
    r = client.post("/api/predict", files={"file": (name, (SAMPLES / name).read_bytes(), "audio/flac")})
    assert r.status_code == 200
    body = r.json()
    assert body["label"] == truth
    assert abs(body["probabilities"]["bonafide"] + body["probabilities"]["spoof"] - 1) < 1e-5
    assert 0.5 <= body["confidence"] <= 1


@needs_model
def test_report_has_per_language_metrics(client):
    r = client.get("/api/report")
    if r.status_code == 404:
        pytest.skip("checkpoint has no report yet")
    rep = r.json()
    assert rep["languages"], "no languages in report"
    for lang, L in rep["languages"].items():
        t = L["test"]
        assert t["bonafide_total"] > 0 and t["spoof_total"] > 0, lang
        assert 0 <= t["eer"] <= 1 and t["eer_ci"][0] <= t["eer"] <= t["eer_ci"][1], lang
        assert L["status"] in ("supported", "experimental", "not supported")
