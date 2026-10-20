import { useEffect, useState } from "react";
import { player, usePlayer } from "../../hooks/usePlayer.js";
import { SAMPLES } from "../../lib/samples.js";
import { Close, Pause, Play, Send } from "../icons.jsx";

/**
 * Test clips for the current language, shown as anonymous "mystery" voice notes:
 * whether each is real or AI is revealed only after Shield answers.
 */
export default function SampleTray({ lang, onSend, onClose }) {
  const samples = SAMPLES[lang] ?? [];
  const p = usePlayer();
  const [urls] = useState(() => Object.fromEntries(samples.map((s) => [s.file, `/samples/${s.file}`])));
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="popover tray" role="dialog" aria-label={`${lang} test clips`}>
      <div className="tray-head">
        <div>
          <h3>{lang} test clips</h3>
          <p>From speakers I never heard. Real or AI? Send one and see if I get it right.</p>
        </div>
        <button type="button" className="round-btn ghost small" onClick={onClose} aria-label="Close"><Close size={18} /></button>
      </div>
      <ul className="tray-list">
        {samples.map((s, i) => {
          const url = urls[s.file];
          const playing = p.url === url && p.playing;
          return (
            <li key={s.file}>
              <button type="button" className="tray-play" onClick={() => (playing ? player.pause() : player.play(url))}
                      aria-label={playing ? "Pause" : `Listen to clip ${String.fromCharCode(65 + i)}`}>
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span className="tray-name">Mystery clip {String.fromCharCode(65 + i)}<small>{lang} · test set</small></span>
              <button type="button" className="tray-send" onClick={() => { player.stopIf(url); onSend(s, i); }}>
                Send <Send size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
