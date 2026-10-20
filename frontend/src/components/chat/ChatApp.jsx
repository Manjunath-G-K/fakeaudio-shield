import { useCallback, useEffect, useRef, useState } from "react";
import { player } from "../../hooks/usePlayer.js";
import { ALLOWED_TYPES, MAX_UPLOAD_MB, predict } from "../../lib/api.js";
import { TOPICS, answer, languageSet, welcome } from "../../lib/conversation.js";
import { loadSample } from "../../lib/samples.js";
import { Upload } from "../icons.jsx";
import { BotError, BotText, Listening, MyText, SystemNote } from "./BotBubbles.jsx";
import ChatHeader from "./ChatHeader.jsx";
import Composer from "./Composer.jsx";
import VerdictBubble from "./VerdictBubble.jsx";
import VoiceNote from "./VoiceNote.jsx";
import "./chat.css";

let nextId = 1;
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const msg = (fields) => ({ id: nextId++, time: now(), ...fields });

function problemWith(file) {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_TYPES.includes(ext)) return `I can't open ${ext || "that"} files. Send WAV, FLAC, MP3, OGG or M4A.`;
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `That file is over ${MAX_UPLOAD_MB} MB. Send a shorter clip (I only analyse the first 60 s).`;
  return null;
}

/** The detector as a conversation with Shield. */
export default function ChatApp({ backend, lang, setLang, onInfo }) {
  const { report, ready, connecting, languages } = backend;
  const [messages, setMessages] = useState(() => welcome(languages).map((reply) => msg({ who: "bot", kind: "text", reply })));
  const [busy, setBusy] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [asked, setAsked] = useState([]);
  const list = useRef(null);
  const shownLang = useRef(lang);
  const live = useRef(messages);
  live.current = messages;

  const push = useCallback((...m) => setMessages((x) => [...x, ...m]), []);
  const patch = (id, fields) => setMessages((x) => x.map((m) => (m.id === id ? { ...m, ...fields } : m)));
  const replace = (id, next) => setMessages((x) => x.map((m) => (m.id === id ? next : m)));

  // keep the newest message in view
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  // tell the user what a language change means
  useEffect(() => {
    if (shownLang.current === lang) return;
    shownLang.current = lang;
    setTrayOpen(false);
    push(msg({ who: "system", kind: "note", text: languageSet(report, lang) }));
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // say so once if the server can't be reached
  useEffect(() => {
    if (!connecting && !ready) push(msg({ who: "bot", kind: "error", retry: true,
      text: "I can't reach my server right now, so I can't check voice notes. Start the backend, then try again." }));
  }, [connecting, ready, push]);

  // free the clips' object URLs when the chat closes
  useEffect(() => () => live.current.forEach((m) => m.kind === "voice" && m.own && URL.revokeObjectURL(m.url)), []);

  async function send(file, kind, sample = null, sampleIndex = 0) {
    const problem = problemWith(file);
    if (problem) { push(msg({ who: "bot", kind: "error", text: problem })); return; }
    const label = kind === "recording" ? "Your recording" : sample ? `Mystery clip ${String.fromCharCode(65 + sampleIndex)}` : file.name;
    const voice = msg({ who: "me", kind: "voice", file, url: URL.createObjectURL(file), own: true, label, lang, status: "sent",
      source: { kind, sample } });
    const listening = msg({ who: "bot", kind: "listening" });
    push(voice, listening);
    setBusy(true);
    try {
      const result = await predict(file, lang);
      patch(voice.id, { status: "checked" });
      replace(listening.id, msg({ who: "bot", kind: "verdict", result, lang, voice: { ...voice, status: "checked" } }));
    } catch (e) {
      patch(voice.id, { status: "failed" });
      replace(listening.id, msg({ who: "bot", kind: "error", text: e.message }));
    } finally {
      setBusy(false);
    }
  }

  function ask(topic) {
    if (topic === "sample") { setTrayOpen(true); return; }
    const t = TOPICS.find((x) => x.id === topic);
    setAsked((a) => [...a, topic]);
    const q = msg({ who: "me", kind: "text", text: t.label });
    const typing = msg({ who: "bot", kind: "listening", short: true });
    push(q, typing);
    setTimeout(() => replace(typing.id, msg({ who: "bot", kind: "text", reply: answer(topic, report) })), 450);
  }

  const suggestions = TOPICS.filter((t) => !asked.includes(t.id));

  return (
    <section className={`chat${dragging ? " dragging" : ""}`} aria-label="Chat with FakeAudio Shield"
             onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
             onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
             onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f && !busy && ready) send(f, "upload"); }}>
      <ChatHeader backend={backend} onInfo={onInfo} />

      <div className="messages" ref={list} role="log" aria-live="polite" aria-label="Conversation">
        <div className="day-chip">Today</div>
        <p className="e2e-note">Voice notes are analysed and deleted right away. Nothing is stored.</p>
        {messages.map((m) => (
          <div key={m.id} className={`row row-${m.who}`}>
            {m.kind === "text" && m.who === "bot" && <BotText msg={m} />}
            {m.kind === "text" && m.who === "me" && <MyText msg={m} />}
            {m.kind === "voice" && <VoiceNote msg={m} />}
            {m.kind === "listening" && <Listening />}
            {m.kind === "verdict" && <VerdictBubble msg={m} report={report} />}
            {m.kind === "error" && <BotError msg={m} onRetry={backend.reload} />}
            {m.kind === "note" && <SystemNote msg={m} />}
          </div>
        ))}
      </div>

      {suggestions.length > 0 && !busy && (
        <div className="suggestions" role="group" aria-label="Suggested questions">
          {suggestions.map((t) => (
            <button key={t.id} type="button" onClick={() => ask(t.id)} disabled={t.id === "sample" && !ready}>{t.label}</button>
          ))}
        </div>
      )}

      <Composer languages={languages} lang={lang} setLang={setLang} report={report} busy={busy} offline={!ready}
                trayOpen={trayOpen} setTrayOpen={setTrayOpen}
                onFile={(f, kind) => send(f, kind)}
                onSample={async (s, i) => { player.pause(); send(await loadSample(s), "sample", s, i); }}
                onError={(text) => push(msg({ who: "bot", kind: "error", text }))} />

      {dragging && (
        <div className="drop-overlay" aria-hidden="true"><Upload size={30} /><p>Drop the clip to send it to Shield</p></div>
      )}
    </section>
  );
}
