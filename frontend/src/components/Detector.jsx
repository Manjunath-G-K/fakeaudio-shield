import { useEffect, useRef, useState } from "react";
import { ALLOWED, MAX_MB, pct, predict } from "../api.js";
import Waveform from "./Waveform.jsx";
import { AlertIcon, CheckIcon, PlayIcon, UploadIcon, XIcon } from "./icons.jsx";

// Clips from the ASVspoof 2019 LA *evaluation* set: never used for training.
const SAMPLES = [
  { file: "real-voice-1.flac", label: "Real voice", note: "Human speaker", truth: "bonafide" },
  { file: "real-voice-2.flac", label: "Real voice", note: "Human speaker", truth: "bonafide" },
  { file: "ai-voice-a17.flac", label: "AI voice", note: "Voice conversion (A17)", truth: "spoof" },
  { file: "ai-voice-a13.flac", label: "AI voice", note: "TTS + voice conversion (A13)", truth: "spoof" },
  { file: "ai-voice-a10.flac", label: "AI voice", note: "Neural TTS (A10), hard case", truth: "spoof" },
];

const STEPS = ["Resampling to 16 kHz", "Trimming silence", "Wav2Vec2 + MFCC/log-mel features", "LCNN classifier"];

function Processing() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <ol className="steps-live" role="status" aria-live="polite">
      {STEPS.map((s, i) => (
        <li key={s} className={i < step ? "done" : i === step ? "active" : ""}>{s}</li>
      ))}
    </ol>
  );
}

function Result({ result, truth }) {
  const spoof = result.label === "spoof";
  const { audio } = result;
  const correct = truth ? truth === result.label : null;
  return (
    <div className={`result ${spoof ? "spoof" : "real"}`} aria-live="polite">
      <div className="result-head">
        <div>
          <div className="eyebrow">Prediction</div>
          <div className="verdict">{spoof ? "AI-GENERATED" : "REAL"}</div>
          <div className="verdict-sub">{result.verdict}</div>
        </div>
        <div className="confidence-ring" style={{ "--p": result.confidence }}>
          <span>{pct(result.confidence)}</span>
          <small>confidence</small>
        </div>
      </div>

      {truth && (
        <div className={`truth ${correct ? "ok" : "miss"}`}>
          {correct ? <CheckIcon size={18} /> : <XIcon size={18} />}
          <span>
            Ground truth: <strong>{truth === "spoof" ? "AI-generated" : "Real"}</strong>.{" "}
            {correct ? "The model got this one right."
              : "The model missed this one. This attack type was never seen in training, a known limitation."}
          </span>
        </div>
      )}

      <div className="bars">
        <div className="bar-row">
          <span>Real / Bona-fide</span>
          <div className="bar"><div className="fill real-fill" style={{ width: pct(result.probabilities.bonafide) }} /></div>
          <span className="mono">{pct(result.probabilities.bonafide)}</span>
        </div>
        <div className="bar-row">
          <span>AI-generated / Spoof</span>
          <div className="bar"><div className="fill spoof-fill" style={{ width: pct(result.probabilities.spoof) }} /></div>
          <span className="mono">{pct(result.probabilities.spoof)}</span>
        </div>
      </div>

      <dl className="details">
        <div><dt>File</dt><dd>{audio.filename}</dd></div>
        <div><dt>Original</dt><dd>{audio.original_duration_sec} s · {audio.original_sample_rate} Hz</dd></div>
        <div><dt>Speech analysed</dt><dd>{audio.analysed_duration_sec} s · {audio.processed_sample_rate} Hz</dd></div>
        <div><dt>Processing</dt><dd>{(result.processing_time_ms / 1000).toFixed(2)} s</dd></div>
      </dl>

      {result.segments.length > 1 && (
        <div className="segments">
          <div className="eyebrow">Spoof probability per 4-second segment</div>
          <div className="segment-row">
            {result.segments.map((s, i) => (
              <div key={i} className="segment" title={`${s.start}–${s.end} s: ${pct(s.spoof_probability)}`}
                   style={{ "--p": s.spoof_probability }}>
                <span>{pct(s.spoof_probability, 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="disclaimer">This result is a prediction, not proof of authenticity.</p>
    </div>
  );
}

export default function Detector({ health, onModelError }) {
  const [file, setFile] = useState(null);
  const [truth, setTruth] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loadingSample, setLoadingSample] = useState(null);
  const inputRef = useRef(null);
  const ready = health?.model_loaded;

  useEffect(() => () => audioUrl && URL.revokeObjectURL(audioUrl), [audioUrl]);

  function choose(f, sampleTruth = null) {
    setResult(null);
    setError(null);
    setTruth(sampleTruth);
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      setFile(null);
      setAudioUrl(null);
      setError(`Unsupported file type "${ext}". Please choose ${ALLOWED.join(", ")}.`);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFile(null);
      setAudioUrl(null);
      setError(`File is larger than ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
    setAudioUrl(URL.createObjectURL(f));
  }

  async function loadSample(s) {
    setLoadingSample(s.file);
    try {
      const blob = await (await fetch(`/samples/${s.file}`)).blob();
      const f = new File([blob], s.file, { type: "audio/flac" });
      choose(f, s.truth);
      await analyse(f);
    } finally {
      setLoadingSample(null);
    }
  }

  async function analyse(f = file) {
    if (!f) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await predict(f));
    } catch (e) {
      setError(e.message);
      onModelError?.();
    } finally {
      setBusy(false);
    }
  }

  const tone = busy ? "scanning" : result ? (result.label === "spoof" ? "spoof" : "real") : "idle";

  return (
    <div className="detector">
      <div className="detector-input">
        <div
          className={`drop ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={file ? "Choose another audio file" : "Choose an audio file"}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED.join(",")}
            aria-label="Audio file"
            hidden
            onChange={(e) => { choose(e.target.files[0]); e.target.value = ""; }}
          />
          <div className="drop-icon"><UploadIcon size={26} /></div>
          {file ? (
            <>
              <div className="file-name">{file.name}</div>
              <div className="muted">{(file.size / 1024).toFixed(0)} KB · click or drop to replace</div>
            </>
          ) : (
            <>
              <div className="file-name">Drop an audio file here, or click to browse</div>
              <div className="muted">WAV, FLAC, MP3, OGG or M4A · up to {MAX_MB} MB</div>
            </>
          )}
        </div>

        <div className="samples">
          <div className="eyebrow">Or try a sample clip from the ASVspoof 2019 test set</div>
          <div className="sample-grid">
            {SAMPLES.map((s) => (
              <button key={s.file} type="button" className={`sample ${s.truth}`} disabled={busy || !ready}
                      onClick={() => loadSample(s)} aria-label={`Analyse sample: ${s.label}, ${s.note}`}>
                <PlayIcon size={16} />
                <span><strong>{s.label}</strong><small>{s.note}</small></span>
                {loadingSample === s.file && <span className="mini-spinner" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="detector-output">
        <Waveform file={file} tone={tone} />
        {audioUrl && <audio controls src={audioUrl} className="player" aria-label="Selected audio preview" />}

        <button className="btn btn-primary analyse" type="button" aria-busy={busy}
                disabled={!file || busy || !ready} onClick={() => analyse()}>
          {busy ? "Analysing…" : ready === false ? "Model not available" : "Analyse audio"}
        </button>

        {busy && <Processing />}

        {error && (
          <div className="error" role="alert">
            <AlertIcon size={20} />
            <div><strong>Could not analyse this file.</strong><div>{error}</div></div>
          </div>
        )}

        {result && <Result result={result} truth={truth} />}

        {!file && !result && !error && !busy && (
          <p className="placeholder">Your result appears here: verdict, confidence, probabilities and details.</p>
        )}
      </div>
    </div>
  );
}
