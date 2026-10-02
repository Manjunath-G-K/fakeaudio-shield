"""Shared settings for preprocessing, feature extraction, training and inference.

Training (train.py) and the API (main.py) both import from here, so the audio the
model sees at prediction time is prepared exactly the same way as during training.
"""
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
CHECKPOINT_PATH = BACKEND_DIR / "checkpoints" / "fakeaudio_lcnn.pt"

# --- Preprocessing -----------------------------------------------------------
SAMPLE_RATE = 16_000          # Wav2Vec2 expects 16 kHz mono audio
TRIM_TOP_DB = 35              # silence threshold for librosa.effects.trim
SEGMENT_SECONDS = 4.0         # model input length; longer clips are split into 4 s windows
MIN_SPEECH_SECONDS = 0.5      # clips shorter than this after trimming are rejected
MAX_ANALYSED_SECONDS = 60.0   # only the first 60 s of a long upload is analysed
SILENCE_PEAK = 1e-4           # peak amplitude below this counts as a silent file

# --- Upload limits -----------------------------------------------------------
MAX_UPLOAD_MB = 20
ALLOWED_EXTENSIONS = {".wav", ".flac", ".mp3", ".ogg", ".m4a"}

# --- Features ----------------------------------------------------------------
W2V_MODEL_NAME = "facebook/wav2vec2-base"
# Wav2Vec2 is used as a frozen feature extractor (CPU-only training). A middle
# transformer layer is used because it keeps more acoustic detail than the last
# layer, which is specialised for the pre-training task.
W2V_LAYER = 6
W2V_DIM = 768

# Frame settings chosen so Librosa frames line up with Wav2Vec2 frames
# (both: 25 ms window, 20 ms hop -> 50 frames per second).
N_FFT = 512
WIN_LENGTH = 400
HOP_LENGTH = 320
N_MELS = 80
N_MFCC = 20
SPEC_DIM = N_MELS + N_MFCC

LABELS = ["bonafide", "spoof"]   # class index 0 = real speech, 1 = AI-generated
