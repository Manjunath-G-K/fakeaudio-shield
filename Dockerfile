# FakeAudio Shield: one container serving the API and the built website on port 8000.
#   docker build -t fakeaudio-shield .
#   docker run --rm -p 8000:8000 fakeaudio-shield        -> http://localhost:8000

# ── 1. build the React site ──────────────────────────────────────────────────
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── 2. API + model ──────────────────────────────────────────────────────────
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    HF_HOME=/home/app/.cache/huggingface TRANSFORMERS_VERBOSITY=error
# ffmpeg decodes M4A/AAC uploads; libsndfile reads WAV/FLAC/OGG/MP3
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/* && useradd --create-home --uid 10001 app
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

USER app
# fetch the frozen Wav2Vec2 weights at build time, so the container starts without internet
RUN python -c "from transformers import Wav2Vec2Model; Wav2Vec2Model.from_pretrained('facebook/wav2vec2-base')"
COPY --chown=app backend/app ./app
COPY --chown=app backend/checkpoints ./checkpoints
COPY --chown=app --from=web /web/dist /app/frontend/dist

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"
# one worker: the models are loaded once per process (plan for ~1.5 GB RAM)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
