"""FastAPI backend for FakeAudio Shield.

    uvicorn app.main:app --port 8000

GET  /api/health   -> is the trained model loaded? (+ its measured metrics)
POST /api/predict  -> upload an audio file, get Real/Bona-fide vs AI-generated/Spoof
"""
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .inference import Detector, ModelNotReady
from .preprocess import AudioError

log = logging.getLogger("fakeaudio")
detector: Detector | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global detector
    detector = Detector()
    log.warning("FakeAudio Shield: %s", detector.status()["message"])
    yield


app = FastAPI(title="FakeAudio Shield API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return detector.status()


@app.post("/api/predict")
def predict(file: UploadFile = File(...)):
    # FastAPI runs plain `def` endpoints in a worker thread, so the model does not block the server.
    name = file.filename or "upload"
    ext = Path(name).suffix.lower()
    if ext not in config.ALLOWED_EXTENSIONS:
        raise HTTPException(415, f"Unsupported file type '{ext or 'none'}'. "
                                 f"Allowed: {', '.join(sorted(config.ALLOWED_EXTENSIONS))}.")
    if not detector.ready:
        raise HTTPException(503, detector.load_error)

    data = file.file.read(config.MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(data) == 0:
        raise HTTPException(400, "The uploaded file is empty.")
    if len(data) > config.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File is larger than {config.MAX_UPLOAD_MB} MB.")

    fd, tmp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        result = detector.predict(tmp_path)
    except AudioError as exc:
        raise HTTPException(400, str(exc))
    except ModelNotReady as exc:
        raise HTTPException(503, str(exc))
    except Exception:
        log.exception("Prediction failed for %s", name)
        raise HTTPException(500, "Internal error while analysing the audio. See the backend log.")
    finally:
        os.remove(tmp_path)

    result["audio"]["filename"] = name
    return result
