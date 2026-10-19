import Checker from "../components/Checker.jsx";
import { CountUp, ScoreRing, pct } from "../components/charts.jsx";
import { Arrow, Brain, Check, Cpu, Lock, Mic, Wave } from "../components/icons.jsx";
import { GoodToKnow, Recent } from "../components/Info.jsx";
import { useReveal } from "../hooks.js";
import { NATIVE } from "../samples.js";

const STATUS_TEXT = { supported: "Supported", experimental: "Experimental", "not supported": "Not supported" };
const toCheck = () => document.getElementById("check")?.scrollIntoView({ behavior: "smooth", block: "start" });

function Hero({ health, report, languages, lang, setLang, onHistory }) {
  const t = report?.overall;
  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="badge"><span className="badge-dot" />Wav2Vec2 + LCNN · {languages.length} languages evaluated</p>
          <h1>Is this voice <span className="hl-real">real</span>, or <span className="hl-ai">AI</span>?</h1>
          <p className="lead">
            Record yourself, upload a clip or try a sample. FakeAudio Shield listens for the subtle
            artefacts that voice-cloning tools leave behind, and gives you an answer in seconds.
          </p>
          <div className="hero-cta">
            <button type="button" className="btn primary" onClick={toCheck}>Check a voice <Arrow size={18} /></button>
            <a href="#/results" className="btn secondary">See measured results</a>
          </div>
          <dl className="hero-facts">
            <div><dt>{t?.accuracy != null ? <CountUp value={t.accuracy} format={(v) => pct(v, 1)} /> : "–"}</dt><dd>accuracy on unseen test voices</dd></div>
            <div><dt>{t?.eer != null ? <CountUp value={t.eer} format={(v) => pct(v, 1)} /> : "–"}</dt><dd>equal error rate, all languages</dd></div>
            <div><dt>CPU</dt><dd>no GPU needed to run it</dd></div>
          </dl>
        </div>
        <div className="hero-tool">
          <Checker ready={!!health?.model_loaded} onHistory={onHistory} report={report}
                   languages={languages} lang={lang} setLang={setLang} />
        </div>
      </div>
    </section>
  );
}

function Languages({ report, languages, setLang }) {
  const ref = useReveal();
  const models = report?.models ?? {};
  return (
    <section className="section reveal" id="languages" ref={ref}>
      <div className="section-head">
        <p className="kicker">Language coverage</p>
        <h2>Six languages, each measured separately</h2>
        <p>Every number comes from a test on speakers the model never heard. "Supported" needs an
          error rate below 10% (upper 95% bound) and at least 10 different test speakers.</p>
      </div>
      <div className="lang-grid">
        {languages.map((l) => {
          const L = report?.languages?.[l];
          const status = L?.status ?? "experimental";
          return (
            <button key={l} type="button" className="lang-card"
                    onClick={() => { setLang(l); toCheck(); }} aria-label={`Check a ${l} voice`}>
              <div className="lang-top">
                <span className="lang-name"><strong>{l}</strong><small>{NATIVE[l] !== l ? NATIVE[l] : " "}</small></span>
                <ScoreRing value={L?.test?.accuracy ?? null} size={60} label={`${l} test accuracy`}
                           tone={status === "supported" ? "good" : "warn"} />
              </div>
              <span className={`chip st-${status.replace(" ", "-")}`}>{STATUS_TEXT[status]}</span>
              {L ? (
                <dl className="lang-stats">
                  <div><dt>EER</dt><dd>{pct(L.test.eer)}</dd></div>
                  <div><dt>Test clips</dt><dd>{L.test.bonafide_total + L.test.spoof_total}</dd></div>
                  <div><dt>Speakers</dt><dd>{L.test.speakers}</dd></div>
                </dl>
              ) : <span className="lang-meta">Loading results…</span>}
              {L?.model && models[L.model] && <span className="lang-meta">Model: {models[L.model].name}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Pipeline() {
  const ref = useReveal();
  const steps = [
    { icon: Mic, title: "Your audio", text: "WAV, FLAC, MP3, OGG or M4A, or a recording straight from your microphone.", tech: "≤ 20 MB · first 60 s" },
    { icon: Wave, title: "Clean up", text: "Resampled, silence trimmed, volume evened out, cut into 4-second parts.", tech: "16 kHz mono" },
    { icon: Brain, title: "Listen", text: "A speech model pre-trained on 960 hours of real voices, plus classic spectral features.", tech: "Wav2Vec2 + MFCC/log-mel" },
    { icon: Check, title: "Decide", text: "A compact neural network scores each part; the scores are combined into one answer.", tech: "LCNN · calibrated on dev" },
  ];
  return (
    <section className="section reveal" id="how" ref={ref}>
      <div className="section-head">
        <p className="kicker">How it works</p>
        <h2>From sound wave to verdict in four steps</h2>
        <p>Light enough to run on an ordinary laptop CPU.</p>
      </div>
      <ol className="pipeline">
        {steps.map(({ icon: Ico, title, text, tech }, i) => (
          <li key={title} style={{ "--i": i }}>
            <div className="pipe-top"><span className="pipe-node"><Ico size={22} /></span><span className="pipe-num">0{i + 1}</span></div>
            <h3>{title}</h3>
            <p>{text}</p>
            <code>{tech}</code>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ResultsTeaser({ report }) {
  const ref = useReveal();
  const t = report?.overall;
  if (!t) return null;
  return (
    <section className="section reveal" ref={ref}>
      <div className="teaser">
        <div>
          <p className="kicker">Transparency</p>
          <h2>Measured, not promised</h2>
          <p>Tested on {(t.bonafide_total + t.spoof_total).toLocaleString("en-IN")} clips the model never heard, with
            95% confidence intervals, per-language breakdowns, a recording-condition check and the full dataset audit.</p>
          <a href="#/results" className="btn primary">Open the results <Arrow size={18} /></a>
        </div>
        <dl className="teaser-stats">
          <div><dt><CountUp value={t.bonafide_correct / t.bonafide_total} format={(v) => pct(v, 1)} /></dt><dd>of real voices recognised as real</dd></div>
          <div><dt><CountUp value={t.spoof_correct / t.spoof_total} format={(v) => pct(v, 1)} /></dt><dd>of unseen AI voices caught</dd></div>
          <div><dt><CountUp value={t.macro_eer} format={(v) => pct(v, 1)} /></dt><dd>mean equal error rate across languages</dd></div>
        </dl>
      </div>
    </section>
  );
}

export default function Home({ health, report, languages, lang, setLang, history, onHistory }) {
  return (
    <>
      <Hero health={health} report={report} languages={languages} lang={lang} setLang={setLang} onHistory={onHistory} />
      <div className="recent-wrap"><Recent items={history} /></div>
      <Languages report={report} languages={languages} setLang={setLang} />
      <Pipeline />
      <ResultsTeaser report={report} />
      <GoodToKnow report={report} />
      <p className="privacy"><Lock size={16} /> Audio is analysed by the server you are connected to and deleted right after. Nothing is stored. <Cpu size={16} /> No GPU needed.</p>
    </>
  );
}
