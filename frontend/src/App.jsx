import { useEffect, useRef, useState } from "react";

const ALLOWED = [".wav", ".flac", ".mp3", ".ogg", ".m4a"];
const MAX_MB = 20;

const pct = (x) => `${(x * 100).toFixed(1)}%`;

async function readError(res) {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
  } catch {
    /* not JSON: the proxy could not reach the backend */
  }
  if (res.status >= 500) return "The backend is not responding. Make sure the FastAPI server is running on port 8000.";
  return `Request failed (HTTP ${res.status}).`;
}

function ModelStatus({ health }) {
  if (health === null) return <div className="status muted">Checking backend…</div>;
  if (health.error) return <div className="status bad">{health.error}</div>;
  if (!health.model_loaded) return <div className="status bad">Model not available: {health.message}</div>;
  const test = health.metrics?.test;
  const langs = health.train_info?.languages ?? [];
  return (
    <div className="status ok">
      <div>
        <span className="dot" /> {health.model} ready
        {test && <> · test EER {pct(test.eer)}</>}
      </div>
      {langs.length > 0 && <div className="langs">Languages: {langs.join(", ")}</div>}
      {test?.by_language && (
        <details>
          <summary>Measured test results per language</summary>
          <table>
            <thead>
              <tr><th>Language</th><th>EER</th><th>Accuracy</th></tr>
            </thead>
            <tbody>
              {Object.entries(test.by_language).map(([lang, m]) => (
                <tr key={lang}>
                  <td>{lang}</td>
                  <td>{m.eer == null ? "–" : pct(m.eer)}</td>
                  <td>{pct(m.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function Result({ result }) {
  const spoof = result.label === "spoof";
  const { audio } = result;
  return (
    <section className={`card result ${spoof ? "spoof" : "real"}`}>
      <div className="step-label">3 · Prediction</div>
      <div className="verdict">{spoof ? "AI-GENERATED" : "REAL"}</div>
      <div className="verdict-sub">{result.verdict}</div>
      <div className="confidence">
        Confidence: <strong>{pct(result.confidence)}</strong>
      </div>

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
        <dt>File</dt><dd>{audio.filename}</dd>
        <dt>Original</dt><dd>{audio.original_duration_sec} s @ {audio.original_sample_rate} Hz</dd>
        <dt>After preprocessing</dt><dd>{audio.analysed_duration_sec} s speech @ {audio.processed_sample_rate} Hz</dd>
        <dt>4-second segments</dt>
        <dd>
          {result.segments.length} (spoof probability:{" "}
          {result.segments.map((s) => pct(s.spoof_probability)).join(", ")})
        </dd>
        <dt>Processing time</dt><dd>{(result.processing_time_ms / 1000).toFixed(2)} s</dd>
      </dl>
      <p className="disclaimer">This result is a prediction, not proof of authenticity.</p>
    </section>
  );
}

export default function App() {
  const [health, setHealth] = useState(null);
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const loadHealth = () =>
    fetch("/api/health")
      .then(async (r) => (r.ok ? r.json() : { error: await readError(r) }))
      .then(setHealth)
      .catch(() => setHealth({ error: "Cannot reach the backend. Start the FastAPI server on port 8000." }));

  useEffect(() => {
    loadHealth();
  }, []);

  useEffect(() => () => audioUrl && URL.revokeObjectURL(audioUrl), [audioUrl]);

  function choose(f) {
    setResult(null);
    setError(null);
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

  async function analyse() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/predict", { method: "POST", body: form });
      if (!res.ok) throw new Error(await readError(res));
      setResult(await res.json());
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Cannot reach the backend. Is it running?" : e.message);
      loadHealth();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header>
        <div className="kicker">MAJOR PROJECT · B.E. CSE</div>
        <h1>FakeAudio Shield</h1>
        <p className="tagline">AI-Generated Voice &amp; Deepfake Audio Detection System</p>
        <ModelStatus health={health} />
      </header>

      <section className="card">
        <div className="step-label">1 · Upload</div>
        <div
          className={`drop ${dragging ? "dragging" : ""}`}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED.join(",")}
            hidden
            onChange={(e) => { choose(e.target.files[0]); e.target.value = ""; }}
          />
          {file ? (
            <>
              <div className="file-name">{file.name}</div>
              <div className="muted">{(file.size / 1024).toFixed(0)} KB · click to choose another file</div>
            </>
          ) : (
            <>
              <div className="file-name">Choose an audio file or drop it here</div>
              <div className="muted">WAV, FLAC, MP3, OGG or M4A · up to {MAX_MB} MB</div>
            </>
          )}
        </div>
        {audioUrl && <audio controls src={audioUrl} className="player" />}

        <button className="analyse" disabled={!file || busy} onClick={analyse}>
          {busy ? "Analysing…" : "Analyse"}
        </button>
        {busy && (
          <div className="processing">
            <div className="step-label">2 · Processing</div>
            <div className="spinner" />
            Resampling to 16 kHz, trimming silence, extracting Wav2Vec2 + MFCC/log-mel features, running the LCNN…
          </div>
        )}
      </section>

      {error && (
        <section className="card error" role="alert">
          <strong>Could not analyse this file.</strong>
          <div>{error}</div>
        </section>
      )}

      {result && <Result result={result} />}

      <footer>Department of CSE, University B.D.T College of Engineering, Davangere</footer>
    </main>
  );
}
