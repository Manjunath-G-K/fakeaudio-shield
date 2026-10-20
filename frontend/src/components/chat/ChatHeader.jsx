import { Info, Report, ShieldWave } from "../icons.jsx";

export default function ChatHeader({ backend, onInfo }) {
  const status = backend.connecting ? "connecting…" : backend.ready ? `online · checks ${backend.languages.length} languages` : "offline";
  return (
    <header className="chat-header">
      <span className="avatar"><ShieldWave size={22} /></span>
      <div className="chat-title">
        <h1>FakeAudio Shield</h1>
        <p className={backend.ready ? "online" : backend.connecting ? "" : "offline"} role="status" aria-live="polite">{status}</p>
      </div>
      <a className="header-btn" href="#/results" title="How Shield was tested"><Report size={20} /><span>Report</span></a>
      <button type="button" className="header-btn info-toggle" onClick={onInfo} title="Shield info" aria-label="Shield info"><Info size={20} /></button>
    </header>
  );
}
