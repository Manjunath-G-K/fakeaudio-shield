// What Shield says. Every number comes from the live evaluation report; nothing is invented.
// A reply is { paras: string[], items?: string[], after?: string, link?: { href, label } }.
import { pct } from "./format.js";
import { NATIVE_NAME } from "./languages.js";

export const TOPICS = [
  { id: "sample", label: "Send me a sample voice note" },
  { id: "accuracy", label: "How accurate are you?" },
  { id: "how", label: "How do you work?" },
  { id: "limits", label: "What can't you catch?" },
  { id: "privacy", label: "Is my audio stored?" },
];

export function welcome(languages) {
  return [
    { paras: ["Hi! I'm FakeAudio Shield. Send me a voice note and I'll tell you whether it sounds like a real person or AI-generated: cloned, text-to-speech or converted."] },
    { paras: [`First set the language spoken in the clip (bottom left). I've been measured on ${languages.join(", ")}.`,
      "Then record, attach a file, or pick one of my test samples."] },
  ];
}

export function languageSet(report, lang) {
  const L = report?.languages?.[lang];
  if (!L) return `Language set to ${lang}.`;
  const t = L.test;
  const native = NATIVE_NAME[lang] !== lang ? ` (${NATIVE_NAME[lang]})` : "";
  return `Language set to ${lang}${native}: ${L.status}, ${pct(t.accuracy, 0)} correct on ${t.bonafide_total + t.spoof_total} unseen test clips.`;
}

export function answer(topic, report) {
  const langs = report?.languages ?? {};
  const o = report?.overall;
  switch (topic) {
    case "accuracy":
      if (!o) return { paras: ["I can't load my evaluation report right now. Try again once the server is up."] };
      return {
        paras: [`On ${o.bonafide_total + o.spoof_total} clips from speakers I never heard, I was right ${pct(o.accuracy)} of the time. It differs by language:`],
        items: Object.entries(langs).map(([l, L]) =>
          `${l}: ${pct(L.test.accuracy)} correct, error rate ${pct(L.test.eer)}, ${L.test.speakers} test speakers (${L.status})`),
        link: { href: "#/results", label: "Open my full report" },
      };
    case "how":
      return {
        paras: ["Four steps, a couple of seconds on a normal CPU:"],
        items: [
          "I clean the audio: 16 kHz mono, silence trimmed, volume evened out, cut into 4-second parts.",
          "A speech model (Wav2Vec2, pre-trained on 960 hours of real voices) describes every 20 ms, alongside classic spectral features.",
          "A small neural network (LCNN) scores each part. English uses my English specialist; the other languages use my multilingual model.",
          "I combine the parts into one verdict and show you which part sounded most AI-like.",
        ],
      };
    case "limits": {
      const a10 = langs.English?.test?.by_attack?.A10;
      return {
        paras: ["Honestly, quite a lot can slip past me:"],
        items: [
          a10 ? `Voice generators I never trained on. One neural text-to-speech system (ASVspoof A10) fooled me in ${a10.spoof_total - a10.spoof_correct} of ${a10.spoof_total} test clips.`
              : "Voice generators I never trained on.",
          "Phone calls, background noise, music and microphone echo all differ from my training audio.",
          "For Indian languages my test sets are small and partly differ in recording quality, so my scores there are probably optimistic.",
          "Languages other than the six I was measured on.",
        ],
        after: "Treat my answer as a second opinion, never as proof.",
      };
    }
    case "privacy":
      return { paras: ["Your audio is written to a temporary file, analysed and deleted straight away. I don't store recordings or results.",
        "Your recent checks live only in this browser tab. Want everything on your own machine? I'm open source: run me yourself."] };
    default:
      return { paras: ["Pick one of the options below."] };
  }
}

/** Shield's comment after a verdict: language reliability, plus the truth for test samples. */
export function verdictNotes(report, lang, source, result) {
  const notes = [];
  if (source.sample) {
    const right = source.sample.truth === result.label;
    const what = source.sample.truth === "spoof" ? "AI-generated" : "a real person";
    notes.push({ tone: right ? "real" : "ai",
      text: right ? `Correct: this test clip really is ${what} (${source.sample.detail}).`
                  : `I missed this one: it is ${what} (${source.sample.detail}).${source.sample.truth === "spoof" ? " Generators like this one are my weak spot." : ""}` });
  }
  const L = report?.languages?.[lang];
  if (L) {
    const t = L.test;
    let text = `For ${lang} I'm ${L.status}: ${pct(t.accuracy, 0)} correct on ${t.bonafide_total + t.spoof_total} unseen test clips from ${t.speakers} speakers.`;
    if (L.status_reason) text += ` ${L.status_reason}`;
    notes.push({ tone: L.status === "supported" ? "neutral" : "warn", text });
  }
  if (source.kind === "recording") {
    notes.push({ tone: "warn", text: "Live microphone audio is harder for me: room echo and laptop mics differ from my training data." });
  }
  return notes;
}
