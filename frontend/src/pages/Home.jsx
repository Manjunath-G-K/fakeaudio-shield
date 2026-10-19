import Checker from "../components/Checker.jsx";
import { CountUp, ScoreRing, pct } from "../components/charts.jsx";
import { Arrow, Brain, Check, Cpu, Lock, Mic, Wave } from "../components/icons.jsx";
import { GoodToKnow, Recent } from "../components/Info.jsx";
import { useReveal } from "../hooks.js";
import { ALL_LANGUAGES, NATIVE } from "../samples.js";

const STATUS_TEXT = { supported: "Supported", experimental: "Experimental", "not supported": "Not supported" };

function Hero({ health, report, lang, setLang, onHistory }) {
  const t = report?.overall;
  const langs = Object.keys(report?.languages ?? {});
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Deepfake voice detection</p>
        <h1>Is this voice <span className="hl-real">real</span>, or <span className="hl-ai">AI</span>?</h1>
        <p className="lead">
          Record yourself, upload a clip or try a sample. FakeAudio Shield listens for the tiny
          artefacts that voice-cloning tools leave behind, and tells you in about a second.
        </p>
        <div className="hero-cta">
          <a href="#/results" className="btn primary">See measured results <Arrow size={18} /></a>
          <a href="#how" className="btn ghost">How it works</a>
        </div>
        <dl className="hero-facts">
          <div><dt><CountUp value={langs.length || null} /></dt><dd>{langs.length === 1 ? "language" : "languages"} evaluated</dd></div>
          <div><dt>{t?.eer != null ? <CountUp value={t.eer} format={(v) => pct(v, 1)} /> : "–"}</dt><dd>error rate on unseen voices</dd></div>
          <div><dt>~1 s</dt><dd>per check, on a laptop CPU</dd></div>
        </dl>
      </div>
      <div className="hero-tool">
        <Checker ready={!!health?.model_loaded} onHistory={onHistory} report={report} lang={lang} setLang={setLang} />
      </div>
    </section>
  );
}

function Languages({ report, setLang }) {
  const ref = useReveal();
  const excluded = report?.dataset?.excluded_languages ?? {};
  return (
    <section className="section reveal" id="languages" ref={ref}>
      <div className="section-head">
        <h2>Language coverage</h2>
        <p>Every number comes from an evaluation on speakers the model never heard. Languages without measured results are shown as in progress, not claimed.</p>
      </div>
      <div className="lang-grid">
        {ALL_LANGUAGES.map((l) => {
          const L = report?.languages?.[l];
          const status = L ? L.status : "in progress";
          return (
            <button key={l} type="button" className={`lang-card st-${status.replace(" ", "-")}`}
                    onClick={() => { setLang(l); document.getElementById("check")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
              <div className="lang-top">
                <span className="lang-name"><strong>{l}</strong>{NATIVE[l] !== l && <small>{NATIVE[l]}</small>}</span>
                <ScoreRing value={L?.test?.accuracy ?? null} size={58} label={`${l} test accuracy`}
                           tone={status === "supported" ? "good" : status === "experimental" ? "warn" : "muted"} />
              </div>
              <span className={`chip st-${status.replace(" ", "-")}`}>{STATUS_TEXT[status] ?? "In progress"}</span>
              <span className="lang-meta">
                {L ? `${L.test.bonafide_total + L.test.spoof_total} test clips · EER ${pct(L.test.eer)}`
                  : excluded[l] ? "Waiting for real-speech data" : "Not collected yet"}
              </span>
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
    { icon: Mic, title: "Your audio", text: "Any WAV, FLAC, MP3, OGG or M4A, or a recording from your mic.", tech: "≤ 20 MB · first 60 s" },
    { icon: Wave, title: "Clean up", text: "Resampled, silence trimmed, volume evened out, cut into 4-second parts.", tech: "16 kHz mono" },
    { icon: Brain, title: "Listen", text: "A speech model trained on 960 h of real voices, plus classic spectral features.", tech: "Wav2Vec2 + MFCC/log-mel" },
    { icon: Check, title: "Decide", text: "A compact neural network scores each part; scores are averaged into one answer.", tech: "LCNN · threshold 0.5" },
  ];
  return (
    <section className="section reveal" id="how" ref={ref}>
      <div className="section-head">
        <h2>How it works</h2>
        <p>Four steps, about one second on a normal laptop. Nothing leaves your computer.</p>
      </div>
      <ol className="pipeline">
        {steps.map(({ icon: Ico, title, text, tech }, i) => (
          <li key={title} style={{ "--i": i }}>
            <span className="pipe-node"><Ico size={22} /></span>
            <h3>{title}</h3>
            <p>{text}</p>
            <code>{tech}</code>
          </li>
        ))}
        <span className="pipe-line" aria-hidden="true"><i /></span>
      </ol>
    </section>
  );
}

function ResultsTeaser({ report }) {
  const ref = useReveal();
  const t = report?.overall;
  const model = report?.model;
  if (!t) return null;
  return (
    <section className="section reveal" ref={ref}>
      <div className="teaser">
        <div>
          <h2>Measured, not promised</h2>
          <p>Tested on {(t.bonafide_total + t.spoof_total).toLocaleString("en-IN")} clips the model never heard, with 95% confidence intervals, per-language breakdowns and the full dataset audit.</p>
          <a href="#/results" className="btn primary">Open the results <Arrow size={18} /></a>
        </div>
        <dl className="teaser-stats">
          <div><dt><CountUp value={t.bonafide_correct / t.bonafide_total} format={(v) => pct(v, 1)} /></dt><dd>of real voices recognised as real</dd></div>
          <div><dt><CountUp value={t.spoof_correct / t.spoof_total} format={(v) => pct(v, 1)} /></dt><dd>of unseen AI voices caught</dd></div>
          <div><dt><CountUp value={model?.trainable_parameters} format={(v) => Math.round(v).toLocaleString("en-US")} /></dt><dd>trainable parameters (runs on a CPU)</dd></div>
        </dl>
      </div>
    </section>
  );
}

export default function Home({ health, report, lang, setLang, history, onHistory }) {
  return (
    <>
      <Hero health={health} report={report} lang={lang} setLang={setLang} onHistory={onHistory} />
      <div className="recent-wrap"><Recent items={history} /></div>
      <Languages report={report} setLang={setLang} />
      <Pipeline />
      <ResultsTeaser report={report} />
      <GoodToKnow report={report} />
      <p className="privacy"><Lock size={16} /> Runs locally: audio is analysed on this machine and deleted right after. <Cpu size={16} /> No GPU needed.</p>
    </>
  );
}
