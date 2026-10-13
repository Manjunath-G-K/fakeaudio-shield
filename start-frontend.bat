@echo off
title FakeAudio Shield - Frontend (React)
cd /d "%~dp0frontend"
echo Starting FakeAudio Shield web page on http://localhost:5173 ...
echo.
rem --open launches the browser once the dev server is ready
npm run dev -- --open
pause
