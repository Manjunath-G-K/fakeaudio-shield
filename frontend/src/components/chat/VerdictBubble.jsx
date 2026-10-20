import { useState } from "react";
import { player, usePlayer } from "../../hooks/usePlayer.js";
import { verdictNotes } from "../../lib/conversation.js";
import { confidenceLevel, prob } from "../../lib/format.js";
import { shareVerdictCard } from "../../lib/verdictCard.js";
import { Alert, Check, Chevron, Info, Pause, Play, Share } from "../icons.jsx";

/** Where on the real <-> AI scale this clip sits; the tick marks the 50% decision line. */
function Meter({ value }) {
  return (
    <div className="meter" role="img" aria-label={`Chance of AI: ${prob(value)}%`}>
      <div className="meter-track"><span className="meter-mid" /><span className="meter-knob" style={{ left: `${value * 100}%` }} /></div>
      <div className="meter-labels"><span>Real</span><span className="tabular">{prob(value)}% chance of AI</span><span>AI</span></div>
    </div>
  );
}

/** One chip per analysed 4-second part; clicking a part plays it from the voice note. */
function Parts({ segments, offset, url, worst }) {
  const p = usePlayer();
  return (
    <div className="parts" role="list" aria-label="Score of each 4-second part">
      {segments.map((s, i) => {
        const range = [s.start + offset, s.end + offset];
        const active = p.url === url && p.playing && p.range && Math.abs(p.range[0] - range[0]) < 0.01;
        return (
          <button key={s.start} type="button" role="listitem" onClick={() => player.play(url, range)}
                  className={`part ${s.spoof_probability >= 0.5 ? "ai" : "real"}${i === worst ? " worst" : ""}${active ? " playing" : ""}`}
                  style={{ flexGrow: Math.max(0.6, s.end - s.start) }}
                  title={`Play ${range[0].toFixed(1)}–${range[1].toFixed(1)} s`}
                  aria-label={`${range[0].toFixed(1)} to ${range[1].toFixed(1)} seconds, ${prob(s.spoof_probability)}% AI. Play.`}>
            <span className="tabular">{prob(s.spoof_probability)}%</span>
          </button>
        );
      })}
    </div>
  );
}

const NOTE_ICON = { real: Check, ai: Alert, warn: Alert, neutral: Info };

export default function VerdictBubble({ msg, report }) {
  const { result, voice } = msg;
  const [open, setOpen] = useState(false);
  const [shareState, setShareState] = useState(null);
  const p = usePlayer();
  const ai = result.label === "spoof";
  const level = confidenceLevel(result.confidence);
  const offset = result.audio.speech_start_sec ?? 0;
  const segs = result.segments ?? [];
  const worst = segs.reduce((best, s, i) => (s.spoof_probability > segs[best].spoof_probability ? i : best), 0);
  const worstRange = segs.length ? [segs[worst].start + offset, segs[worst].end + offset] : null;
  const playingWorst = p.url === voice.url && p.playing && p.range && worstRange && Math.abs(p.range[0] - worstRange[0]) < 0.01;
  const notes = verdictNotes(report, msg.lang, voice.source, result);

  async function share() {
    setShareState("working");
    try {
      const how = await shareVerdictCard({ result, lang: msg.lang, sourceLabel: voice.label });
      setShareState(how === "downloaded" ? "Card downloaded" : how === "shared" ? "Shared" : null);
    } catch {
      setShareState("Couldn't create the card");
    }
  }

  return (
    <div className={`bubble bubble-bot verdict ${ai ? "is-ai" : "is-real"}`}>
      <div className="verdict-head">
        <span className="verdict-badge">{ai ? <Alert size={20} /> : <Check size={20} />}</span>
        <div>
          <h3>{ai ? "Sounds AI-generated" : "Sounds like a real person"}</h3>
          <p><b className="tabular">{prob(result.confidence)}%</b> confident · <span className={`lvl-${level.key}`}>{level.label}</span></p>
        </div>
      </div>

      <Meter value={result.probabilities.spoof} />

      {segs.length > 0 && (
        <div className="verdict-parts">
          <div className="verdict-parts-head"><span>Each 4-second part</span><span className="tabular">{result.audio.analysed_duration_sec} s of speech</span></div>
          <Parts segments={segs} offset={offset} url={voice.url} worst={worst} />
          <button type="button" className="suspicious" onClick={() => (playingWorst ? player.pause() : player.play(voice.url, worstRange))}>
            {playingWorst ? <Pause size={15} /> : <Play size={15} />}
            Play the most AI-like part <span className="tabular">({worstRange[0].toFixed(1)}–{worstRange[1].toFixed(1)} s)</span>
          </button>
        </div>
      )}

      <ul className="verdict-notes">
        {notes.map((n) => {
          const Ico = NOTE_ICON[n.tone];
          return <li key={n.text} className={`note-${n.tone}`}><Ico size={15} /><span>{n.text}</span></li>;
        })}
      </ul>

      {open && (
        <dl className="verdict-details">
          <div><dt>Chance of AI</dt><dd className="tabular">{(result.probabilities.spoof * 100).toFixed(1)}%</dd></div>
          <div><dt>Model</dt><dd>{result.model} · Wav2Vec2 + LCNN</dd></div>
          <div><dt>Input</dt><dd className="tabular">{result.audio.original_duration_sec} s at {result.audio.original_sample_rate} Hz</dd></div>
          <div><dt>Speech starts</dt><dd className="tabular">{offset.toFixed(2)} s (silence before it is skipped)</dd></div>
          <div><dt>Processing</dt><dd className="tabular">{(result.processing_time_ms / 1000).toFixed(2)} s</dd></div>
        </dl>
      )}

      <div className="verdict-actions">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          Details <Chevron size={15} className={open ? "flip" : ""} />
        </button>
        <button type="button" onClick={share} disabled={shareState === "working"}>
          <Share size={15} /> {shareState === "working" ? "Creating card…" : "Share verdict card"}
        </button>
        {shareState && shareState !== "working" && <span className="share-state" role="status">{shareState}</span>}
        <span className="msg-time">{msg.time}</span>
      </div>
    </div>
  );
}
