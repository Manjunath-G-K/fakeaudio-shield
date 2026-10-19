import { useEffect, useRef, useState } from "react";
import { micErrorMessage, startRecording } from "../lib/audio.js";
import { Alert, Mic, Stop } from "./icons.jsx";

const MAX_SECONDS = 60;   // the model analyses at most 60 s of speech
const MIN_SECONDS = 1.5;
const BARS = 64;

/** Microphone recorder. Calls onDone(file) with a WAV File when the user stops. */
export default function Recorder({ onDone }) {
  const [state, setState] = useState("idle");   // idle | starting | recording
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState(() => Array(BARS).fill(0));
  const rec = useRef(null);
  const raf = useRef(0);
  const t0 = useRef(0);

  useEffect(() => () => { cancelAnimationFrame(raf.current); rec.current?.cancel(); }, []);

  async function start() {
    setError(null);
    setState("starting");
    try {
      rec.current = await startRecording();
    } catch (e) {
      setError(micErrorMessage(e));
      setState("idle");
      return;
    }
    setState("recording");
    setLevels(Array(BARS).fill(0));
    t0.current = performance.now();
    const buf = new Float32Array(rec.current.analyser.fftSize);
    let last = 0;
    const loop = (now) => {
      const secs = (now - t0.current) / 1000;
      setElapsed(secs);
      if (now - last > 60) {                        // ~16 level samples per second
        last = now;
        rec.current.analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const raw = Math.min(1, Math.sqrt(sum / buf.length) * 7);
        // short decay so syllables read as a continuous waveform instead of isolated spikes
        setLevels((l) => [...l.slice(1), Math.max(raw, l[l.length - 1] * 0.7)]);
      }
      if (secs >= MAX_SECONDS) { stop(); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }

  async function stop() {
    cancelAnimationFrame(raf.current);
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    const { blob, duration } = await r.stop();
    setState("idle");
    if (duration < MIN_SECONDS) {
      setError(`That was only ${duration.toFixed(1)} s. Record at least ${MIN_SECONDS} s of speech.`);
      return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    onDone(new File([blob], `recording-${stamp}.wav`, { type: "audio/wav" }), "recording");
  }

  const recording = state === "recording";
  const left = Math.max(0, MAX_SECONDS - elapsed);

  return (
    <div className="recorder">
      <button type="button" className={`mic ${recording ? "live" : ""}`} onClick={recording ? stop : start}
              disabled={state === "starting"} aria-label={recording ? "Stop recording" : "Start recording"}>
        {recording ? <Stop size={30} /> : <Mic size={32} />}
      </button>

      <div className="recorder-text" aria-live="polite">
        {recording ? (
          <><strong className="rec-dot">Recording · {Math.floor(elapsed)}s</strong>
            <span>Tap to stop. Stops by itself in {Math.ceil(left)}s.</span></>
        ) : state === "starting" ? (
          <><strong>Starting microphone…</strong><span>Allow access if your browser asks.</span></>
        ) : (
          <><strong>Tap to record</strong>
            <span>Speak for 5–15 seconds, or play a recording near the mic.</span></>
        )}
      </div>

      <div className={`levels ${recording ? "live" : ""}`} aria-hidden="true">
        {levels.map((l, i) => <span key={i} style={{ height: `${Math.max(4, l * 100)}%` }} />)}
      </div>

      {error && <p className="inline-error" role="alert"><Alert size={16} /> {error}</p>}
    </div>
  );
}
