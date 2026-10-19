import { useEffect, useRef, useState } from "react";
import { ALLOWED, MAX_MB, predict } from "../api.js";
import AudioReview from "./AudioReview.jsx";
import Recorder from "./Recorder.jsx";
import { ALL_LANGUAGES, NATIVE, SAMPLES } from "../samples.js";
import { Alert, Check, Cross, Download, Globe, Mic, Person, Redo, Robot, Sparkle, Upload } from "./icons.jsx";

/** What we actually measured for this language, in one plain sentence. */
function languageNote(lang, report) {
  if (!lang) return null;
  const L = report?.languages?.[lang];
  if (!L) {
    const why = report?.dataset?.excluded_languages?.[lang];
    return { tone: "warn", text: `${lang} has not been evaluated yet${why ? " (training data incomplete)" : ""}, so this result is unverified for ${lang} speech.` };
  }
  const t = L.test;
  const acc = Math.round(t.accuracy * 100);
  const n = t.bonafide_total + t.spoof_total;
  const tone = L.status === "supported" ? "good" : "warn";
  return { tone, text: `For ${lang}, the model classified ${acc}% of ${n} unseen test clips correctly (EER ${(t.eer * 100).toFixed(1)}%). Status: ${L.status}.` };
}

const TABS = [
  { id: "record", label: "Record", icon: Mic },
  { id: "upload", label: "Upload a file", icon: Upload },
  { id: "samples", label: "Try a sample", icon: Sparkle },
];

const STEPS = ["Cleaning up the audio", "Listening for voice patterns", "Deciding: real or AI"];
// never show "100%": the model is a probability estimate, not certainty
const pc = (x) => (x >= 0.995 ? ">99%" : `${Math.round(x * 100)}%`);

function confidenceWord(c) {
  if (c >= 0.9) return "High confidence";
  if (c >= 0.7) return "Moderate confidence";
  return "Low confidence, treat with caution";
}

function Checking() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => Math.min(x + 1, STEPS.length - 1)), 700); return () => clearInterval(t); }, []);
  return (
    <div className="checking" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <ol>{STEPS.map((s, n) => <li key={s} className={n < i ? "done" : n === i ? "now" : ""}>{s}</li>)}</ol>
    </div>
  );
}

function Result({ result, source, onAgain, lang, report }) {
  const ai = result.label === "spoof";
  const langInfo = languageNote(lang, report);
  const correct = source.sample ? source.sample.truth === result.label : null;
  const dots = Math.min(10, Math.max(1, Math.round(result.confidence * 10)));

  function downloadReport() {
    const report = { tool: "FakeAudio Shield", checked_at: new Date().toISOString(), input: source.file.name,
      source: source.kind, reference: source.sample ? source.sample.truth : null, result };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `voice-check-${source.file.name.replace(/\.[^.]+$/, "")}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={`result ${ai ? "ai" : "real"}`} aria-live="polite">
      <div className="result-top">
        <span className="result-icon">{ai ? <Robot size={28} /> : <Person size={28} />}</span>
        <div>
          <h3>{ai ? "Likely AI-generated" : "Likely a real human voice"}</h3>
          <p>{ai ? "This voice shows patterns the model associates with synthetic speech."
                 : "This voice shows patterns typical of natural human speech."}</p>
        </div>
      </div>

      <div className="confidence">
        <div className="dots" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < dots ? "on" : ""} />)}
        </div>
        <div className="confidence-text"><strong>{pc(result.confidence)}</strong> {confidenceWord(result.confidence)}</div>
      </div>

      {correct !== null && (
        <p className={`note ${correct ? "good" : "bad"}`}>
          {correct ? <Check size={16} /> : <Cross size={16} />}
          <span>
            This sample is actually <strong>{source.sample.truth === "spoof" ? "AI-generated" : "a real voice"}</strong>.{" "}
            {correct ? "The model got it right." : "The model missed it. This type of AI voice was not in its training data."}
          </span>
        </p>
      )}
      {source.kind === "recording" && (
        <p className="note info"><Alert size={16} /> <span>Live microphone recordings are less reliable: the model learned from studio-quality audio, so room noise and laptop mics can affect the result.</span></p>
      )}
      {langInfo && (
        <p className={`note ${langInfo.tone === "good" ? "good" : "info"}`}><Globe size={16} /> <span>{langInfo.text}</span></p>
      )}

      <details className="tech">
        <summary>Technical details</summary>
        <dl>
          <div><dt>Chance of AI</dt><dd>{(result.probabilities.spoof * 100).toFixed(1)}%</dd></div>
          <div><dt>Chance of real</dt><dd>{(result.probabilities.bonafide * 100).toFixed(1)}%</dd></div>
          <div><dt>Audio</dt><dd>{result.audio.original_duration_sec} s at {result.audio.original_sample_rate} Hz</dd></div>
          <div><dt>Speech analysed</dt><dd>{result.audio.analysed_duration_sec} s (silence removed, 16 kHz)</dd></div>
          <div><dt>4-second parts</dt><dd>{result.segments.map((s) => `${(s.spoof_probability * 100).toFixed(0)}% AI`).join(" · ")}</dd></div>
          <div><dt>Time taken</dt><dd>{(result.processing_time_ms / 1000).toFixed(2)} s</dd></div>
          <div><dt>Model</dt><dd>Wav2Vec2 + MFCC/log-mel features → LCNN</dd></div>
        </dl>
      </details>

      <div className="result-actions">
        <button type="button" className="btn primary" onClick={onAgain}><Redo size={18} /> Check another voice</button>
        <button type="button" className="btn ghost" onClick={downloadReport}><Download size={18} /> Download report</button>
      </div>
      <p className="fineprint">A prediction to support your judgement, not proof.</p>
    </div>
  );
}

export default function Checker({ ready, onHistory, report, lang, setLang }) {
  const [tab, setTab] = useState("samples");
  const sampleLangs = Object.keys(SAMPLES);
  const sampleLang = SAMPLES[lang] ? lang : sampleLangs[0];
  const [source, setSource] = useState(null);     // { file, kind, sample? }
  const [phase, setPhase] = useState("pick");      // pick | review | checking | result
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function accept(file, kind, sample = null) {
    setError(null);
    setResult(null);
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED.includes(ext)) return setError(`That file type (${ext}) isn't supported. Use WAV, FLAC, MP3, OGG or M4A.`);
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is larger than ${MAX_MB} MB.`);
    setSource({ file, kind, sample });
    setPhase("review");
  }

  async function pickSample(s) {
    const blob = await (await fetch(`/samples/${s.file}`)).blob();
    accept(new File([blob], s.file, { type: "audio/flac" }), "sample", s);
  }

  async function check() {
    setPhase("checking");
    setError(null);
    try {
      const r = await predict(source.file);
      setResult(r);
      setPhase("result");
      onHistory({ name: source.sample?.name ?? source.file.name, kind: source.kind, label: r.label,
                  confidence: r.confidence, truth: source.sample?.truth ?? null, lang });
    } catch (e) {
      setError(e.message);
      setPhase("review");
    }
  }

  function reset() { setSource(null); setResult(null); setError(null); setPhase("pick"); }

  const label = source?.kind === "recording" ? "Your recording" : source?.sample?.name ?? source?.file.name;

  return (
    <div className="checker" id="check">
      <div className="lang-bar">
        <label htmlFor="lang-select"><Globe size={16} /> Language of the audio</label>
        <select id="lang-select" value={lang} onChange={(e) => setLang(e.target.value)} disabled={phase === "checking"}>
          {ALL_LANGUAGES.map((l) => {
            const st = report?.languages?.[l]?.status;
            return <option key={l} value={l}>{l}{NATIVE[l] !== l ? ` · ${NATIVE[l]}` : ""}{st ? ` (${st})` : " (not evaluated)"}</option>;
          })}
        </select>
      </div>
      {phase === "pick" && (
        <>
          <div className="tabs" role="tablist" aria-label="Choose how to add audio">
            {TABS.map(({ id, label: l, icon: Ico }) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id}
                      className={tab === id ? "on" : ""} onClick={() => { setTab(id); setError(null); }}>
                <Ico size={18} /> {l}
              </button>
            ))}
          </div>

          <div className="tab-body" role="tabpanel">
            {tab === "record" && <Recorder onDone={(f) => accept(f, "recording")} />}

            {tab === "upload" && (
              <div className={`dropzone ${dragging ? "drag" : ""}`} role="button" tabIndex={0}
                   aria-label="Choose an audio file"
                   onClick={() => inputRef.current?.click()}
                   onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
                   onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                   onDragLeave={() => setDragging(false)}
                   onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0], "upload"); }}>
                <input ref={inputRef} type="file" accept={ALLOWED.join(",")} hidden aria-label="Audio file"
                       onChange={(e) => { accept(e.target.files[0], "upload"); e.target.value = ""; }} />
                <span className="drop-icon"><Upload size={26} /></span>
                <strong>{dragging ? "Drop it here" : "Drop an audio file here"}</strong>
                <span>or <u>browse your computer</u></span>
                <small>WAV, FLAC, MP3, OGG or M4A · up to {MAX_MB} MB · first 60 s are checked</small>
              </div>
            )}

            {tab === "samples" && (
              <ul className="sample-list">
                {!SAMPLES[lang] && (
                  <li className="sample-credit">No {lang} samples yet. Showing {sampleLang} clips instead.</li>
                )}
                {SAMPLES[sampleLang].map((s) => (
                  <li key={s.file}>
                    <button type="button" onClick={() => pickSample(s)}>
                      <span className={`sample-badge ${s.truth === "spoof" ? "ai" : "real"}`}>
                        {s.truth === "spoof" ? <Robot size={18} /> : <Person size={18} />}
                      </span>
                      <span className="sample-text"><strong>{s.name}</strong><small>{s.detail}</small></span>
                      <span className="sample-go">Use</span>
                    </button>
                  </li>
                ))}
                <li className="sample-credit">All samples come from test sets: the model never heard them during training.</li>
              </ul>
            )}
          </div>
        </>
      )}

      {phase !== "pick" && source && (
        <div className="stage">
          <AudioReview blob={source.file} label={label} />

          {phase === "review" && (
            <div className="stage-actions">
              <button type="button" className="btn primary big" onClick={check} disabled={!ready}>
                {ready ? "Check this voice" : "Detector offline"}
              </button>
              <button type="button" className="btn ghost" onClick={reset}>
                {source.kind === "recording" ? <><Redo size={18} /> Record again</> : "Choose different audio"}
              </button>
            </div>
          )}
          {phase === "checking" && <Checking />}
          {phase === "result" && result && <Result result={result} source={source} onAgain={reset} lang={lang} report={report} />}
        </div>
      )}

      {error && <p className="inline-error block" role="alert"><Alert size={16} /> {error}</p>}
    </div>
  );
}
