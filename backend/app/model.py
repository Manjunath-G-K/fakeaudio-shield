"""Step 5 of the pipeline: the LCNN classifier.

Light CNN (LCNN) with Max-Feature-Map (MFM) activations, the classic ASVspoof
countermeasure architecture. Input: per-frame Wav2Vec2 embeddings (projected to
64 values) concatenated with the 100 Librosa spectral values, treated as a
(time x features) image. Output: two logits, [bona-fide, spoof].
"""
import torch
from torch import nn

from . import config


class MFM(nn.Module):
    """Max-Feature-Map: split the channels in two halves and keep the element-wise max."""

    def __init__(self, dim: int = 1):
        super().__init__()
        self.dim = dim

    def forward(self, x):
        a, b = torch.chunk(x, 2, dim=self.dim)
        return torch.max(a, b)


def conv_mfm(c_in: int, c_out: int, k: int) -> list[nn.Module]:
    return [nn.Conv2d(c_in, c_out * 2, k, padding=k // 2), MFM()]


class FakeAudioLCNN(nn.Module):
    """proj_dim: size the 768-d Wav2Vec2 frames are projected to.
    time_pool: average this many consecutive 20 ms frames before the CNN (2 -> 40 ms frames).
    Both shrink the input image and make CPU training several times faster."""

    def __init__(self, w2v_dim: int = config.W2V_DIM, spec_dim: int = config.SPEC_DIM,
                 proj_dim: int = 64, time_pool: int = 2):
        super().__init__()
        self.arch = {"proj_dim": proj_dim, "time_pool": time_pool}
        self.time_pool = time_pool
        self.w2v_proj = nn.Sequential(nn.LayerNorm(w2v_dim), nn.Linear(w2v_dim, proj_dim))
        self.lcnn = nn.Sequential(
            *conv_mfm(1, 32, 5), nn.MaxPool2d(2),
            *conv_mfm(32, 32, 1), nn.BatchNorm2d(32),
            *conv_mfm(32, 48, 3), nn.MaxPool2d(2), nn.BatchNorm2d(48),
            *conv_mfm(48, 48, 1), nn.BatchNorm2d(48),
            *conv_mfm(48, 64, 3), nn.MaxPool2d(2),
            *conv_mfm(64, 64, 1), nn.BatchNorm2d(64),
            *conv_mfm(64, 32, 3), nn.BatchNorm2d(32),
            *conv_mfm(32, 32, 1), nn.BatchNorm2d(32),
            *conv_mfm(32, 32, 3), nn.MaxPool2d(2),
        )
        n_freq = (proj_dim + spec_dim) // 16      # four 2x2 poolings
        self.classifier = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(32 * n_freq, 160), MFM(dim=1), nn.BatchNorm1d(80),
            nn.Dropout(0.3),
            nn.Linear(80, 2),
        )

    def forward(self, w2v: torch.Tensor, spec: torch.Tensor) -> torch.Tensor:
        """w2v: (B, T, 768), spec: (B, T, 100) -> logits (B, 2)."""
        x = torch.cat([self.w2v_proj(w2v), spec], dim=-1).unsqueeze(1)  # (B, 1, T, proj+100)
        if self.time_pool > 1:
            x = nn.functional.avg_pool2d(x, (self.time_pool, 1))
        x = self.lcnn(x)                  # (B, 32, T/16, F/16)
        x = x.mean(dim=2).flatten(1)      # average over time -> (B, 32 * F/16)
        return self.classifier(x)
