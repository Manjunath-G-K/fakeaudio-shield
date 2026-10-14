import { useCallback, useEffect, useState } from "react";
import { getHealth } from "./api.js";
import Instrument from "./components/Instrument.jsx";
import { DataPrivacy, Limits, Measurements, Pipeline } from "./components/Sheet.jsx";

function Status({ health }) {
  const state = health === null ? "wait" : health.model_loaded ? "on" : "off";
  const text = { wait: "Connecting", on: "Model online", off: "Model offline" }[state];
  return (
    <span className={`status ${state}`} role="status" aria-live="polite" title={health?.error || health?.message || ""}>
      <i aria-hidden="true" />{text}
    </span>
  );
}

export default function App() {
  const [health, setHealth] = useState(null);
  const refresh = useCallback(() => getHealth().then(setHealth), []);
  useEffect(() => { refresh(); }, [refresh]);
  const test = health?.metrics?.test;

  return (
    <>
      <a className="skip" href="#instrument">Skip to the detector</a>
      <header className="bar">
        <a className="mark" href="#top" aria-label="FakeAudio Shield, top of page">FAKEAUDIO<span>/</span>SHIELD</a>
        <nav aria-label="Sections">
          <a href="#instrument">Detector</a>
          <a href="#pipeline">Signal chain</a>
          <a href="#measurements">Measurements</a>
          <a href="#limits">Limits</a>
          <a href="#data">Data</a>
        </nav>
        <div className="bar-right">
          <span className="bar-model hide-sm">W2V2-B/L6 · LCNN</span>
          <Status health={health} />
        </div>
      </header>

      <main id="top">
        <div className="intro">
          <h1>Is this voice <em>human?</em></h1>
          <div className="intro-side">
            <p>
              Voice cloning needs only a few seconds of someone's speech. Drop in a recording and
              FakeAudio Shield estimates whether it is genuine or synthetic, and shows you exactly
              what it measured.
            </p>
            <div className="intro-figure">
              <b>{test ? `${(test.eer * 100).toFixed(2)} %` : "—"}</b>
              <span>equal error rate on 13 voice generators the model never saw in training</span>
            </div>
          </div>
        </div>

        <Instrument health={health} onBackendError={refresh} />

        <div className="sheet">
          <Pipeline />
          <Measurements health={health} />
          <Limits />
          <DataPrivacy />
        </div>
      </main>

      <footer className="foot">
        <span>FAKEAUDIO/SHIELD · research prototype · results are predictions, not proof</span>
        <span className="hide-sm">Keys <kbd>1</kbd>–<kbd>5</kbd> samples · <kbd>U</kbd> upload · <kbd>P</kbd> play</span>
      </footer>
    </>
  );
}
