import { useEffect, useRef, useState } from "react";
import { micErrorMessage, startRecording } from "../../lib/audio.js";
import { mmss } from "../../lib/format.js";
import { Send, Trash } from "../icons.jsx";
import Spectrogram from "./Spectrogram.jsx";

const MAX_SECONDS = 60;   // only the first 60 s of speech are analysed
const MIN_SECONDS = 1.5;

/**
 * Replaces the composer while recording: live spectrogram, timer, discard and send.
 * onSend(file) with a WAV File; onCancel(); onError(message).
 */
export default function RecordingBar({ onSend, onCancel, onError }) {
  const [rec, setRec] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef(null);
  const done = useRef(false);

  useEffect(() => {
    let raf, t0;
    startRecording().then((r) => {
      if (done.current) { r.cancel(); return; }
      recRef.current = r;
      setRec(r);
      t0 = performance.now();
      const tick = (now) => {
        const s = (now - t0) / 1000;
        setElapsed(s);
        if (s >= MAX_SECONDS) { finish(); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }).catch((e) => { done.current = true; onError(micErrorMessage(e)); });
    return () => { done.current = true; cancelAnimationFrame(raf); recRef.current?.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish() {
    const r = recRef.current;
    if (!r || done.current) return;
    done.current = true;
    recRef.current = null;
    const { blob, duration } = await r.stop();
    if (duration < MIN_SECONDS) {
      onError(`That was only ${duration.toFixed(1)} s. Record at least ${MIN_SECONDS} s of speech.`);
      return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    onSend(new File([blob], `recording-${stamp}.wav`, { type: "audio/wav" }));
  }

  function discard() {
    done.current = true;
    recRef.current?.cancel();
    recRef.current = null;
    onCancel();
  }

  return (
    <div className="recording-bar" role="group" aria-label="Recording">
      <button type="button" className="round-btn ghost" onClick={discard} aria-label="Discard recording"><Trash size={20} /></button>
      <div className="recording-live">
        <span className="rec-dot" aria-hidden="true" />
        <span className="tabular rec-time" aria-live="off">{mmss(elapsed)}</span>
        {rec ? <Spectrogram analyser={rec.analyser} /> : <span className="rec-wait">Starting microphone… allow access if asked</span>}
      </div>
      <button type="button" className="round-btn primary" onClick={finish} disabled={!rec} aria-label="Send recording"><Send size={20} /></button>
    </div>
  );
}
