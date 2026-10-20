import { useEffect, useState } from "react";
import { player, usePlayer } from "../../hooks/usePlayer.js";
import { waveformPeaks } from "../../lib/audio.js";
import { mmss } from "../../lib/format.js";
import { Clock, DoubleCheck, Pause, Play } from "../icons.jsx";

const BARS = 44;

/** The user's voice note: play/pause, waveform with progress, length, language tag and delivery ticks. */
export default function VoiceNote({ msg }) {
  const [peaks, setPeaks] = useState(null);
  const [duration, setDuration] = useState(0);
  const p = usePlayer();
  const mine = p.url === msg.url;
  const playing = mine && p.playing;
  const progress = mine && duration ? p.time / duration : 0;
  const range = mine && p.range && duration ? p.range.map((t) => t / duration) : null;

  useEffect(() => {
    let alive = true;
    waveformPeaks(msg.file, BARS).then((w) => { if (alive) { setPeaks(w.peaks); setDuration(w.duration); } }).catch(() => {});
    return () => { alive = false; };
  }, [msg.file]);

  const seek = (e) => {
    if (!duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    player.seek(msg.url, ((e.clientX - r.left) / r.width) * duration);
  };

  return (
    <div className="bubble bubble-me voice">
      <div className="voice-row">
        <button type="button" className="voice-play" onClick={() => (playing ? player.pause() : player.play(msg.url))}
                aria-label={playing ? "Pause voice note" : "Play voice note"}>
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <div className="voice-wave" onClick={seek} role="presentation">
          {(peaks ?? Array(BARS).fill(0.08)).map((v, i) => {
            const at = (i + 0.5) / BARS;
            const inRange = range && at >= range[0] && at <= range[1];
            return <i key={i} className={`${at < progress ? "on" : ""}${inRange ? " hot" : ""}`} style={{ height: `${Math.max(12, v * 100)}%` }} />;
          })}
          {mine && duration > 0 && <b className="voice-knob" style={{ left: `${Math.min(100, progress * 100)}%` }} />}
        </div>
      </div>
      <div className="voice-meta">
        <span className="voice-label" title={msg.label}>{msg.label}</span>
        <span className="lang-tag">{msg.lang}</span>
        <span className="tabular">{mmss(mine && p.time ? p.time : duration)}</span>
        <span className="msg-time">{msg.time}</span>
        <span className={`ticks ${msg.status}`} aria-label={msg.status === "checked" ? "Analysed" : msg.status === "failed" ? "Not analysed" : "Sent"}>
          {msg.status === "sent" ? <Clock size={13} /> : <DoubleCheck size={15} />}
        </span>
      </div>
    </div>
  );
}
