import { useEffect, useState } from "react";
import { Alert, Refresh } from "../icons.jsx";

/** A text reply from Shield: paragraphs, an optional list, closing line and link. */
export function BotText({ msg }) {
  const r = msg.reply;
  return (
    <div className="bubble bubble-bot text">
      {r.paras?.map((t) => <p key={t}>{t}</p>)}
      {r.items && <ul className="bot-list">{r.items.map((t) => <li key={t}>{t}</li>)}</ul>}
      {r.after && <p>{r.after}</p>}
      {r.link && <a className="bot-link" href={r.link.href}>{r.link.label} →</a>}
      <span className="msg-time">{msg.time}</span>
    </div>
  );
}

/** The user's tapped question. */
export function MyText({ msg }) {
  return <div className="bubble bubble-me text"><p>{msg.text}</p><span className="msg-time">{msg.time}</span></div>;
}

const STEPS = ["Cleaning up the audio", "Listening to every 20 ms", "Scoring each 4-second part"];

/** Shown while the backend analyses a voice note. */
export function Listening() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % STEPS.length), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="bubble bubble-bot listening" role="status" aria-live="polite">
      <span className="dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{STEPS[i]}…</span>
    </div>
  );
}

/** Something went wrong (bad file, server down); optional retry action. */
export function BotError({ msg, onRetry }) {
  return (
    <div className="bubble bubble-bot error" role="alert">
      <p><Alert size={16} /> {msg.text}</p>
      {msg.retry && onRetry && <button type="button" onClick={onRetry}><Refresh size={14} /> Try again</button>}
      <span className="msg-time">{msg.time}</span>
    </div>
  );
}

/** Centered system line, e.g. a language change. */
export const SystemNote = ({ msg }) => <div className="system-note" role="status">{msg.text}</div>;
