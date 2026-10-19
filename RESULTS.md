# FakeAudio Shield: measured results

_Generated from `backend/checkpoints/report.json` (2026-10-19T19:08:36). Do not edit by hand: run `python make_results_md.py`._

## Language support

| Language | Status | Test EER (95% CI) | Accuracy (95% CI) | Real passed | AI caught | Test clips (real + AI) | Test speakers | Recording check (channel-only EER) |
|---|---|---|---|---|---|---|---|---|
| English | **experimental** | 16.11% (13.0–18.2%) | 84.4% (81.7–86.8%) | 338/391 | 322/391 | 391 + 391 | 67 | 43.7% |
| Hindi | **supported** | 0.00% (0.0–0.0%) | 100.0% (96.3–100.0%) | 50/50 | 50/50 | 50 + 50 | 20 | 24.0% |
| Kannada | **experimental** | 1.67% (0.0–11.7%) | 98.3% (91.1–99.7%) | 30/30 | 29/30 | 30 + 30 | 7 | 13.3% |
| Malayalam | **experimental** | 0.00% (0.0–0.0%) | 100.0% (96.4–100.0%) | 52/52 | 52/52 | 52 + 52 | 3 | 15.4% |
| Tamil | **supported** | 2.44% (0.0–6.1%) | 96.3% (89.8–98.8%) | 38/41 | 41/41 | 41 + 41 | 22 | 15.8% |
| Telugu | **supported** | 0.00% (0.0–0.0%) | 96.9% (84.3–99.5%) | 15/16 | 16/16 | 16 + 16 | 10 | 12.5% |
| Marathi | not supported | – | – | – | – | – | – | – |
|  | _no data collected yet_ | | | | | | | |
| Bengali | not supported | – | – | – | – | – | – | – |
|  | _no data collected yet_ | | | | | | | |

Status rule: supported: upper 95% bound of test EER <= 10% and at least 10 different test speakers; experimental: test EER <= 25%; otherwise not supported.

Test conditions:

- **English**: ASVspoof 2019 LA evaluation set: unseen speakers and 13 voice-generation systems (A07-A19) never seen in training.
- **Hindi**: Unseen speakers (speaker-disjoint split). Same generator families as training (XTTS-v2, FreeVC from IndicSynth).
- **Kannada**: Unseen speakers (speaker-disjoint split). Same generator families as training (XTTS-v2, FreeVC from IndicSynth).
- **Malayalam**: Unseen speakers (speaker-disjoint split). Same generator families as training (XTTS-v2, FreeVC from IndicSynth).
- **Tamil**: Unseen speakers (speaker-disjoint split). Same generator families as training (XTTS-v2, FreeVC from IndicSynth).
- **Telugu**: Unseen speakers (speaker-disjoint split). Same generator families as training (XTTS-v2, FreeVC from IndicSynth).

## Metric definitions

- **eer**: Equal error rate: the operating point where the share of real voices flagged as fake equals the share of fakes passed as real. Lower is better; threshold-independent.
- **accuracy**: Share of test clips classified correctly at the calibrated threshold (chosen on dev, never on test). Test sets are class-balanced.
- **real passed**: Share of real voices classified as real.
- **fake caught**: Share of AI-generated voices classified as AI-generated.
- **ci**: 95% intervals: bootstrap (500 resamples) for EER, Wilson score for proportions.
- **support rule**: supported: upper 95% bound of test EER <= 10% and at least 10 different test speakers; experimental: test EER <= 25%; otherwise not supported.
- **shortcut probe**: Recording-condition check: a simple classifier that only sees the average spectrum and noise floor. If it reaches EER <= 10%, the language is capped at 'experimental'.

## Per-attack / per-generator detection (test set)

**English**: A07 20/28, A08 29/30, A09 28/30, A10 10/31, A11 22/29, A12 28/31, A13 26/30, A14 27/31, A15 27/31, A16 26/30, A17 30/30, A18 25/30, A19 24/30

**Hindi**: freevc24 30/30, xtts_v2 20/20

**Kannada**: freevc24 11/11, xtts_v2 18/19

**Malayalam**: freevc24 28/28, xtts_v2 24/24

**Tamil**: freevc24 21/21, xtts_v2 20/20

**Telugu**: freevc24 6/6, xtts_v2 10/10

## Dataset

6671 clips collected, 6092 kept after cleaning and balancing.

| Language | Train (real + AI) | Dev | Test | Hours | Sources |
|---|---|---|---|---|---|
| English | 1247 + 1247 (20 spk) | 399 + 399 (20 spk) | 391 + 391 (67 spk) | 3.85 | ASVspoof 2019 LA |
| Hindi | 122 + 122 (59 spk) | 28 + 28 (14 spk) | 50 + 50 (20 spk) | 0.59 | IndicSynth, Kathbath |
| Kannada | 169 + 169 (44 spk) | 32 + 32 (7 spk) | 30 + 30 (7 spk) | 1.04 | IndicSynth, Kathbath |
| Malayalam | 134 + 134 (8 spk) | 26 + 26 (6 spk) | 52 + 52 (3 spk) | 1.23 | IndicSynth, Kathbath |
| Tamil | 118 + 118 (74 spk) | 7 + 7 (5 spk) | 41 + 41 (22 spk) | 0.62 | IndicSynth, Kathbath |
| Telugu | 161 + 161 (59 spk) | 23 + 23 (8 spk) | 16 + 16 (10 spk) | 0.81 | IndicSynth, Kathbath |

Removed during cleaning:

- duration outside 1.0-60.0 s: 13
- class balancing (down-sampled): 566

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
- Classifier: Light CNN with Max-Feature-Map, 2 classes (260,450 trainable parameters, arch {'proj_dim': 64, 'time_pool': 2})
- Input: 4.0 s segments, scores averaged; threshold P(AI) ≥ 0.5
- Training: 6 epochs (best 3), 29 min on CPU, AdamW (weight decay 1e-4), lr 0.0003, batch 32
- Balancing: loss weighted so every (language, label) group counts equally
- Model selection: lowest mean dev EER across languages

## How much training data is needed? (learning curve)

fast LCNN (proj 64, time-pool 2), Wav2Vec2 frozen; 5 epochs; Same seed and test set for every size; the best epoch is picked on dev.

| Training clips | Dev EER | Test EER |
|---|---|---|
| 248 | 35.0% | 38.6% |
| 622 | 10.4% | 18.4% |
| 1,246 | 5.1% | 10.1% |
| 2,494 | 3.8% | 10.2% |
