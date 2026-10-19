import { useCallback, useEffect, useState } from "react";
import { getHealth, getReport } from "./api.js";
import { Shield } from "./components/icons.jsx";
import { useRoute } from "./hooks.js";
import Home from "./pages/Home.jsx";
import Results from "./pages/Results.jsx";
import { LANGUAGES } from "./samples.js";

export default function App() {
  const route = useRoute();
  const [health, setHealth] = useState(null);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [lang, setLang] = useState("English");

  const load = useCallback(async () => {
    setReport(null);
    const h = await getHealth();
    setHealth(h);
    setReport(h.model_loaded ? await getReport() : { error: h.error || h.message || "The detector is offline." });
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [route]);

  const ready = !!health?.model_loaded;
  const status = health === null ? "Connecting" : ready ? "Detector online" : "Offline";
  // only languages with measured results are offered
  const languages = health?.languages?.length ? health.languages : LANGUAGES;

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="nav">
        <div className="nav-inner">
          <a href="#/" className="logo" aria-label="FakeAudio Shield home">
            <span className="logo-mark"><Shield size={17} /></span>
            <span className="logo-text">FakeAudio Shield</span>
          </a>
          <nav aria-label="Pages">
            <a href="#/" className={route === "home" ? "on" : ""} aria-current={route === "home" ? "page" : undefined}>Detector</a>
            <a href="#/results" className={route === "results" ? "on" : ""} aria-current={route === "results" ? "page" : undefined}>Results</a>
          </nav>
          <span className={`status ${health === null ? "" : ready ? "ok" : "off"}`} role="status" aria-live="polite"
                title={health?.error || (!ready && health?.message) || ""}>
            <i aria-hidden="true" /><span className="status-text">{status}</span>
          </span>
        </div>
      </header>

      {health && !ready && (
        <p className="banner" role="alert">
          The detector isn't running. Start the backend, then
          <button type="button" onClick={load}>try again</button>.
        </p>
      )}

      <main id="main" key={route} className="page">
        {route === "results"
          ? <Results report={report} reload={load} />
          : <Home health={health} report={report && !report.error ? report : null} languages={languages}
                  lang={lang} setLang={setLang} history={history}
                  onHistory={(h) => setHistory((x) => [h, ...x].slice(0, 6))} />}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="logo"><span className="logo-mark"><Shield size={15} /></span>FakeAudio Shield</span>
            <p>Deepfake voice detection with honest, per-language results. Predictions support human judgement; they are not proof.</p>
          </div>
          <div className="footer-links">
            <a href="#/">Detector</a>
            <a href="#/results">Measured results</a>
            <a href="#/results" onClick={() => setTimeout(() => document.getElementById("data")?.scrollIntoView(), 400)}>Datasets &amp; licences</a>
          </div>
        </div>
      </footer>
    </>
  );
}
