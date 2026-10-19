# FakeAudio Shield: measured results

_Generated from `backend/checkpoints/report.json` (2026-10-19T12:32:03). Do not edit by hand: run `python make_results_md.py`._

## Language support

| Language | Status | Test EER (95% CI) | Accuracy (95% CI) | Real passed | AI caught | Test clips (real + AI) | Test speakers |
|---|---|---|---|---|---|---|---|
| English | **experimental** | 7.80% (6.5–10.4%) | 90.5% (88.3–92.4%) | 384/391 | 324/391 | 391 + 391 | 67 |
| Hindi | not supported | – | – | – | – | – | – |
|  | _no real human speech yet (Kathbath download pending); 300 AI-generated clips ready_ | | | | | | |
| Kannada | not supported | – | – | – | – | – | – |
|  | _no real human speech yet (Kathbath download pending); 300 AI-generated clips ready_ | | | | | | |
| Tamil | not supported | – | – | – | – | – | – |
|  | _no real human speech yet (Kathbath download pending); 300 AI-generated clips ready_ | | | | | | |
| Telugu | not supported | – | – | – | – | – | – |
|  | _no real human speech yet (Kathbath download pending); 300 AI-generated clips ready_ | | | | | | |
| Malayalam | not supported | – | – | – | – | – | – |
|  | _no real human speech yet (Kathbath download pending); 300 AI-generated clips ready_ | | | | | | |
| Marathi | not supported | – | – | – | – | – | – |
|  | _no data collected yet_ | | | | | | |
| Bengali | not supported | – | – | – | – | – | – |
|  | _no data collected yet_ | | | | | | |

Status rule: supported: upper 95% bound of test EER <= 10%; experimental: test EER <= 25%; otherwise not supported.

Test conditions:

- **English**: ASVspoof 2019 LA evaluation set: unseen speakers and 13 voice-generation systems (A07-A19) never seen in training.

## Metric definitions

- **eer**: Equal error rate: the operating point where the share of real voices flagged as fake equals the share of fakes passed as real. Lower is better; threshold-independent.
- **accuracy**: Share of test clips classified correctly at the calibrated threshold (chosen on dev, never on test). Test sets are class-balanced.
- **real passed**: Share of real voices classified as real.
- **fake caught**: Share of AI-generated voices classified as AI-generated.
- **ci**: 95% intervals: bootstrap (500 resamples) for EER, Wilson score for proportions.
- **support rule**: supported: upper 95% bound of test EER <= 10%; experimental: test EER <= 25%; otherwise not supported.

## Per-attack / per-generator detection (test set)

**English**: A07 20/28, A08 29/30, A09 27/30, A10 10/31, A11 24/29, A12 28/31, A13 30/30, A14 26/31, A15 25/31, A16 24/30, A17 30/30, A18 27/30, A19 24/30

## Dataset

5600 clips collected, 4074 kept after cleaning and balancing.

| Language | Train (real + AI) | Dev | Test | Hours | Sources |
|---|---|---|---|---|---|
| English | 1247 + 1247 (20 spk) | 399 + 399 (20 spk) | 391 + 391 (67 spk) | 3.85 | ASVspoof 2019 LA |

Removed during cleaning:

- duration outside 1.0-60.0 s: 13
- language not usable yet (missing real or AI clips): 1500
- class balancing (down-sampled): 13

Sources and licences:

- [ASVspoof 2019 LA](https://datashare.ed.ac.uk/handle/10283/3336): ODC-By 1.0
- [Kathbath](https://huggingface.co/datasets/ai4bharat/Kathbath): CC BY 4.0
- [IndicSynth](https://huggingface.co/datasets/vdivyasharma/IndicSynth): CC BY-NC 4.0

- No source has 1,000,000 or more records; nothing needed removing for size.
- Audio is standardised at load time (16 kHz mono, silence trimmed, peak-normalised); transcripts are not used, so no text normalisation is applied.
- Splits are speaker-disjoint (checked above). ASVspoof test = eval set with attacks A07-A19 unseen in training.

## Model and training

- Speech model: facebook/wav2vec2-base, transformer layer 6, frozen (768 values / 20 ms)
- Spectral features: 80 log-mel + 20 MFCC per 20 ms (Librosa)
- Classifier: Light CNN with Max-Feature-Map, 2 classes (330,146 trainable parameters, arch {'proj_dim': 128, 'time_pool': 1})
- Input: 4.0 s segments, scores averaged; threshold P(AI) ≥ 0.5
- Training: 3 epochs (best 3), 39 min on CPU, AdamW (weight decay 1e-4), lr 0.0003, batch 32
- Balancing: class-weighted loss (English only)
- Model selection: lowest dev EER; run stopped after epoch 3 because each epoch took 9-20 min on this CPU

## How much training data is needed? (learning curve)

fast LCNN (proj 64, time-pool 2), Wav2Vec2 frozen; 5 epochs; Same seed and test set for every size; the best epoch is picked on dev.

| Training clips | Dev EER | Test EER |
|---|---|---|
| 248 | 35.0% | 38.6% |
| 622 | 10.4% | 18.4% |
| 1,246 | 5.1% | 10.1% |
| 2,494 | 3.8% | 10.2% |
