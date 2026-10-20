"""Step 2 of the pipeline: load the audio and standardise it.

Resample to 16 kHz mono -> trim leading/trailing silence -> peak-normalise ->
split into fixed 4-second segments for the model.
"""
import os
import shutil
import subprocess
import tempfile
import warnings

import librosa
import numpy as np

from . import config


class AudioError(ValueError):
    """The uploaded file is not usable audio. The message is shown to the user."""


def _ffmpeg_to_wav(path: str) -> str:
    """Formats libsndfile cannot read (e.g. M4A/AAC) are converted to WAV with ffmpeg."""
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is not installed")
    fd, wav = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    proc = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vn", wav],
                          capture_output=True, timeout=120)
    if proc.returncode != 0:
        os.remove(wav)
        raise RuntimeError(proc.stderr.decode(errors="ignore"))
    return wav


def load_audio(path: str) -> tuple[np.ndarray, int]:
    """Decode any supported file to a mono float waveform at its original sample rate."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                y, sr = librosa.load(path, sr=None, mono=True)
            except Exception:
                wav = _ffmpeg_to_wav(path)
                try:
                    y, sr = librosa.load(wav, sr=None, mono=True)
                finally:
                    os.remove(wav)
    except Exception as exc:  # corrupted file, wrong format, not audio at all
        raise AudioError(
            "Could not decode the file as audio. Please upload a valid WAV, FLAC, MP3, OGG or M4A file."
        ) from exc
    if y.size == 0 or sr is None or sr <= 0:
        raise AudioError("The audio file is empty.")
    if not np.all(np.isfinite(y)):
        raise AudioError("The audio file contains invalid sample values.")
    return y.astype(np.float32), int(sr)


def preprocess(y: np.ndarray, sr: int) -> np.ndarray:
    """Resample to 16 kHz, trim silence and normalise. Returns the cleaned waveform."""
    return preprocess_with_offset(y, sr)[0]


def preprocess_with_offset(y: np.ndarray, sr: int) -> tuple[np.ndarray, float]:
    """Like preprocess(), also returning where the kept speech starts in the original audio (seconds),
    so segment times can be mapped back onto the uploaded file."""
    if sr != config.SAMPLE_RATE:
        y = librosa.resample(y, orig_sr=sr, target_sr=config.SAMPLE_RATE)

    if np.max(np.abs(y)) < config.SILENCE_PEAK:
        raise AudioError("The audio is silent - no speech was found.")

    y, (start, _) = librosa.effects.trim(y, top_db=config.TRIM_TOP_DB)

    if len(y) < config.MIN_SPEECH_SECONDS * config.SAMPLE_RATE:
        raise AudioError(
            f"Too little speech after removing silence (need at least {config.MIN_SPEECH_SECONDS} s)."
        )

    max_len = int(config.MAX_ANALYSED_SECONDS * config.SAMPLE_RATE)
    y = y[:max_len]
    return (y / np.max(np.abs(y)) * 0.95).astype(np.float32), start / config.SAMPLE_RATE


def _fit_length(y: np.ndarray, n: int) -> np.ndarray:
    """Crop to n samples, or repeat the clip until it is n samples long."""
    if len(y) >= n:
        return y[:n]
    reps = int(np.ceil(n / len(y)))
    return np.tile(y, reps)[:n]


def segment(y: np.ndarray) -> list[tuple[float, float, np.ndarray]]:
    """Split into consecutive 4 s windows as (start_s, end_s, samples).

    A trailing partial window is only kept if it holds at least MIN_TAIL_SECONDS of audio:
    a short tail repeated up to 4 s creates an artificial, repetitive signal that the model
    can mistake for synthesis. Clips shorter than 4 s still give one repeated window.
    """
    n = int(config.SEGMENT_SECONDS * config.SAMPLE_RATE)
    min_tail = int(config.MIN_TAIL_SECONDS * config.SAMPLE_RATE)
    out = []
    for start in range(0, len(y), n):
        chunk = y[start:start + n]
        if len(chunk) < min_tail and out:
            break
        end = start + len(chunk)
        out.append((start / config.SAMPLE_RATE, end / config.SAMPLE_RATE, _fit_length(chunk, n)))
    return out


def training_segment(y: np.ndarray) -> np.ndarray:
    """One 4 s window per training file (the first 4 s, repeated if shorter)."""
    return _fit_length(y, int(config.SEGMENT_SECONDS * config.SAMPLE_RATE))
