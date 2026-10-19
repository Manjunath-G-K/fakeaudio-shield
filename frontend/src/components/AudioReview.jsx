import { useEffect, useRef, useState } from "react";
import { waveformPeaks } from "../lib/audio.js";
import { Pause, Play } from "./icons.jsx";

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Waveform + play/pause for the selected or recorded audio. Clicking the waveform seeks. */
export default function AudioReview({ blob, label }) {
  const [wave, setWave] = useState(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [url, setUrl] = useState(null);
  const audio = useRef(null);

  useEffect(() => {
    let alive = true;
    const u = URL.createObjectURL(blob);
    setUrl(u); setWave(null); setFailed(false); setTime(0); setPlaying(false);
    waveformPeaks(blob).then((w) => alive && setWave(w)).catch(() => alive && setFailed(true));
    return () => { alive = false; URL.revokeObjectURL(u); };
  }, [blob]);

  useEffect(() => {
    if (!playing) return;
    let raf;
    const tick = () => { setTime(audio.current?.currentTime ?? 0); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const duration = wave?.duration || audio.current?.duration || 0;
  const progress = duration ? time / duration : 0;
  const toggle = () => (audio.current.paused ? audio.current.play() : audio.current.pause());
  const seek = (e) => {
    if (!duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    audio.current.currentTime = ((e.clientX - r.left) / r.width) * duration;
    setTime(audio.current.currentTime);
  };

  return (
    <div className="review">
      <button type="button" className="play" onClick={toggle} aria-label={playing ? "Pause" : `Play ${label}`}>
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="review-main">
        <div className="review-wave" onClick={seek} role="presentation">
          {failed ? <span className="review-note">Preview not available for this file, but it can still be checked.</span>
            : (wave?.peaks ?? Array(120).fill(0.06)).map((p, i, a) => (
              <span key={i} className={i / a.length < progress ? "on" : ""} style={{ height: `${Math.max(6, p * 100)}%` }} />
            ))}
        </div>
        <div className="review-meta">
          <span className="review-name">{label}</span>
          <span className="review-time">{mmss(time)} / {duration ? mmss(duration) : "–:––"}</span>
        </div>
      </div>
      {url && (
        <audio ref={audio} src={url} preload="auto"
               onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
               onEnded={() => { setPlaying(false); setTime(0); }} />
      )}
    </div>
  );
}
