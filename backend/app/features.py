"""Steps 3-4 of the pipeline: feature extraction.

For each 4 s segment we compute, frame by frame (50 frames per second):
  * Wav2Vec2 embeddings (768 values per frame) - learned speech representation
  * log-mel spectrogram (80) + MFCC (20) from Librosa - supporting spectral features
"""
import librosa
import numpy as np
import torch
from transformers import Wav2Vec2Model

from . import config


def spectral_features(segment: np.ndarray) -> np.ndarray:
    """Log-mel + MFCC, shape (frames, 100), normalised per utterance."""
    mel = librosa.feature.melspectrogram(
        y=segment, sr=config.SAMPLE_RATE, n_fft=config.N_FFT, win_length=config.WIN_LENGTH,
        hop_length=config.HOP_LENGTH, n_mels=config.N_MELS, center=False,
    )
    log_mel = librosa.power_to_db(mel, ref=1.0, top_db=None)
    mfcc = librosa.feature.mfcc(S=log_mel, n_mfcc=config.N_MFCC)
    feats = np.concatenate([log_mel, mfcc], axis=0).T  # (frames, 100)
    feats = (feats - feats.mean(axis=0)) / (feats.std(axis=0) + 1e-5)
    return feats.astype(np.float32)


class Wav2Vec2Embedder:
    """Frozen Wav2Vec2 (wav2vec2-base). Downloads the weights from Hugging Face on first use."""

    def __init__(self):
        self.model = Wav2Vec2Model.from_pretrained(config.W2V_MODEL_NAME)
        # Only layers up to W2V_LAYER are needed; dropping the rest makes CPU inference faster
        # and gives exactly the same hidden_states[W2V_LAYER].
        self.model.encoder.layers = self.model.encoder.layers[:config.W2V_LAYER]
        self.model.eval()

    @torch.inference_mode()
    def __call__(self, segments: np.ndarray) -> np.ndarray:
        """segments: (batch, samples) -> (batch, frames, 768)."""
        x = torch.from_numpy(segments)
        # same zero-mean / unit-variance normalisation as Wav2Vec2FeatureExtractor
        x = (x - x.mean(dim=1, keepdim=True)) / torch.sqrt(x.var(dim=1, keepdim=True) + 1e-7)
        out = self.model(x, output_hidden_states=True)
        return out.hidden_states[config.W2V_LAYER].numpy()


def extract(embedder: Wav2Vec2Embedder, segments: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """Features for a list of equal-length segments -> (w2v, spec), time-aligned."""
    w2v = embedder(np.stack(segments))
    spec = np.stack([spectral_features(s) for s in segments])
    t = min(w2v.shape[1], spec.shape[1])
    return w2v[:, :t], spec[:, :t]
