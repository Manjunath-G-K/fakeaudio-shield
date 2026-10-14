# FakeAudio Shield: Demo Guide

## 1. Start it (2 windows)

Double-click in `D:\FakeAudio`:

1. **`start-backend.bat`**. Wait until it prints `FakeAudio Shield: Model ready` (about 20 s).
2. **`start-frontend.bat`**. The browser opens http://localhost:5173 by itself.

Or type the commands yourself:

```powershell
# window 1: backend
cd D:\FakeAudio\backend
.venv\Scripts\activate
uvicorn app.main:app --port 8000

# window 2: frontend
cd D:\FakeAudio\frontend
npm run dev
```

The top of the page should show a green line: **"Wav2Vec2 (wav2vec2-base, frozen) + LCNN ready · test EER …"**.
If it is red, the backend is not running or the model file is missing.

## 2. What to show

**Suggested walkthrough of the website (about 5 minutes):**

1. **Hero**: the problem in one line, with the live "Model online" badge in the top bar.
2. **Detector**: click the sample buttons. No file dialog is needed. Each sample shows the
   verdict, a confidence ring, the waveform, and the **ground truth**, so a correct answer
   and a miss are both visible:
   - *Real voice* → REAL ✓
   - *AI voice: Voice conversion (A17)* → AI-GENERATED ✓
   - *AI voice: Neural TTS (A10), hard case* → REAL ✗. This is the honest limitation.
   Then drag in a file of your own, or a broken one, to show the error handling.
3. **How it works**: the six pipeline steps.
4. **Results**: the live dev and test numbers, and the limitations box.
5. **Use cases → Roadmap** (Indian languages in progress) **→ Team → FAQ**.

The same clips also exist as files in `D:\FakeAudio\data\demo_samples` (for uploading by hand).
They are from the ASVspoof 2019 **evaluation** set: the model never saw these speakers or
these fake-voice systems during training.

| File | Expected result | What it demonstrates |
|---|---|---|
| `real_1_….flac`, `real_2_…`, `real_3_…` | REAL / Bona-fide | Genuine human speech |
| `fake_A13_….flac` | AI-GENERATED, 98.5% | Combined TTS + voice-conversion system |
| `fake_A17_….flac` | AI-GENERATED, 99.8% | Voice conversion (VAE + waveform filtering) |
| `fake_A10_….flac` | **REAL, 90.7%: a miss** | Neural TTS (Tacotron 2 + WaveRNN). Show this deliberately as the limitation (see below). |
| `real_1_as_mp3.mp3` | REAL, 99.5% | Other formats work (MP3, 44.1 kHz → resampled to 16 kHz) |
| `invalid_not_audio.wav` | Error: "Could not decode the file as audio" | Invalid files are handled |
| `invalid_silent.wav` | Error: "The audio is silent" | Silence is rejected, not guessed |

The real clips score 99.6–99.8% REAL. All results above were checked through the running
web page and API.

**Tip:** the first analysis after starting the backend takes about 7 s (model warm-up);
later ones take about 1 s. Analyse one file before your guide arrives.

**About the A10 miss:** A10 is a modern neural TTS voice that is not in the training data.
Missing it is an honest example of the main limitation. Detectors only reliably catch
the kinds of fakes they have learned from, which is why the test set uses unseen attacks.

Steps for each file: **Choose file → (optionally play it) → Analyse → read the verdict,
confidence, probability bars and details.**

## 3. How it works, in simple words

1. **Upload (React web page).** The user picks a WAV, FLAC, MP3, OGG or M4A file (max 20 MB).
   The page checks the type and size, lets you listen to it, and sends it to the backend.
2. **Preprocessing (FastAPI backend).** The audio is converted to one channel at
   16,000 samples per second (what Wav2Vec2 expects). Silence at the start and end is
   cut off, and the volume is normalised so loud and quiet recordings look alike. The
   clip is split into 4-second pieces. Empty, broken, silent or too-short files are
   rejected with a clear message.
3. **Feature extraction.** For every 20 ms of audio we compute:
   - **MFCC + log-mel spectrogram (Librosa):** how the energy is spread over frequencies,
     the classic "fingerprint" of a sound.
   - **Wav2Vec2:** a model pre-trained by Facebook on 960 hours of speech. It turns each
     20 ms into 768 numbers that describe the speech. We use it frozen, as a feature
     extractor, because the laptop has no GPU.
4. **LCNN classifier.** A Light CNN with Max-Feature-Map activations, the standard
   network from the ASVspoof challenge. It looks at all those numbers over time and
   outputs two scores: bona-fide (real) and spoof (AI-generated).
5. **Prediction.** Softmax turns the scores into probabilities. For long clips, the
   spoof probability of each 4-second piece is averaged. Above 50% the verdict is
   AI-generated, otherwise real. **Confidence** is the probability of the chosen class.
6. **Result (React page).** The verdict, confidence %, both probabilities, the
   per-segment scores and the processing time are shown, with the reminder that this
   is a prediction, not proof.

## 4. How we know it works (measured, not assumed)

- Trained on 2,500 ASVspoof 2019 LA clips (1,250 real + 1,250 fake, attacks A01–A06).
- The best training round was chosen on a separate **dev** set (800 clips).
- Tested once on the **eval** set (800 clips) with **13 attack types (A07–A19) that never
  appear in training**: this is the honest "new fake generator" test.
- Metric: **Equal Error Rate (EER)**, the point where false alarms equal misses. Lower is better.

Measured results of the included English model (stopped after epoch 3):

| Split | EER | Real passed | Fake caught (at 50%) |
|---|---|---|---|
| Dev (seen attack types) | 2.00% | 396 / 400 | 364 / 400 |
| **Test (13 unseen attack types)** | **8.25%** | **399 / 400** | **252 / 400 (63%)** |

In one sentence for the guide: *"It almost never calls a real voice fake, and it separates
real from fake well (8.25% EER on unseen attacks). But with the default threshold it
misses about a third of fakes from generators it was never trained on. That's why
more diverse training data is our next step."*

Per-attack detection rates are in the README.

## 5. Questions the guide may ask

- **Why Wav2Vec2?** It is pre-trained on lots of real speech, so it captures fine
  details of human voices that synthetic speech often gets slightly wrong.
- **Why LCNN?** It is small and fast and was a strong baseline in the ASVspoof
  challenges. Max-Feature-Map lets it keep only the most useful features.
- **Why frozen instead of fine-tuned (the PPT said fine-tune)?** CPU-only laptop.
  Fine-tuning 95 million parameters is not feasible here. With a GPU, the same code can
  be extended to fine-tune.
- **Does it work for Indian languages?** The pipeline and data tooling for Hindi,
  Kannada, Tamil, Telugu, Malayalam, Marathi and Bengali are built (IndicSynth fake +
  Kathbath real, split by speaker). The current demo model is **English-only**; the
  multilingual model needs the real-speech download to finish (see `PROGRESS.md`).
- **Why stop after 3 epochs?** Each epoch takes 9–20 minutes on this CPU. Dev EER was
  already 2.00%, and the best epoch is saved automatically. Longer training is possible
  with the same command.
- **Limitations?** It is trained on a subset (2,500 clips). New voice cloners, phone
  calls, noise or music can reduce accuracy. The result supports human judgement and is
  not proof.
