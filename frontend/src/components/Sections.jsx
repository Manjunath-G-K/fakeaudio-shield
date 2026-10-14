import { useEffect, useState } from "react";
import { pct } from "../api.js";
import {
  AlertIcon, ArrowRightIcon, BrainIcon, CheckIcon, FilterIcon, FlagIcon, GaugeIcon, GlobeIcon,
  LayersIcon, NewsIcon, ScaleIcon, SearchIcon, ShieldIcon, SpectrumIcon, UploadIcon, WaveIcon,
} from "./icons.jsx";

/* ---------- Navigation ---------------------------------------------------- */

export function Nav({ health }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const online = health?.model_loaded;
  return (
    <header className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="container nav-inner">
        <a href="#top" className="brand" aria-label="FakeAudio Shield home">
          <span className="brand-mark"><ShieldIcon size={20} /></span>
          FakeAudio Shield
        </a>
        <nav className="nav-links" aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#results">Results</a>
          <a href="#use-cases">Use cases</a>
          <a href="#team">Team</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="nav-right">
          <span className={`model-pill ${health === null ? "" : online ? "on" : "off"}`} role="status" aria-live="polite">
            <span className="dot" />
            {health === null ? "Connecting…" : online ? "Model online" : "Model offline"}
          </span>
          <a href="#detector" className="btn btn-primary btn-sm">Try it</a>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero ----------------------------------------------------------- */

const HERO_BARS = Array.from({ length: 48 }, (_, i) =>
  0.25 + 0.6 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.17)));

export function Hero({ health }) {
  const test = health?.metrics?.test;
  return (
    <section className="hero" id="top">
      <div className="hero-glow" aria-hidden="true" />
      <div className="container hero-inner">
        <div className="hero-copy">
          <div className="hero-badge">Wav2Vec2 + LCNN · Major Project 2025–26</div>
          <h1>Is that voice <span className="hl">real</span>, or <span className="hl-ai">AI-generated</span>?</h1>
          <p className="lead">
            Voice cloning can copy anyone from a few seconds of audio. FakeAudio Shield analyses a
            recording and tells you whether it is likely genuine human speech or synthetic, with a
            confidence score, in about a second.
          </p>
          <div className="hero-cta">
            <a href="#detector" className="btn btn-primary btn-lg">Analyse a recording <ArrowRightIcon size={18} /></a>
            <a href="#how" className="btn btn-ghost btn-lg">See how it works</a>
          </div>
          <ul className="hero-points">
            <li><CheckIcon size={16} /> No sign-up, runs on your own machine</li>
            <li><CheckIcon size={16} /> WAV, FLAC, MP3, OGG, M4A</li>
            <li><CheckIcon size={16} /> Measured on unseen attacks</li>
          </ul>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-card">
            <div className="hero-card-top">
              <span className="dot-row"><i /><i /><i /></span>
              <span className="mono small">ai-voice-a17.flac</span>
            </div>
            <div className="hero-wave">
              {HERO_BARS.map((h, i) => (
                <span key={i} style={{ "--h": h, "--d": `${(i % 12) * 0.08}s` }} />
              ))}
              <div className="hero-scan" />
            </div>
            <div className="hero-card-result">
              <div>
                <div className="eyebrow light">Example result · test set</div>
                <div className="hero-verdict">AI-GENERATED</div>
              </div>
              <div className="hero-conf"><span>99.8%</span><small>confidence</small></div>
            </div>
          </div>
          {test && (
            <div className="hero-float">
              <GaugeIcon size={18} /> Test EER <strong>{pct(test.eer, 2)}</strong> on unseen attacks
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Stats strip (live from /api/health) --------------------------- */

export function Stats({ health }) {
  const t = health?.metrics?.test;
  const items = [
    { value: t ? pct(t.eer, 2) : "–", label: "Equal Error Rate on 13 unseen attack types" },
    { value: t ? `${t.bonafide_correct}/${t.bonafide_total}` : "–", label: "Real voices correctly passed" },
    { value: "≈1 s", label: "Per clip on a laptop CPU, no GPU" },
    { value: "5", label: "Audio formats supported" },
  ];
  return (
    <section className="stats" aria-label="Key numbers">
      <div className="container stats-grid">
        {items.map((s) => (
          <div key={s.label} className="stat">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- How it works --------------------------------------------------- */

const PIPELINE = [
  { icon: UploadIcon, title: "Upload", text: "Drop a WAV, FLAC, MP3, OGG or M4A file. Type and size are checked in the browser.", where: "React" },
  { icon: FilterIcon, title: "Preprocess", text: "Resample to 16 kHz mono, trim silence, normalise volume, split into 4-second segments.", where: "FastAPI" },
  { icon: SpectrumIcon, title: "Spectral features", text: "80 log-mel + 20 MFCC values for every 20 ms, the acoustic fingerprint of the sound.", where: "Librosa" },
  { icon: WaveIcon, title: "Wav2Vec2", text: "A speech model pre-trained on 960 h of audio describes each 20 ms with 768 numbers.", where: "PyTorch" },
  { icon: LayersIcon, title: "LCNN classifier", text: "A Light CNN with Max-Feature-Map, the classic ASVspoof countermeasure, scores real vs. spoof.", where: "PyTorch" },
  { icon: GaugeIcon, title: "Verdict", text: "Softmax probabilities, averaged over segments, become the verdict and the confidence score.", where: "React" },
];

export function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">How it works</div>
          <h2>From waveform to verdict in six steps</h2>
          <p>The same preprocessing code runs during training and prediction, so the model always sees audio prepared the same way.</p>
        </div>
        <ol className="pipeline">
          {PIPELINE.map(({ icon: Ico, title, text, where }, i) => (
            <li key={title} className="pipe-card">
              <div className="pipe-top">
                <span className="pipe-icon"><Ico size={22} /></span>
                <span className="pipe-num">0{i + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="pipe-where">{where}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Results / transparency (live) --------------------------------- */

function MetricCard({ title, subtitle, m, highlight }) {
  return (
    <div className={`metric-card ${highlight ? "highlight" : ""}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-sub">{subtitle}</div>
      <div className="metric-eer">{m ? pct(m.eer, 2) : "–"}<small>EER</small></div>
      <dl>
        <div><dt>Real voices passed</dt><dd>{m ? `${m.bonafide_correct} / ${m.bonafide_total}` : "–"}</dd></div>
        <div><dt>AI voices caught (50% threshold)</dt><dd>{m ? `${m.spoof_correct} / ${m.spoof_total}` : "–"}</dd></div>
        <div><dt>Accuracy</dt><dd>{m ? pct(m.accuracy) : "–"}</dd></div>
      </dl>
    </div>
  );
}

export function Results({ health }) {
  const dev = health?.metrics?.dev;
  const test = health?.metrics?.test;
  const info = health?.train_info;
  return (
    <section className="section section-alt" id="results">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Results</div>
          <h2>Measured, not promised</h2>
          <p>
            These numbers are read live from the model that is running right now. The test set contains
            13 voice-generation methods that the model <em>never</em> saw during training, the honest
            way to estimate performance on new fakes.
          </p>
        </div>

        <div className="metrics-grid">
          <MetricCard title="Dev set" subtitle="Seen attack types (A01–A06) · used to pick the model" m={dev} />
          <MetricCard title="Test set" subtitle="Unseen attack types (A07–A19) · used once, at the end" m={test} highlight />
          <div className="explain-card">
            <h3>How to read this</h3>
            <p><strong>EER</strong> (Equal Error Rate) is where false alarms equal misses. Lower is better.</p>
            <p>
              The model almost never calls a real voice fake. At the default 50% threshold it misses some
              fakes from generators it has never seen, so detection improves as training data gets more diverse.
            </p>
            {info && (
              <p className="small muted">
                Trained on {(info.train_bonafide + info.train_spoof).toLocaleString("en-IN")} clips · {info.datasets}
                {health.trained_at && <> · {new Date(health.trained_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>}
              </p>
            )}
          </div>
        </div>

        <div className="limits">
          <AlertIcon size={20} />
          <div>
            <strong>Limitations we are open about.</strong> Wav2Vec2 is used frozen (CPU-only training), the
            model is trained on a 2,500-clip subset, the current model is English-only, and new voice
            cloners, phone calls, noise or music can reduce accuracy. A result supports human judgement;
            it is never proof.
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Use cases (from the project presentation) ---------------------- */

const USES = [
  { icon: SearchIcon, title: "Fraud investigation", text: "Check a suspicious voice message, like an urgent call from a \"relative\" or \"boss\", before acting on it." },
  { icon: NewsIcon, title: "Journalism & fact-checking", text: "Verify that an audio clip of a public figure is genuine before publishing it." },
  { icon: ScaleIcon, title: "Digital forensics", text: "Supporting analysis for investigators, with probabilities and per-segment scores." },
  { icon: FlagIcon, title: "Content moderation", text: "Flag possibly AI-generated voice content for human review." },
];

export function UseCases() {
  return (
    <section className="section" id="use-cases">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Use cases</div>
          <h2>Built for people who need to trust what they hear</h2>
        </div>
        <div className="use-grid">
          {USES.map(({ icon: Ico, title, text }) => (
            <div key={title} className="use-card">
              <span className="use-icon"><Ico size={22} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Roadmap -------------------------------------------------------- */

const ROADMAP = [
  { state: "done", title: "English detector", text: "Wav2Vec2 + LCNN trained on ASVspoof 2019 LA, tested on unseen attacks, web app." },
  { state: "now", title: "Indian languages", text: "Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi and Bengali using Kathbath (real) + IndicSynth (AI). Pipeline built; data collection in progress." },
  { state: "next", title: "Calibrated threshold", text: "Tune the decision threshold on held-out data so more unseen fakes are caught." },
  { state: "next", title: "Wider testing", text: "ASVspoof 2021 DF, WaveFake and in-the-wild recordings." },
];

export function Roadmap() {
  return (
    <section className="section section-alt" id="roadmap">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Roadmap</div>
          <h2>Where we are, and what comes next</h2>
        </div>
        <ol className="roadmap">
          {ROADMAP.map((r) => (
            <li key={r.title} className={`road ${r.state}`}>
              <span className="road-state">{r.state === "done" ? "Done" : r.state === "now" ? "In progress" : "Planned"}</span>
              <h3>{r.state === "now" && <GlobeIcon size={18} />} {r.title}</h3>
              <p>{r.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Team ----------------------------------------------------------- */

const TEAM = [
  { name: "Anitha M", usn: "" },
  { name: "Madiha Naz", usn: "" },
  { name: "Mallikarjun M B", usn: "" },
  { name: "Manjunath G K", usn: "" },
];
const initials = (n) => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("");

export function Team() {
  return (
    <section className="section" id="team">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Team</div>
          <h2>The people behind FakeAudio Shield</h2>
          <p>B.E. Computer Science &amp; Engineering, University B.D.T College of Engineering, Davangere (VTU, Belagavi).</p>
        </div>
        <div className="team-grid">
          {TEAM.map((m) => (
            <div key={m.usn} className="person">
              <span className="avatar">{initials(m.name)}</span>
              <div className="person-name">{m.name}</div>
              <div className="person-meta mono">{m.usn}</div>
            </div>
          ))}
          <div className="person guide">
            <span className="avatar"><BrainIcon size={22} /></span>
            <div className="person-name">Prof. Naveen Kumar B</div>
            <div className="person-meta">Project guide · Dept. of CSE</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ------------------------------------------------------------ */

const FAQS = [
  { q: "What exactly does the confidence score mean?", a: "It is the model's probability for the verdict it chose. 99% AI-generated means the model is very sure, not that the clip is certainly fake. Treat it as evidence that supports human judgement." },
  { q: "Is my audio uploaded to the cloud?", a: "No. The backend runs on your own machine (FastAPI on port 8000). Files are written to a temporary file for analysis and deleted straight away." },
  { q: "Why Wav2Vec2 and an LCNN?", a: "Wav2Vec2 is pre-trained on lots of real speech, so it captures fine details of human voices that synthetic speech often gets slightly wrong. The LCNN is small and fast, and was a strong baseline in the ASVspoof challenges." },
  { q: "Can it detect every AI voice?", a: "No detector can. It reliably catches the kinds of fakes it has learned from and some new ones, but at the default threshold it misses about a third of fakes from generators it has never seen. Try the \"Neural TTS (A10)\" sample for an example." },
  { q: "Which languages are supported?", a: "The current model is trained on English. Support for Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi and Bengali is being built (see the roadmap)." },
  { q: "What files can I use?", a: "WAV, FLAC, MP3, OGG or M4A up to 20 MB with at least half a second of speech. Only the first 60 seconds are analysed. Silent, empty or corrupted files are rejected with a clear message instead of a guess." },
];

export function FAQ() {
  return (
    <section className="section section-alt" id="faq">
      <div className="container narrow">
        <div className="section-head">
          <div className="eyebrow">FAQ</div>
          <h2>Questions, answered</h2>
        </div>
        <div className="faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ------------------------------------------------------------ */

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <a href="#top" className="brand light"><span className="brand-mark"><ShieldIcon size={18} /></span>FakeAudio Shield</a>
          <p>AI-Generated Voice &amp; Deepfake Audio Detection System. A B.E. CSE major project, 2025–26.</p>
        </div>
        <div className="footer-cols">
          <div>
            <h4>Project</h4>
            <a href="#how">How it works</a>
            <a href="#results">Results</a>
            <a href="#roadmap">Roadmap</a>
          </div>
          <div>
            <h4>College</h4>
            <span>University B.D.T College of Engineering</span>
            <span>Davangere · VTU, Belagavi</span>
          </div>
        </div>
      </div>
      <div className="container footer-note">
        Sample clips and training data: ASVspoof 2019 LA (Edinburgh DataShare), Open Data Commons Attribution License.
        Results are predictions, not proof of authenticity.
      </div>
    </footer>
  );
}
