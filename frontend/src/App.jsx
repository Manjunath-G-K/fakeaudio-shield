import { useEffect, useState } from "react";
import { getHealth, pct } from "./api.js";
import Detector from "./components/Detector.jsx";
import { FAQ, Footer, Hero, HowItWorks, Nav, Results, Roadmap, Stats, Team, UseCases } from "./components/Sections.jsx";

function DetectorStatus({ health }) {
  if (health === null) return <div className="status muted" role="status" aria-live="polite">Checking backend…</div>;
  if (health.error) return <div className="status bad" role="status" aria-live="polite">{health.error}</div>;
  if (!health.model_loaded) return <div className="status bad" role="status" aria-live="polite">Model not available: {health.message}</div>;
  const test = health.metrics?.test;
  return (
    <div className="status ok" role="status" aria-live="polite">
      <span className="dot" /> {health.model} ready
      {test && <> · test EER {pct(test.eer, 2)}</>}
      {health.train_info?.languages && <> · {health.train_info.languages.join(", ")}</>}
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState(null);
  const refreshHealth = () => getHealth().then(setHealth);

  useEffect(() => {
    refreshHealth();
  }, []);

  return (
    <>
      <a className="skip-link" href="#detector">Skip to the detector</a>
      <Nav health={health} />
      <main>
        <Hero health={health} />
        <Stats health={health} />

        <section className="section detector-section" id="detector">
          <div className="container">
            <div className="section-head">
              <div className="eyebrow">Detector</div>
              <h2>Analyse a recording</h2>
              <p>Upload your own file or start with one of the sample clips the model has never heard before.</p>
              <DetectorStatus health={health} />
            </div>
            <Detector health={health} onModelError={refreshHealth} />
          </div>
        </section>

        <HowItWorks />
        <Results health={health} />
        <UseCases />
        <Roadmap />
        <Team />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
