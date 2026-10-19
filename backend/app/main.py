"""FastAPI backend for FakeAudio Shield.

    uvicorn app.main:app --port 8000

GET  /api/health            -> is the trained model loaded? which languages?
GET  /api/report            -> full evaluation report (per-language metrics, dataset, training)
GET  /api/data-size-study   -> learning curve (EER vs number of training clips)
POST /api/predict           -> multipart: file (+ optional language), returns Real vs AI-generated

If frontend/dist exists (npm run build), the website is served from / as well, so one
process is enough in production.
"""
import json
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return detector.status()


@app.get("/api/report")
def report():
    """Full evaluation report written by train.py / evaluate.py into the checkpoint."""
    if not detector.ready:
        raise HTTPException(503, detector.load_error)
    if not detector.report:
        raise HTTPException(404, "This checkpoint has no evaluation report. Run: python evaluate.py")
    return detector.report


@app.get("/api/data-size-study")
def data_size_study():
    """Learning curve from data_size_study.py (read from disk on each request)."""
    path = config.CHECKPOINT_PATH.with_name("data_size_study.json")
    if not path.exists():
        raise HTTPException(404, "Run: python data_size_study.py")
    return json.loads(path.read_text())


@app.post("/api/predict")
def predict(file: UploadFile = File(...), language: str | None = Form(None)):
    # FastAPI runs plain `def` endpoints in a worker thread, so the model does not block the server.
    name = Path(file.filename or "upload").name
    ext = Path(name).suffix.lower()
    if ext not in config.ALLOWED_EXTENSIONS:
        raise HTTPException(415, f"Unsupported file type '{ext or 'none'}'. "
                                 f"Allowed: {', '.join(sorted(config.ALLOWED_EXTENSIONS))}.")
    if not detector.ready:
        raise HTTPException(503, detector.load_error)
    if language is not None and language not in detector.languages:
        raise HTTPException(400, f"Unsupported language '{language[:40]}'. "
                                 f"Supported: {', '.join(detector.languages)}.")

    data = file.file.read(config.MAX_UPLOAD_BYTES + 1)
    if len(data) == 0:
        raise HTTPException(400, "The uploaded file is empty.")
    if len(data) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File is larger than {config.MAX_UPLOAD_MB} MB.")

    fd, tmp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        result = detector.predict(tmp_path, language)
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


# Production: serve the built React app from the same origin (registered last, so /api wins).
if config.FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=config.FRONTEND_DIST, html=True), name="frontend")
