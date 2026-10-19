import { useCallback, useEffect, useState } from "react";
import { getHealth, getReport } from "./api.js";
import { Shield } from "./components/icons.jsx";
import { useRoute } from "./hooks.js";
import Home from "./pages/Home.jsx";
import Results from "./pages/Results.jsx";

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
  const status = health === null ? "Connecting…" : ready ? "Ready" : "Offline";

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="nav">
        <a href="#/" className="logo" aria-label="FakeAudio Shield home"><span className="logo-mark"><Shield size={18} /></span><span className="logo-text">FakeAudio Shield</span></a>
        <nav aria-label="Pages">
          <a href="#/" className={route === "home" ? "on" : ""}>Try it</a>
          <a href="#/results" className={route === "results" ? "on" : ""}>Results</a>
        </nav>
        <span className={`status ${health === null ? "" : ready ? "ok" : "off"}`} role="status" aria-live="polite"
              title={health?.error || (!ready && health?.message) || ""}>
          <i aria-hidden="true" /><span className="status-text">{status}</span>
        </span>
      </header>

      {health && !ready && (
        <p className="banner" role="alert">
          The detector isn't running. Start the backend (<code>start-backend.bat</code>), then
          <button type="button" onClick={load}>retry</button>.
        </p>
      )}

      <main id="main" key={route} className="page">
        {route === "results"
          ? <Results report={report} reload={load} />
          : <Home health={health} report={report && !report.error ? report : null} lang={lang} setLang={setLang}
                  history={history} onHistory={(h) => setHistory((x) => [h, ...x].slice(0, 6))} />}
      </main>

      <footer className="footer">
        <span>FakeAudio Shield · results are predictions, not proof</span>
        <span>Sample clips: ASVspoof 2019 LA (ODC-By) · all sources and licences on the <a href="#/results">Results</a> page</span>
      </footer>
    </>
  );
}
