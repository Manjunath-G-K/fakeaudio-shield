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

1. **The chat.** Shield greets you and explains what to do. The header shows *online* when the
   backend is up. On a wide screen the right panel shows how reliable Shield is for the current language.
2. **Pick a language** with the chip at the bottom left. Shield posts a line with that
   language's status and accuracy. English uses the English specialist; the others use the
   multilingual model.
3. **Send a mystery test clip:** tap the inbox icon, listen to *Mystery clip A/B*, guess, then
   **Send**. Shield replies with a verdict and only then reveals whether the clip was really
   real or AI. All test clips are from speakers the model never heard. A good order:
   - *Hindi → clip B (AI)*: **Sounds AI-generated**, then "Correct: this test clip really is AI-generated".
   - *English → the neural text-to-speech clip (A10)*: caught only just, at about 50% with low
     confidence. A10 is the model's known weak spot: on the test set it catches only about a third of A10 clips.
4. **Read the verdict.**
   - The meter shows where the clip sits between real and AI.
   - Each 4-second part has its own score; tap a part to hear it.
   - **Play the most AI-like part** jumps the voice note to the most suspicious stretch, which turns red on its waveform.
   - **Share verdict card** creates an image of the result.
5. **Ask Shield** with the chips: *How accurate are you?* gives the live per-language
   numbers; *What can't you catch?* gives the honest limits.
6. **Record:** tap the microphone. A live spectrogram draws while you speak. Tap send. Shield
   warns that live microphone audio is less reliable. Test the microphone on the demo machine first.
7. **Upload:** tap the paperclip, or drag a file onto the chat. A broken or silent file gets a
   clear error message instead of a guess.
8. **Report** (top right): *How Shield was tested*.
   - Overall numbers.
   - Each language with its error rate and 95% interval on a small number line; tap a language for details and per-generator catch rates.
   - Where Shield struggles, the training data and licences, both models, the learning curve and the method.

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
