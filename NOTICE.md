# Third-party data, models and licences

The **source code** in this repository is MIT-licensed (see [LICENSE](LICENSE)). The
**trained weights** and **audio samples** are derived from the datasets below and carry
their terms. This is a summary, not legal advice; read each licence before reusing them.

## Datasets

| Dataset | Used for | Licence | Attribution |
|---|---|---|---|
| [ASVspoof 2019 LA](https://datashare.ed.ac.uk/handle/10283/3336) | English real + AI speech | [ODC-By 1.0](https://opendatacommons.org/licenses/by/1-0/) | Wang, Yamagishi, Todisco et al., *ASVspoof 2019: A large-scale public database of synthesized, converted and replayed speech*, Computer Speech & Language, 2020. University of Edinburgh, CSTR. |
| [Kathbath](https://huggingface.co/datasets/ai4bharat/Kathbath) | Real speech in Hindi, Kannada, Tamil, Telugu, Malayalam | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Javed et al., *IndicSUPERB: A Speech Processing Universal Performance Benchmark for Indian Languages*, AAAI 2023. AI4Bharat. |
| [IndicSynth](https://huggingface.co/datasets/vdivyasharma/IndicSynth) | AI speech (XTTS-v2, FreeVC) in the same languages | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) | IndicSynth authors; cite as given on the [dataset card](https://huggingface.co/datasets/vdivyasharma/IndicSynth). |

No dataset audio is stored in this repository except the short sample clips listed below.
The training data is downloaded by the scripts in `backend/` (Kathbath requires accepting
its terms on Hugging Face first).

## Model weights (`backend/checkpoints/`)

| File | Trained on | Terms |
|---|---|---|
| `fakeaudio_lcnn.pt` (multilingual) | ASVspoof 2019 LA, Kathbath, IndicSynth | Includes IndicSynth (CC BY-NC 4.0): **non-commercial use only**, with attribution to all three datasets |
| `fakeaudio_english.pt` (English specialist) | ASVspoof 2019 LA | Attribution to ASVspoof 2019 (ODC-By 1.0) |

Both use [facebook/wav2vec2-base](https://huggingface.co/facebook/wav2vec2-base)
(Apache 2.0) as a frozen feature extractor; it is downloaded from Hugging Face on first run
and is not stored here.

## Sample clips (`frontend/public/samples/`)

All clips come from the **test** splits (never used in training).

| Files | Source | Licence |
|---|---|---|
| `real-voice-1.flac`, `real-voice-2.flac`, `ai-voice-a10.flac`, `ai-voice-a13.flac`, `ai-voice-a17.flac` | ASVspoof 2019 LA evaluation set | ODC-By 1.0 |
| `hindi-real.flac`, `kannada-real.flac`, `tamil-real.flac`, `telugu-real.flac`, `malayalam-real.flac` | Kathbath | CC BY 4.0 |
| `hindi-ai.wav`, `kannada-ai.wav`, `tamil-ai.wav`, `telugu-ai.wav`, `malayalam-ai.wav` | IndicSynth | CC BY-NC 4.0 |

## Frontend font

[Inter](https://rsms.me/inter/) by Rasmus Andersson, SIL Open Font License 1.1, bundled
through `@fontsource-variable/inter`.
