import { useRef, useState } from "react";
import { ALLOWED_TYPES } from "../../lib/api.js";
import { Inbox, Mic, Paperclip } from "../icons.jsx";
import LanguageMenu from "./LanguageMenu.jsx";
import RecordingBar from "./RecordingBar.jsx";
import SampleTray from "./SampleTray.jsx";

/** Bottom bar: language, attach a file, test clips, record. Turns into the recording bar while recording. */
export default function Composer({ languages, lang, setLang, report, busy, offline, onFile, onSample, onError, trayOpen, setTrayOpen }) {
  const [recording, setRecording] = useState(false);
  const fileInput = useRef(null);
  const locked = busy || offline;

  if (recording) {
    return (
      <div className="composer">
        <RecordingBar onSend={(f) => { setRecording(false); onFile(f, "recording"); }}
                      onCancel={() => setRecording(false)}
                      onError={(m) => { setRecording(false); onError(m); }} />
      </div>
    );
  }

  return (
    <div className="composer" id="composer">
      {trayOpen && <SampleTray lang={lang} onClose={() => setTrayOpen(false)} onSend={(s, i) => { setTrayOpen(false); onSample(s, i); }} />}
      <LanguageMenu languages={languages} value={lang} onChange={setLang} report={report} disabled={busy} />
      <div className="composer-field">
        <span className="composer-hint">{offline ? "Shield is offline" : busy ? "Shield is listening…" : "Record, attach a clip, or send a test clip"}</span>
        <button type="button" className="icon-btn" onClick={() => setTrayOpen(!trayOpen)} disabled={locked}
                aria-label="Test clips" aria-expanded={trayOpen} title="Test clips"><Inbox size={20} /></button>
        <button type="button" className="icon-btn" onClick={() => fileInput.current?.click()} disabled={locked}
                aria-label="Attach an audio file" title="Attach an audio file"><Paperclip size={20} /></button>
        <input ref={fileInput} type="file" accept={ALLOWED_TYPES.join(",")} hidden
               onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) onFile(f, "upload"); }} />
      </div>
      <button type="button" className="round-btn primary mic" onClick={() => { setTrayOpen(false); setRecording(true); }} disabled={locked}
              aria-label="Record a voice note" title="Record a voice note"><Mic size={22} /></button>
    </div>
  );
}
