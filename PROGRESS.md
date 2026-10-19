# FakeAudio Shield: Progress Notes

_Last updated: 19 Oct 2026. Measured numbers live in [RESULTS.md](RESULTS.md) (generated), not here._

## Status

| Area | Status |
|---|---|
| Backend API (`/api/health`, `/api/report`, `/api/data-size-study`, `/api/predict`) | ✅ Done, tested |
| Dataset pipeline: dedupe, validation, speaker-disjoint splits, balancing, audit report | ✅ Done (`prepare_dataset.py`) |
| One-command reproduction (`run_pipeline.py`) | ✅ Done |
| English model: Wav2Vec2 (frozen) + LCNN, dev-calibrated threshold | ✅ Trained, evaluated on 782 unseen clips; status **experimental** |
| Learning-curve study (how many clips are needed) | ✅ Done (`data_size_study.py`) |
| Website: Try-it page (record / upload / samples, language selector) + Results page | ✅ Done, checked on desktop and at 375 px |
| Automated tests | ✅ 15/15 passing (`pytest`) |
| Indian languages (Hindi, Kannada, Tamil, Telugu, Malayalam) | ⛔ **Blocked:** 1,500 AI clips ready, but **0 real clips**. Kathbath needs a Hugging Face login, and no token has reached this machine. |
| Marathi, Bengali | ⛔ No data collected |

## To add the Indian languages (manual step, then automatic)

1. Accept the terms at https://huggingface.co/datasets/ai4bharat/Kathbath and create a Read token.
2. Log in on this laptop (PowerShell, one line at a time):
   ```powershell
   $t = (Read-Host "Paste token").Trim()
   & "C:\Users\manju\AppData\Local\Programs\Python\Python313\Scripts\hf.exe" auth login --token $t
   Remove-Variable t
   ```
   Check: `Test-Path $HOME\.cache\huggingface\token` must print `True`.
3. Run the pipeline. It downloads the real speech (roughly 60–90 min on this connection),
   cleans the data, trains and evaluates every language, and regenerates RESULTS.md:
   ```powershell
   cd D:\FakeAudio\backend
   .venv\Scripts\python run_pipeline.py --languages Hindi Kannada Tamil Telugu Malayalam
   ```
4. Restart the backend. The website shows the new languages and their measured results automatically.

## Decisions taken

- **Frozen pretrained Wav2Vec2 + small LCNN**, not fine-tuning. The laptop is CPU-only; this is the lightweight-adaptation route.
- **A few thousand balanced clips, not 100,000.** The learning curve shows test EER stops improving after about 1,250 English clips. What's missing is variety of voice generators, not volume.
- **Two LCNN sizes compared on the same test set.** The original (128-d, full time resolution) had the lower EER, so it ships for English. The 3.6× faster variant is the default for multilingual retraining (`--proj-dim 128 --time-pool 1` selects the original).
- **Threshold calibrated on dev** (equal-error point). AI-caught rose from 63% to 83% with real-voice pass rate still about 98%, and EER unchanged.
- **No language is claimed without a measured, speaker-disjoint test.**
