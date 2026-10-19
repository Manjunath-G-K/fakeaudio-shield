import { Alert, Brain, Check, Cross, Lock, Mic, Person, Robot, Wave } from "./icons.jsx";

export function Recent({ items }) {
  if (!items.length) return null;
  return (
    <section className="recent" aria-label="Recent checks">
      <h2>Your recent checks</h2>
      <ul>
        {items.map((h, i) => (
          <li key={i}>
            <span className={`pill ${h.label === "spoof" ? "ai" : "real"}`}>
              {h.label === "spoof" ? <Robot size={14} /> : <Person size={14} />}
              {h.label === "spoof" ? "AI" : "Real"}
            </span>
            <span className="recent-name">{h.kind === "recording" ? "Your recording" : h.name}</span>
            <span className="recent-conf">{h.confidence >= 0.995 ? ">99" : Math.round(h.confidence * 100)}%</span>
            {h.truth && (h.truth === h.label
              ? <span className="recent-truth good"><Check size={14} /> correct</span>
              : <span className="recent-truth bad"><Cross size={14} /> missed</span>)}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { icon: Wave, title: "Clean up the audio", text: "Converted to 16 kHz, silence trimmed, volume evened out, cut into 4-second parts." },
    { icon: Brain, title: "Listen for voice patterns", text: "Wav2Vec2, a speech model trained on 960 hours of real speech, plus classic MFCC and mel-spectrogram features." },
    { icon: Check, title: "Decide: real or AI", text: "A small neural network (LCNN) scores each part, and the scores are averaged into one answer." },
  ];
  return (
    <section className="section" id="how">
      <h2>How it works</h2>
      <p className="section-sub">Three steps, about one second on a normal laptop.</p>
      <ol className="steps">
        {steps.map(({ icon: Ico, title, text }, i) => (
          <li key={title}>
            <span className="step-num">{i + 1}</span>
            <span className="step-icon"><Ico size={22} /></span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Accuracy({ health }) {
  const t = health?.metrics?.test;
  const attacks = Object.entries(t?.by_attack ?? {});
  return (
    <section className="section" id="accuracy">
      <h2>How accurate is it?</h2>
      <p className="section-sub">
        Tested on 800 clips it never heard during training. Half are real people; half are AI voices made by 13 different tools it had never seen before.
      </p>
      <div className="stats">
        <div className="stat good">
          <strong>{t ? `${t.bonafide_correct} of ${t.bonafide_total}` : "–"}</strong>
          <span>real voices correctly recognised as real</span>
        </div>
        <div className="stat warn">
          <strong>{t ? `${t.spoof_correct} of ${t.spoof_total}` : "–"}</strong>
          <span>AI voices caught, from tools it had never seen</span>
        </div>
        <div className="stat">
          <strong>{t ? `${(t.eer * 100).toFixed(1)}%` : "–"}</strong>
          <span>equal error rate (EER), the standard score in this field. Lower is better.</span>
        </div>
      </div>
      {attacks.length > 0 && (
        <details className="per-tool">
          <summary>See results for each AI voice tool</summary>
          <ul>
            {attacks.map(([a, m]) => {
              const rate = m.spoof_total ? m.spoof_correct / m.spoof_total : 0;
              return (
                <li key={a}>
                  <span className="tool-name">Tool {a}</span>
                  <span className="tool-bar"><span style={{ width: `${rate * 100}%` }} className={rate < 0.5 ? "low" : ""} /></span>
                  <span className="tool-val">{Math.round(rate * 100)}% caught</span>
                </li>
              );
            })}
          </ul>
          <p className="fineprint">The tools are the ASVspoof 2019 attacks A07–A19. Some are caught almost every time, others rarely.</p>
        </details>
      )}
    </section>
  );
}

export function GoodToKnow() {
  const items = [
    { icon: Mic, title: "Works best with clear speech", text: "5–60 seconds of one person talking. Only the first 60 seconds of speech are checked." },
    { icon: Alert, title: "New AI voices can slip through", text: "It catches most voices like the ones it learned from, but misses some made by newer tools." },
    { icon: Wave, title: "English for now", text: "Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi and Bengali are being added." },
    { icon: Lock, title: "Your audio stays on this computer", text: "Everything runs locally. Uploaded files are deleted right after the check." },
  ];
  return (
    <section className="section" id="good-to-know">
      <h2>Good to know</h2>
      <div className="know">
        {items.map(({ icon: Ico, title, text }) => (
          <div key={title} className="know-item">
            <span className="know-icon"><Ico size={20} /></span>
            <div><h3>{title}</h3><p>{text}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
