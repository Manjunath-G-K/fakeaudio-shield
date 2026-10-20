// Sample clips served from /public/samples. All are from TEST splits: never heard during training.
// English: ASVspoof 2019 LA eval (ODC-By). Indian languages: Kathbath (CC BY 4.0) / IndicSynth (CC BY-NC 4.0),
// exported by backend/export_samples.py into data/samples.generated.json. Licences: NOTICE.md.
import generated from "../data/samples.generated.json";

export const SAMPLES = {
  ...generated,
  English: [
    { file: "real-voice-1.flac", name: "Real person (1)", detail: "Recorded human speech", truth: "bonafide" },
    { file: "real-voice-2.flac", name: "Real person (2)", detail: "Recorded human speech", truth: "bonafide" },
    { file: "ai-voice-a17.flac", name: "AI voice: voice conversion", detail: "A real voice converted into someone else's", truth: "spoof" },
    { file: "ai-voice-a13.flac", name: "AI voice: text-to-speech + conversion", detail: "Synthesised, then converted", truth: "spoof" },
    { file: "ai-voice-a10.flac", name: "AI voice: neural text-to-speech", detail: "A hard case the model often misses", truth: "spoof" },
  ],
};

export async function loadSample(sample) {
  const blob = await (await fetch(`/samples/${sample.file}`)).blob();
  return new File([blob], sample.file, { type: blob.type || "audio/wav" });
}
