# FakeAudio Shield: demo walkthrough

A 6-minute walkthrough for presenting the project. Set-up is in the [README](../README.md).

## Before you start

1. Start the backend and wait for `FakeAudio Shield: Model ready` (about 20 s).
2. Start the frontend (or open the single-process deployment on port 8000).
3. The top-right badge should say **Detector online**. If it says **Offline**, the backend is
   not running and a banner explains what to do.
4. Run one check before the audience arrives: the first request takes about 6 s (warm-up),
   later ones about 2 s.

## Walkthrough

1. **Choose a language** in step 1 of the checker card. The coloured dot shows its measured
   status (green = supported, amber = experimental). The language also picks the model:
   English uses the English specialist; the others use the multilingual model.
2. **Try a sample** (step 2). Every sample is from a test split, so the model never heard it.
   **Use → ▶ listen → Check this voice.** A good order:
   - *Hindi → Real person*: **Likely a real human voice**.
   - *Hindi → AI voice*: **Likely AI-generated**.
   - *English → AI voice: neural text-to-speech* (attack A10): caught only just, at about
     50% with low confidence. A10 is the model's known weak spot: on the test set it catches
     only about a third of A10 clips. Use it to explain that detectors struggle with
     generators they never trained on.

   All 15 samples are currently classified correctly. Kannada and Telugu real voices are
   borderline (about 52%) and are shown as low confidence.
3. **Read the result:** the gauge shows the chance of AI, the timeline shows each 4-second
   part, the badge shows which model answered, and a note gives the measured accuracy for
   that language.
4. **Record:** tap the mic, speak for 5–15 s, stop, listen, check. The result warns that live
   microphone audio is less reliable. Test the microphone on the demo machine first.
5. **Upload:** drag in a file. A broken or silent file gets a clear error instead of a guess.
6. **Language coverage** (scroll down): six languages, each with its accuracy ring, EER,
   number of test clips and speakers.
7. **Results page**, top to bottom:
   - summary numbers and the per-language EER chart with 95% confidence intervals
   - the table with model, status and recording-condition check per language
   - per-attack bars (A10 is the weak spot)
   - *Languages that need more work*, with the reason
   - the dataset audit, licences, both models and their training
   - **How much data is enough?** Test EER stops improving after about 1,250 English
     clips, which is why the project uses a few thousand balanced clips, not 100,000.

**Microphone notes:** the browser asks for permission the first time. The mic only works on
`localhost` or over HTTPS. Recording captures raw audio with noise suppression and echo
cancellation switched off, because that processing alters the voice in ways a detector can
mistake for AI.

## How it works, in simple words

1. **Input:** a WAV, FLAC, MP3, OGG or M4A file (max 20 MB) or a microphone recording.
2. **Clean-up:** converted to one channel at 16,000 samples per second, silence trimmed,
   volume normalised, cut into 4-second parts. Broken, silent or too-short files are rejected.
3. **Listening:** for every 20 ms of audio the system computes
   - a **log-mel spectrogram and MFCCs**, the classic frequency fingerprint of a sound, and
   - **Wav2Vec2** features: 768 numbers from a model pre-trained on 960 hours of speech, used
     frozen because the project runs on a CPU.
4. **Deciding:** a Light CNN (LCNN, the standard ASVspoof baseline) scores each part as real
   or AI. The scores are combined, weighted by how much speech each part holds.
5. **Calibration:** the cut-off was chosen on the dev split, where false alarms equal misses,
   and is shown as 50%. **Confidence** is the calibrated score of the chosen answer.

## Questions you may be asked

- **Why Wav2Vec2?** It has heard a lot of real speech, so it captures fine details of human
  voices that synthetic speech often gets slightly wrong.
- **Why LCNN?** It is small and fast and was a strong baseline in the ASVspoof challenges.
- **Why frozen instead of fine-tuned?** Fine-tuning 95 million parameters is not feasible on a
  CPU. With a GPU the same code can be extended to fine-tune.
- **Why two models?** On the English **dev** set, a model trained only on English scored
  2.0% EER against 8.9% for the shared multilingual model, so English is routed to it. The
  choice was made on dev data, never on test data.
- **How reliable are the Indian-language scores?** Very high, but the test sets are small
  (3–22 speakers), use the same generator families as training, and a recording-condition
  check shows real and AI clips partly differ in recording quality. That is why the
  statuses are cautious.
- **Limitations?** New voice generators, phone calls, noise or music can reduce accuracy. The
  result supports human judgement; it is not proof.
