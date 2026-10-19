import { useCallback, useEffect, useState } from "react";
import { getHealth } from "./api.js";
import Checker from "./components/Checker.jsx";
import { Shield } from "./components/icons.jsx";
import { Accuracy, GoodToKnow, HowItWorks, Recent } from "./components/Info.jsx";

export default function App() {
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const refresh = useCallback(() => getHealth().then(setHealth), []);
  useEffect(() => { refresh(); }, [refresh]);

  const ready = !!health?.model_loaded;
  const status = health === null ? "Connecting…" : ready ? "Ready" : "Offline";

  return (
    <>
      <header className="nav">
        <a href="#top" className="logo"><span className="logo-mark"><Shield size={18} /></span>FakeAudio Shield</a>
        <nav aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#accuracy">Accuracy</a>
          <a href="#good-to-know">Good to know</a>
        </nav>
        <span className={`status ${health === null ? "" : ready ? "ok" : "off"}`} role="status" aria-live="polite"
              title={health?.error || (!ready && health?.message) || ""}>
          <i aria-hidden="true" />{status}
        </span>
      </header>

      <main id="top">
        <section className="hero">
          <h1>Is this voice real, or AI?</h1>
          <p>Record your voice, upload a clip or try a sample. FakeAudio Shield tells you whether it sounds like a real person or a machine, in about a second.</p>
        </section>

        {health && !ready && (
          <p className="banner" role="alert">
            The detector isn't running. Start the backend (<code>start-backend.bat</code>) and refresh this page.
          </p>
        )}

        <Checker ready={ready} onHistory={(h) => setHistory((x) => [h, ...x].slice(0, 6))} />
        <Recent items={history} />

        <HowItWorks />
        <Accuracy health={health} />
        <GoodToKnow />
      </main>

      <footer className="footer">
        FakeAudio Shield · results are predictions, not proof · sample clips from ASVspoof 2019 (ODC-By)
      </footer>
    </>
  );
}
