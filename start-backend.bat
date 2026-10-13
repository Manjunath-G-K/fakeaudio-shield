@echo off
title FakeAudio Shield - Backend (FastAPI)
cd /d "%~dp0backend"
echo Starting FakeAudio Shield backend on http://127.0.0.1:8000 ...
echo Wait for "FakeAudio Shield: Model ready" before analysing audio.
echo.
.venv\Scripts\python -m uvicorn app.main:app --port 8000
pause
