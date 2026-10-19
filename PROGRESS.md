# FakeAudio Shield: Progress Notes

_Last updated: 19 Oct 2026. Measured numbers live in [RESULTS.md](RESULTS.md) (generated), not here._

## Status

| Area | Status |
|---|---|
| Backend API (`/api/health`, `/api/report`, `/api/data-size-study`, `/api/predict`) | ✅ Done, tested |
| Dataset pipeline: dedupe, validation, speaker-disjoint splits, balancing, audit report | ✅ Done (`prepare_dataset.py`) |
| One-command reproduction (`run_pipeline.py`) | ✅ Done |
| Multilingual model: Wav2Vec2 (frozen) + LCNN, dev-calibrated threshold | ✅ Trained on English + 5 Indian languages, evaluated per language on unseen speakers |
| Learning-curve study (how many clips are needed) | ✅ Done (`data_size_study.py`) |
| Website: Try-it page (record / upload / samples, language selector) + Results page | ✅ Done, checked on desktop and at 375 px |
| Automated tests | ✅ 16/16 passing (`pytest`) |
| Indian languages | ✅ Hindi, Tamil, Telugu **supported**; Kannada, Malayalam **experimental** (fewer than 10 test speakers). English **experimental**. |
| Recording-condition check (`shortcut_probe.py`) | ✅ Done. Indian sources partly separable by recording quality alone (12–24% EER), so treat those scores as optimistic |
| Marathi, Bengali | ⛔ No data collected |

## Reproduce everything

Kathbath needs a one-time Hugging Face login (accept the terms, create a Read token, then
`hf auth login`; never paste the token anywhere else). After that:

```powershell
cd D:\FakeAudio\backend
.venv\Scripts\python run_pipeline.py --languages Hindi Kannada Tamil Telugu Malayalam
```

This downloads, cleans, trains, evaluates and regenerates RESULTS.md. Restart the backend afterwards.

## Next steps

- More test speakers for Kannada and Malayalam, so they can qualify as "supported".
- Real speech recorded in the same conditions as the AI clips, to remove the recording-quality shortcut.
- Marathi and Bengali data.
- More voice-generator variety for English (A10-type neural TTS is still missed most of the time).

## Decisions taken

- **Frozen pretrained Wav2Vec2 + small LCNN**, not fine-tuning. The laptop is CPU-only; this is the lightweight-adaptation route.
- **A few thousand balanced clips, not 100,000.** The learning curve shows test EER stops improving after about 1,250 English clips. What's missing is variety of voice generators, not volume.
- **Two LCNN sizes compared on the same test set.** The original (128-d, full time resolution) had the lower EER, so it ships for English. The 3.6× faster variant is the default for multilingual retraining (`--proj-dim 128 --time-pool 1` selects the original).
- **Threshold calibrated on dev** (equal-error point). AI-caught rose from 63% to 83% with real-voice pass rate still about 98%, and EER unchanged.
- **No language is claimed without a measured, speaker-disjoint test.**
