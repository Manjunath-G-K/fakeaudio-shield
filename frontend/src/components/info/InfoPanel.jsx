import { pct } from "../../lib/format.js";
import { NATIVE_NAME, STATUS } from "../../lib/languages.js";
import { Alert, Back, Close, Lock, Report, ShieldWave, Waveform } from "../icons.jsx";
import "./info.css";

/** Measured results for the language currently selected. */
function CurrentLanguage({ report, lang }) {
  const L = report?.languages?.[lang];
  if (!L) return <p className="info-muted">Loading measured results…</p>;
  const t = L.test, s = STATUS[L.status];
  const model = report.models?.[L.model]?.name;
  return (
    <div className="info-lang">
      <div className="info-lang-top">
        <div>
          <p className="info-kicker">Checking in</p>
          <h3>{lang} {NATIVE_NAME[lang] !== lang && <small>{NATIVE_NAME[lang]}</small>}</h3>
        </div>
        <span className={`pill pill-${s.tone}`}>{s.label}</span>
      </div>
      <p className="info-big tabular">{pct(t.accuracy, 1)}<span> correct on unseen voices</span></p>
      <div className="info-bar" aria-hidden="true"><span style={{ width: `${t.accuracy * 100}%` }} /></div>
      <dl className="info-facts">
        <div><dt>Error rate</dt><dd className="tabular">{pct(t.eer)}</dd></div>
        <div><dt>Test clips</dt><dd className="tabular">{t.bonafide_total + t.spoof_total}</dd></div>
        <div><dt>Speakers</dt><dd className="tabular">{t.speakers}</dd></div>
      </dl>
      {model && <p className="info-muted">Answered by my {model.toLowerCase().includes("specialist") ? model : `${model.toLowerCase()} model`}.</p>}
    </div>
  );
}

export default function InfoPanel({ backend, lang, setLang, open, onClose }) {
  const { report, languages } = backend;
  return (
    <aside className={`info${open ? " open" : ""}`} aria-label="Shield info">
      <div className="info-bar-top">
        <button type="button" className="info-close" onClick={onClose} aria-label="Close info"><Back size={20} className="only-mobile" /><Close size={18} className="only-desktop" /></button>
        <span>Shield info</span>
      </div>

      <div className="info-scroll">
        <div className="info-profile">
          <span className="info-avatar"><ShieldWave size={40} /></span>
          <h2>FakeAudio Shield</h2>
          <p>Deepfake voice detector · Wav2Vec2 + LCNN</p>
        </div>

        <section className="info-card"><CurrentLanguage report={report} lang={lang} /></section>

        <section className="info-card">
          <h3 className="info-heading">Languages</h3>
          <ul className="info-langs">
            {languages.map((l) => {
              const L = report?.languages?.[l];
              return (
                <li key={l}>
                  <button type="button" className={l === lang ? "on" : ""} onClick={() => { setLang(l); onClose(); }}>
                    <span className={`status-dot s-${(L?.status ?? "none").replace(" ", "-")}`} />
                    <span className="info-lang-name">{l}<small>{NATIVE_NAME[l] !== l ? NATIVE_NAME[l] : ""}</small></span>
                    <span className="tabular">{L ? pct(L.test.accuracy, 0) : "–"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="info-card">
          <h3 className="info-heading">Good to know</h3>
          <ul className="info-tips">
            <li><Waveform size={18} /><span>Clear speech from one person, 5–60 seconds, works best.</span></li>
            <li><Alert size={18} /><span>New voice generators can fool me. My answer is a second opinion, not proof.</span></li>
            <li><Lock size={18} /><span>Voice notes are deleted right after analysis. Nothing is stored.</span></li>
          </ul>
        </section>

        <a className="info-card info-link" href="#/results"><Report size={20} /><span>How I was tested<small>Full per-language report, data and models</small></span></a>

        <p className="info-legal">Code: MIT licence. Model weights and test clips keep their dataset licences (one is non-commercial).</p>
      </div>
    </aside>
  );
}
