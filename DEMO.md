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

The top-right of the page should show a green **Ready** badge. If it says **Offline** (red),
the backend is not running or the model file is missing, and a banner explains what to do.

## 2. What to show

**Suggested walkthrough (about 6 minutes).** The top bar has two pages, **Try it** and
**Results**. The green **Ready** badge means the backend is up.

1. **Try it → Try a sample.** Pick a language in the selector above the card. Each Indian
   language has one real and one AI clip from its test set; English has five. For each clip:
   **Use → ▶ listen → Check this voice**. Good order:
   - *Hindi → Real person* → **Likely a real human voice**, correct
   - *Hindi → AI voice* → **Likely AI-generated**, correct
   - *English → AI voice: neural text-to-speech* → judged **real: a miss**. This generator
     type (A10) is the model's weak spot: it's caught only about a third of the time on the
     test set.

   Expect 14 of the 15 sample clips to be correct. The Kannada and Telugu real voices are
   borderline (about 52%) and are shown as "low confidence".

   Each result also says how reliable the model is **for the selected language**, using the
   measured numbers. **Your recent checks** lists the runs side by side.
2. **Language coverage** (scroll down): six languages with measured accuracy rings.
   - **Supported:** Hindi, Tamil, Telugu
   - **Experimental:** English, Kannada, Malayalam (Malayalam because only 3 test speakers)
   - **In progress:** Marathi and Bengali

   Nothing is claimed without evaluation.
3. **Record:** tap the mic, speak for 5–15 s, stop, ▶ listen, **Check this voice**. The result
   warns that live mic audio is less reliable: the model learned from studio-quality audio.
   *Test the mic on the demo laptop beforehand.*
4. **Upload:** drag in any file. A broken or silent file shows a friendly error.
5. **Results page:** walk top to bottom:
   - the summary numbers
   - the per-language EER chart with 95% confidence intervals and the support rule
   - the per-attack bars (A10 is the weak spot)
   - *Languages that need more work*
   - the dataset audit with cleaning counts and licences
   - the training curve
   - **How much data is enough?** The learning curve shows test EER stops improving after
     about 1,250 clips. That's why the project uses a few thousand balanced clips, not 100,000.

**Microphone notes:** the browser asks for permission the first time; click Allow. The mic
only works at `http://localhost:5173` (or over https), not via the laptop's network IP.
Recording captures raw audio with noise suppression and echo cancellation switched off,
because that processing alters the voice in ways a detector can mistake for AI.

The same clips also exist as files in `D:\FakeAudio\data\demo_samples` (for uploading by hand).
They are from the ASVspoof 2019 **evaluation** set: the model never saw these speakers or
these fake-voice systems during training.

| File | Result (current model) | What it demonstrates |
|---|---|---|
| `real_1_….flac`, `real_2_…`, `real_3_…` | REAL / Bona-fide | Genuine human speech |
| `fake_A13_….flac` | AI-GENERATED, 96.6% | Combined TTS + voice-conversion system |
| `fake_A17_….flac` | AI-GENERATED, 99.1% | Voice conversion (VAE + waveform filtering) |
| `fake_A10_….flac` | **REAL, 71.9%: a miss** | Neural TTS (Tacotron 2 + WaveRNN). Show this deliberately as the limitation (see below). |
| `real_1_as_mp3.mp3` | REAL, 89.1% | Other formats work (MP3, 44.1 kHz → resampled to 16 kHz) |
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

The measured results per language are on the **Results** page and in `RESULTS.md`, both
generated from the model's evaluation report.

In one sentence for the guide: *"It's evaluated on six languages with speakers it never
heard. The Indian languages score very high, but their test sets are small and their real
and AI recordings differ in quality, so we label those results cautiously. English is
tested against 13 voice generators it never saw, and some of those still slip through."*

## 5. Questions the guide may ask

- **Why Wav2Vec2?** It is pre-trained on lots of real speech, so it captures fine
  details of human voices that synthetic speech often gets slightly wrong.
- **Why LCNN?** It is small and fast and was a strong baseline in the ASVspoof
  challenges. Max-Feature-Map lets it keep only the most useful features.
- **Why frozen instead of fine-tuned (the PPT said fine-tune)?** CPU-only laptop.
  Fine-tuning 95 million parameters is not feasible here. With a GPU, the same code can
  be extended to fine-tune.
- **Does it work for Indian languages?** Yes, five are evaluated: Hindi, Tamil and Telugu
  are supported; Kannada and Malayalam are experimental. Real speech is from Kathbath, AI
  speech from IndicSynth, split by speaker. The honest caveat: the test sets are small, and
  a recording-condition check shows the two sources partly differ by recording quality.
- **Why did English get worse?** The multilingual model shares one small classifier across
  six languages. An English-only model trained earlier reached 7.8% EER; the multilingual
  one has about 16%.
- **How long did training take?** About 25 minutes on this laptop's CPU (6 epochs; the
  best was epoch 3). Wav2Vec2 features are computed once and cached.
- **Limitations?** It is trained on a subset (2,500 clips). New voice cloners, phone
  calls, noise or music can reduce accuracy. The result supports human judgement and is
  not proof.
