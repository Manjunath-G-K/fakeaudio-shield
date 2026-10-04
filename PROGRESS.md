# FakeAudio Shield: Progress Notes

_Last updated: 4 Oct 2026, 09:05. Work is paused; nothing is running in the background._

## Summary

| Area | Status |
|---|---|
| Backend (FastAPI): preprocessing, Wav2Vec2 + MFCC/log-mel, LCNN, API, error handling | ✅ Done and tested |
| Frontend (React): upload, preview, verdict, confidence, probabilities, errors, per-language results | ✅ Done and tested (no-model state) |
| English data: ASVspoof 2019 LA subset (2,500 train / 800 dev / 800 eval) | ✅ Downloaded |
| Indian-language fake speech: IndicSynth, 300 clips × 7 languages | 🟡 501 / 2,100 (Hindi 300, Kannada 201) |
| Indian-language real speech: Kathbath, 300 clips × 7 languages | ⛔ Not started: waiting for Hugging Face login |
| Feature extraction (Wav2Vec2 + spectral) | 🟡 343 / ~8,300 clips cached |
| Model training + measured EER | ⛔ Not started |
| End-to-end test with the trained model | ⛔ Not started |

**No trained model exists yet.** Until one does, the app does not guess: the API returns
HTTP 503 "No trained model found" and the web page shows that message.

## Decisions taken

1. **Built from the PPT.** There was no earlier code or trained checkpoint, so the project
   follows the pipeline on PPT slides 5–6.
2. **Wav2Vec2 is frozen, not fine-tuned.** The laptop is CPU-only (i3, 8 GB RAM), so
   Wav2Vec2 (layer 6 of `facebook/wav2vec2-base`) is a fixed feature extractor and only
   the LCNN is trained.
3. **Languages:** English + Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali.
4. **Data sources:**
   - English: ASVspoof 2019 LA (real + fake, same source).
   - Indian languages: **Kathbath** (real, CC BY 4.0) + **IndicSynth** (fake, CC BY-NC 4.0).
     IndicSynth clones Kathbath/IndicSUPERB speakers, so real and fake clips come from the
     same speaker pool. This stops the model from learning "which dataset is this"
     instead of "real or fake".
5. **Download only samples.** The internet here is slow (~250 KB/s) and drops often, so
   only small balanced samples are fetched, never the full datasets (7 GB to 845 GB).
6. **Honest testing.** Indian-language clips are split by speaker (70% train / 15% dev /
   15% test), so test speakers are never heard in training. English test = ASVspoof eval,
   which contains attack types the model never sees in training.

## To resume

### 1. Hugging Face login (needed for Kathbath; you must do this yourself)

The earlier attempt failed: the pasted token picked up a non-English character (`à`).
In PowerShell, one line at a time:

```powershell
$t = (Read-Host "Paste token").Trim()
"$($t.Substring(0,3))... length $($t.Length)"     # must start with hf_
& "C:\Users\manju\AppData\Local\Programs\Python\Python313\Scripts\hf.exe" auth login --token $t
Remove-Variable t; Clear-Host
```

Make sure the Kathbath terms are accepted at
https://huggingface.co/datasets/ai4bharat/Kathbath before logging in.

### 2. Finish the downloads (both resume where they stopped)

```powershell
cd D:\FakeAudio\backend
.venv\Scripts\python fetch_indic_subset.py --out ..\data\indic --kind fake
.venv\Scripts\python fetch_indic_subset.py --out ..\data\indic --kind real
```

The two commands can run at the same time in separate terminals. Hugging Face
rate-limits requests (HTTP 429), so progress comes in bursts. Expect about 26 clips/min,
so roughly **1 hour for the remaining fake clips** and **70–90 minutes for the real clips**.

### 3. Train (resumes the feature cache)

```powershell
cd D:\FakeAudio\backend
.venv\Scripts\python train.py
```

Feature extraction takes about 45 minutes and training about 20–30 minutes. This
writes `backend/checkpoints/fakeaudio_lcnn.pt`, with overall and per-language EER.

### 4. Remaining work after training

- Run the demo end to end with real and fake clips in several languages, plus invalid files.
- Update the README for the multilingual setup (it still describes the English-only
  version) and add the measured per-language EER.
- Commit the checkpoint so teammates can run the demo without training (it's a few MB).
- If some Indian languages score poorly, consider a multilingual front end (wav2vec2
  XLS-R or IndicWav2Vec). That would be about 2–3× slower on this laptop.

## Remaining time estimate (from a successful login)

| Step | Time |
|---|---|
| Downloads (fake + real together) | ~1.5 h |
| Feature extraction | ~45 min |
| Training | ~20–30 min |
| Testing + README + commit | ~15 min |
| **Total** | **≈ 2.5–3 h** |

## Data on disk (not in git)

| Folder | Content | Size |
|---|---|---|
| `data/LA` | ASVspoof 2019 LA subset | 253 MB |
| `data/indic` | IndicSynth clips + `manifest_fake.csv` | 201 MB |
| `data/cache` | Cached Wav2Vec2 + spectral features | 114 MB |
