import { useCallback, useEffect, useRef, useState } from "react";
import { ALLOWED, MAX_MB, predict } from "../api.js";
import { decode16k, SR, stft } from "../lib/spectrogram.js";
import Spectrogram from "./Spectrogram.jsx";

// ASVspoof 2019 LA evaluation clips (never used in training), served from /public/samples.
const SAMPLES = [
  { id: "01", file: "real-voice-1.flac", kind: "REAL", note: "Human speaker", truth: "bonafide" },
  { id: "02", file: "real-voice-2.flac", kind: "REAL", note: "Human speaker", truth: "bonafide" },
  { id: "03", file: "ai-voice-a17.flac", kind: "SYNTH", note: "A17 · voice conversion", truth: "spoof" },
  { id: "04", file: "ai-voice-a13.flac", kind: "SYNTH", note: "A13 · TTS + VC", truth: "spoof" },
  { id: "05", file: "ai-voice-a10.flac", kind: "SYNTH", note: "A10 · neural TTS", truth: "spoof" },
];

const fmt = (x, d = 1) => (x * 100).toFixed(d);
const word = (label) => (label === "spoof" ? "SYNTHETIC" : "AUTHENTIC");

function Bar({ value, signal }) {
  return (
    <span className="meter" aria-hidden="true">
      <span className={signal ? "meter-fill signal" : "meter-fill"} style={{ width: `${value * 100}%` }} />
      <span className="meter-mark" />
    </span>
  );
}

function download(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url, download: `fakeaudio-report-${report.input.file.replace(/\.[^.]+$/, "")}.json`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Instrument({ health, onBackendError }) {
  const [file, setFile] = useState(null);
  const [sample, setSample] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [spec, setSpec] = useState(null);
  const [duration, setDuration] = useState(0);
  const [specNote, setSpecNote] = useState("NO INPUT · drop a file or press 1–5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const inputRef = useRef(null);
  const audioRef = useRef(null);
  const runId = useRef(0);
  const ready = !!health?.model_loaded;

  useEffect(() => () => audioUrl && URL.revokeObjectURL(audioUrl), [audioUrl]);

  const run = useCallback(async (f, meta = null) => {
    const id = ++runId.current;
    setResult(null); setError(null); setSample(meta); setSpec(null); setDuration(0);
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED.includes(ext)) { setFile(null); setAudioUrl(null); setError(`Unsupported file type "${ext}". Use ${ALLOWED.join(" ")}.`); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setFile(null); setAudioUrl(null); setError(`File is larger than ${MAX_MB} MB.`); return; }

    setFile(f);
    setAudioUrl(URL.createObjectURL(f));
    setSpecNote("DECODING…");
    decode16k(f)
      .then(({ samples }) => { if (id === runId.current) { setSpec(stft(samples)); setDuration(samples.length / SR); } })
      .catch(() => { if (id === runId.current) setSpecNote("NO PREVIEW · the browser cannot decode this file"); });

    if (!ready) { setError("The model is offline. Start the backend and reload."); return; }
    setBusy(true);
    try {
      const r = await predict(f);
      if (id !== runId.current) return;
      setResult(r);
      setLog((l) => [{ n: l.length + 1, file: f.name, label: r.label, spoof: r.probabilities.spoof,
        truth: meta?.truth ?? null, ms: r.processing_time_ms }, ...l].slice(0, 12));
    } catch (e) {
      if (id !== runId.current) return;
      setError(e.message);
      onBackendError?.();
    } finally {
      if (id === runId.current) setBusy(false);
    }
  }, [ready, onBackendError]);

  const loadSample = useCallback(async (s) => {
    const blob = await (await fetch(`/samples/${s.file}`)).blob();
    run(new File([blob], s.file, { type: "audio/flac" }), s);
  }, [run]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.paused ? a.play() : a.pause();
  }, []);

  // keyboard: 1-5 samples, U upload, P play/pause
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
      const s = SAMPLES.find((x) => x.id === `0${e.key}`);
      if (s) { e.preventDefault(); loadSample(s); }
      else if (e.key.toLowerCase() === "u") { e.preventDefault(); inputRef.current?.click(); }
      else if (e.key.toLowerCase() === "p") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadSample, togglePlay]);

  const match = result && sample ? sample.truth === result.label : null;
  const report = result && file && {
    tool: "FakeAudio Shield", model: health?.model, analysed_at: new Date().toISOString(),
    input: { file: file.name, bytes: file.size },
    reference: sample ? { source: "ASVspoof 2019 LA eval", truth: sample.truth, note: sample.note } : null,
    result,
  };

  return (
    <section className="instrument" id="instrument" aria-label="Detector">
      {/* ── input row ───────────────────────────────────────────── */}
      <div className="row input-row">
        <div
          className={`drop ${dragging ? "dragging" : ""}`}
          role="button" tabIndex={0}
          aria-label="Choose an audio file to analyse"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); run(e.dataTransfer.files[0]); }}
        >
          <input ref={inputRef} type="file" accept={ALLOWED.join(",")} aria-label="Audio file" hidden
                 onChange={(e) => { run(e.target.files[0]); e.target.value = ""; }} />
          <span className="label">Input</span>
          <span className="drop-main">{dragging ? "Release to analyse" : file ? file.name : "Drop audio here, or click to browse"}</span>
          <span className="drop-meta">WAV · FLAC · MP3 · OGG · M4A ≤ {MAX_MB} MB <kbd>U</kbd></span>
        </div>
        <div className="samples" role="group" aria-label="Sample clips from the ASVspoof 2019 evaluation set">
          <span className="label">Samples · never seen in training</span>
          <div className="sample-keys">
            {SAMPLES.map((s) => (
              <button key={s.id} type="button" disabled={busy}
                      className={`key ${sample?.id === s.id ? "on" : ""} ${s.kind === "SYNTH" ? "synth" : ""}`}
                      onClick={() => loadSample(s)} aria-label={`Sample ${s.id}: ${s.kind}, ${s.note}`}>
                <kbd>{Number(s.id)}</kbd><span className="key-kind">{s.kind}</span><span className="key-note">{s.note}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── display ─────────────────────────────────────────────── */}
      <div className="row display-row">
        <div className="display-head">
          <span className="label">Spectrogram<span className="hide-sm"> · 0–8 kHz · 16 kHz mono</span></span>
          <span className="display-meta">
            {file ? <>{file.name} · {duration ? `${duration.toFixed(2)} s` : "…"}</> : "—"}
          </span>
        </div>
        <Spectrogram spec={spec} duration={duration} scanning={busy} audioRef={audioRef} status={specNote} />
        {audioUrl && (
          <audio ref={audioRef} src={audioUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                 onEnded={() => setPlaying(false)} preload="auto" />
        )}
      </div>

      {/* ── readout ─────────────────────────────────────────────── */}
      <div className="row readout-row" aria-live="polite">
        <div className={`verdict-cell ${result?.label === "spoof" || error ? "signal" : ""}`}>
          <span className="label">Verdict</span>
          <div className="verdict">{busy ? "ANALYSING" : error ? "REJECTED" : result ? word(result.label) : "STANDBY"}</div>
          <div className="verdict-sub">
            {busy ? "Preprocess → Wav2Vec2 + MFCC/log-mel → LCNN"
              : error ? error
              : result ? <>{result.verdict} · confidence <b>{fmt(result.confidence)} %</b></>
              : ready ? "Waiting for input" : "Model offline"}
          </div>
          {match != null && (
            <div className={`reference ${match ? "" : "miss"}`}>
              <span className="label">Reference</span>
              {word(sample.truth)} ({sample.note}) · {match ? "MATCH" : "MISS: an attack type never seen in training"}
            </div>
          )}
        </div>

        <div className="measure-cell">
          <dl className="measures">
            <div><dt>P(spoof)</dt><dd><Bar value={result?.probabilities.spoof ?? 0} signal /><b>{result ? fmt(result.probabilities.spoof) : "––.–"}</b></dd></div>
            <div><dt>P(real)</dt><dd><Bar value={result?.probabilities.bonafide ?? 0} /><b>{result ? fmt(result.probabilities.bonafide) : "––.–"}</b></dd></div>
            <div><dt>Segments</dt><dd className="segs">
              {result ? result.segments.map((s, i) => (
                <span key={i} className="seg" title={`${s.start}–${s.end} s · P(spoof) ${fmt(s.spoof_probability)} %`}
                      style={{ "--p": s.spoof_probability }} />
              )) : <span className="dim">—</span>}
              {result && <b>{result.segments.length} × 4 s</b>}
            </dd></div>
          </dl>
          <dl className="facts">
            <div><dt>Input</dt><dd>{result ? `${result.audio.original_duration_sec} s · ${result.audio.original_sample_rate} Hz` : "—"}</dd></div>
            <div><dt>Speech</dt><dd>{result ? `${result.audio.analysed_duration_sec} s · 16 kHz` : "—"}</dd></div>
            <div><dt>Latency</dt><dd>{result ? `${result.processing_time_ms} ms` : "—"}</dd></div>
            <div><dt>Threshold</dt><dd>P(spoof) ≥ 50.0</dd></div>
          </dl>
          <div className="actions">
            <button type="button" className="btn" onClick={togglePlay} disabled={!audioUrl}>
              {playing ? "Pause" : "Play"} <kbd>P</kbd>
            </button>
            <button type="button" className="btn" onClick={() => download(report)} disabled={!report}>
              Export report ↓
            </button>
          </div>
        </div>
      </div>

      {/* ── session log ─────────────────────────────────────────── */}
      <div className="row log-row">
        <span className="label">Session log</span>
        {log.length === 0 ? <p className="dim log-empty">Analyses from this session appear here for comparison.</p> : (
          <table className="log">
            <thead><tr><th>#</th><th>File</th><th>Verdict</th><th className="num">P(spoof)</th><th className="hide-sm">Reference</th><th className="num hide-sm">ms</th></tr></thead>
            <tbody>
              {log.map((r) => (
                <tr key={r.n}>
                  <td className="dim">{String(r.n).padStart(2, "0")}</td>
                  <td className="file">{r.file}</td>
                  <td className={r.label === "spoof" ? "sig" : ""}>{word(r.label)}</td>
                  <td className="num">{fmt(r.spoof)}</td>
                  <td className="hide-sm">{r.truth ? (r.truth === r.label ? "match" : <span className="sig">miss</span>) : <span className="dim">—</span>}</td>
                  <td className="num hide-sm dim">{r.ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
