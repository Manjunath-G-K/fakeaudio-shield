# FakeAudio Shield - Project Handoff

This document is the working handoff for completing the FakeAudio Shield backend and
frontend. It describes the current implementation, known gaps, the runbook, and acceptance
criteria for a complete supervised demonstration.

## 1. Executive summary

FakeAudio Shield is a React/Vite frontend backed by a FastAPI/PyTorch audio-classification
service. It accepts an audio recording, standardises it, extracts Wav2Vec2 and spectral
features, classifies each segment with an LCNN, and returns a bona-fide versus spoof verdict.

The application code is in place, but the project is not yet end-to-end complete:

- multilingual downloads are incomplete;
- no trained checkpoint is currently available in the repository;
- the real-model browser demo has not been completed;
- automated backend and frontend test suites still need to be added;
- final multilingual quality metrics have not yet been recorded.

The immediate objective is to finish the data pipeline, train one reproducible baseline,
validate the running product, and record honest metrics before attempting larger models or
production deployment.

## 2. Current state

| Area | Current state | Completion condition |
|---|---|---|
| Backend preprocessing | Implemented | Automated tests cover valid, invalid, silent, short, and long audio |
| Feature extraction | Implemented | Feature shapes and cache reuse are tested |
| LCNN model | Implemented | A trained checkpoint loads successfully |
| FastAPI API | Implemented | Contract and status-code tests pass |
| Checkpoint loading | Implemented with controlled failure handling | `/api/health` reports `model_loaded: true` |
| Frontend upload and preview | Implemented | Mouse, drag-and-drop, and keyboard upload are tested |
| Frontend result display | Implemented | Verified with a trained backend response |
| English ASVspoof subset | Downloaded according to progress notes | Included in a successful training run |
| IndicSynth fake speech | Partially downloaded | 300 clips for each of 7 languages, or reduced scope documented |
| Kathbath real speech | Waiting for access/download | 300 clips for each of 7 languages, or reduced scope documented |
| Model training | Not completed | Checkpoint, metrics, and training configuration recorded |
| End-to-end demo | Not completed with a trained model | Validation matrix passes against the trained API |

`PROGRESS.md` contains historical notes and the last recorded dataset counts. Update it after
each long-running download or training milestone; this document is the stable transition guide.

## 3. Architecture

```text
Browser (React/Vite)
  - file chooser, drag-and-drop, preview, health state, result cards
             |
             | Vite /api proxy in development
             v
FastAPI backend
  - extension and size validation
  - temporary-file lifecycle
  - /api/health and /api/predict
             |
             v
Audio pipeline
  - decode with librosa; ffmpeg fallback for formats such as M4A
  - mono, 16 kHz, silence trim, peak normalisation
  - 4-second windows; maximum 60 seconds analysed
             |
             v
Feature pipeline
  - frozen facebook/wav2vec2-base, hidden layer 6
  - 80 log-mel + 20 MFCC spectral features
             |
             v
FakeAudioLCNN
  - Wav2Vec2 projection + spectral features
  - Max-Feature-Map convolution blocks
  - bona-fide/spoof logits
             |
             v
JSON verdict with aggregate and per-segment probabilities
```

## 4. Repository map

| Path | Responsibility |
|---|---|
| `backend/app/config.py` | Shared sample-rate, segment, upload, model, and CORS settings |
| `backend/app/preprocess.py` | Decode, resample, trimming, validation, normalisation, segmentation |
| `backend/app/features.py` | Wav2Vec2 embeddings and log-mel/MFCC features |
| `backend/app/model.py` | LCNN and MFM layers |
| `backend/app/inference.py` | Checkpoint validation, model loading, prediction orchestration |
| `backend/app/main.py` | FastAPI lifecycle, CORS, upload validation, API endpoints |
| `backend/train.py` | Dataset discovery, cached features, training, EER/accuracy, checkpoint export |
| `backend/fetch_asvspoof_subset.py` | Balanced English ASVspoof subset downloader |
| `backend/fetch_indic_subset.py` | Kathbath and IndicSynth downloader with resumable manifests |
| `frontend/src/App.jsx` | Upload flow, health state, analysis request, result rendering |
| `frontend/src/App.css` | Layout, responsive styles, colours, focus states |
| `frontend/vite.config.js` | Development server and backend proxy |
| `README.md` | User-facing setup and project overview |
| `PROGRESS.md` | Historical progress and download notes |
| `PROJECT_HANDOFF.md` | This completion and transition guide |

## 5. Environment setup

Requirements:

- Python 3.11 or newer;
- Node.js 18 or newer;
- `ffmpeg` available on `PATH` for M4A/AAC fallback decoding;
- enough disk space for datasets, feature caches, and Wav2Vec2 weights.

Create the backend environment:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Install the frontend:

```powershell
cd frontend
npm install
```

The repository ignores `backend/.venv`, `frontend/node_modules`, `frontend/dist`, and `data/`.
Never commit Hugging Face tokens, downloaded audio, feature caches, or local environment files.

## 6. Data and training runbook

### 6.1 Dataset scope

The planned languages are English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, and
Bengali.

- English uses ASVspoof 2019 LA bona-fide and spoof audio.
- Indian-language bona-fide speech uses Kathbath.
- Indian-language generated speech uses IndicSynth.
- Indian-language splits are intended to be speaker-disjoint: 70% train, 15% dev, 15% test.
- English evaluation uses an ASVspoof split with attack types not seen during training.

Do not silently mix speakers across train, dev, and test. Dataset identity must not become a
shortcut for the classifier, especially because real and generated Indian-language clips are
intended to share the same speaker pool.

### 6.2 Access and downloads

Kathbath requires the dataset terms to be accepted on Hugging Face and a local Hugging Face
login. Enter tokens interactively and never store them in this repository.

```powershell
cd backend
.venv\Scripts\Activate.ps1
python fetch_asvspoof_subset.py --out ..\data\LA
python fetch_indic_subset.py --out ..\data\indic --kind fake
python fetch_indic_subset.py --out ..\data\indic --kind real
```

The downloaders write manifests and can resume. If rate limiting or network failures occur,
rerun the same command rather than deleting partial data. Record final counts by language,
label, split, and speaker in `PROGRESS.md`.

### 6.3 Training

Run training from `backend`:

```powershell
python train.py --asvspoof-root ..\data\LA --indic-root ..\data\indic
```

Useful optional arguments are `--cache-dir`, `--epochs`, `--patience`, `--batch-size`, `--lr`,
and `--seed`. The default feature cache is `data/cache`; the checkpoint is:

```text
backend/checkpoints/fakeaudio_lcnn.pt
```

Training discovers available data, preprocesses one 4-second segment per item, computes and
caches frozen Wav2Vec2/spectral features, trains the LCNN, selects the best dev epoch, evaluates
the test split, and stores pipeline settings plus metrics in the checkpoint.

Copy actual EER, accuracy, counts, and per-language results from the training output into
`PROGRESS.md` and the final report. Do not report target values as measured results.

## 7. Backend handoff

### 7.1 Runtime settings

Important values in `backend/app/config.py`:

| Setting | Current value | Meaning |
|---|---:|---|
| `SAMPLE_RATE` | 16,000 | Wav2Vec2 and spectral sample rate |
| `SEGMENT_SECONDS` | 4.0 | Classifier input window |
| `MIN_SPEECH_SECONDS` | 0.5 | Minimum post-trim speech duration |
| `MAX_ANALYSED_SECONDS` | 60.0 | Maximum duration analysed |
| `MAX_UPLOAD_MB` | 20 | Maximum request file size |
| `W2V_MODEL_NAME` | `facebook/wav2vec2-base` | Frozen feature extractor |
| `W2V_LAYER` | 6 | Hidden layer used for embeddings |

For a deployed frontend, set `FAKEAUDIO_CORS_ORIGINS` to a comma-separated list of allowed
origins. Do not use a wildcard origin for a public deployment without a security review.

### 7.2 API contract

`GET /api/health` returns model readiness, a load message, model name, and checkpoint metrics
when available. It must remain useful when the checkpoint is missing or invalid.

`POST /api/predict` accepts a multipart field named `file`. Supported extensions are `.wav`,
`.flac`, `.mp3`, `.ogg`, and `.m4a`. The response contains a label, verdict, confidence,
aggregate probabilities, per-segment probabilities, audio metadata, and processing time.

| Status | Expected behaviour |
|---:|---|
| 400 | Empty, corrupt, unreadable, silent, or too-short audio |
| 413 | File is larger than 20 MB |
| 415 | Unsupported extension |
| 503 | No trained checkpoint, incompatible checkpoint, or model unavailable |
| 500 | Unexpected error; details go to the backend log, not the client |

The current verdict threshold is `spoof_probability >= 0.5`. This is a baseline decision rule,
not a calibrated fraud probability. Calibrate it only after a held-out validation set exists.

### 7.3 Backend work remaining

- Add tests for preprocessing, segmentation, model mismatch, missing checkpoint, and API codes.
- Test a corrupt checkpoint without downloading model weights.
- Add request IDs and structured logs before public deployment.
- Consider a bounded inference queue for concurrent uploads; Wav2Vec2 inference is CPU-heavy.
- Decide whether checkpoints are distributed separately or stored with Git LFS/object storage.
- Do not commit a large or license-restricted artifact without an explicit decision.

## 8. Frontend handoff

### 8.1 Current behaviour

The frontend checks backend health, validates the same five extensions and 20 MB limit, supports
click/drag-and-drop/keyboard upload, previews audio locally, shows processing state, renders
verdict/probabilities/segments/metadata, refreshes health after failures, and displays the
authenticity disclaimer.

The Vite development proxy sends `/api` to `http://127.0.0.1:8000`.

### 8.2 Frontend work remaining

- Add component tests for validation, keyboard activation, health, loading, errors, and results.
- Verify narrow mobile layouts with long filenames and language lists.
- Add a visible retry action for a temporarily unavailable backend.
- Consider deriving frontend limits from a backend contract so rules cannot drift.
- Confirm screen-reader status updates are not duplicated during a request.
- Add a production hosting guide if frontend and backend are deployed separately.

## 9. Local run and verification

Start the backend:

```powershell
cd backend
.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173` and verify:

1. the health banner explains whether the checkpoint is loaded;
2. valid audio can be selected and previewed;
3. invalid extension and oversized files are rejected before upload;
4. a trained model returns verdict and segment details;
5. invalid, silent, short, and corrupt files display backend errors;
6. keyboard-only upload works with Tab, Enter, and Space;
7. the page remains usable at a narrow viewport.

Run lightweight checks before handoff:

```powershell
cd backend
.venv\Scripts\python.exe -m compileall -q app train.py fetch_asvspoof_subset.py fetch_indic_subset.py
cd ..\frontend
npm run build
```

## 10. Completion milestones

### Milestone A - Reproducible data

- [ ] All intended language manifests exist with documented counts.
- [ ] Train/dev/test speaker separation is verified.
- [ ] Dataset access and licence notes are recorded.
- [ ] No tokens, audio, caches, or virtual environments are tracked.

### Milestone B - Measured baseline

- [ ] Training completes from the documented command.
- [ ] `fakeaudio_lcnn.pt` loads with current pipeline settings.
- [ ] Overall and per-language EER/accuracy are recorded.
- [ ] Checkpoint date, code revision, and training arguments are recorded.

### Milestone C - Tested product

- [ ] Backend unit and API tests pass.
- [ ] Frontend component tests pass.
- [ ] Trained-model browser demo passes the validation matrix.
- [ ] Errors do not leak filesystem paths, tokens, or stack traces.
- [ ] Accessibility and responsive checks pass.

### Milestone D - Supervised release

- [ ] Threshold calibration and held-out evaluation are complete.
- [ ] External datasets are evaluated or explicitly out of scope.
- [ ] Deployment, logging, resource limits, and rollback are documented.
- [ ] README, progress notes, report, and this handoff agree on measured status.
- [ ] The demo states that detection is probabilistic, not authentication proof.

## 11. Risks and decisions for the next owner

| Risk or decision | Recommended handling |
|---|---|
| Slow CPU feature extraction | Keep Wav2Vec2 frozen for the baseline and cache features |
| Dataset access/rate limiting | Use resumable manifests and interactive login |
| Dataset shortcut learning | Preserve speaker-disjoint splits and inspect source counts |
| Unseen generators/codecs | Evaluate external data before making accuracy claims |
| Checkpoint distribution | Use a documented artifact store or Git LFS after review |
| Concurrent uploads | Add a bounded queue and monitoring before public exposure |
| Confidence interpretation | Calibrate on held-out data; call it a score until then |
| Public deployment | Restrict CORS, add auth/rate limits, cap resources, and log request IDs |

## 12. Git handoff convention

- Preserve existing published history; do not rewrite commits just to add attribution.
- Keep datasets, caches, environments, tokens, and build output out of commits.
- For Codex-created commits in this project, retain the human author and append:

```text
Co-authored-by: Codex <noreply@openai.com>
```

