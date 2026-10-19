import { useReveal } from "../hooks.js";
import { Alert, Check, Cross, Globe, Lock, Mic, Person, Robot } from "./icons.jsx";

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

export function GoodToKnow({ report }) {
  const ref = useReveal();
  const evaluated = Object.keys(report?.languages ?? {});
  const items = [
    { icon: Mic, title: "Works best with clear speech", text: "5–60 seconds of one person talking. Only the first 60 seconds of speech are checked." },
    { icon: Alert, title: "New AI voices can slip through", text: "It catches most voices like the ones it learned from, but misses some made by tools it has never seen." },
    { icon: Globe, title: evaluated.length ? `Measured for ${evaluated.join(", ")}` : "Pick the right language", text: "Choose the language spoken in the clip: it selects the model and the measured results that apply. Other languages are not supported." },
    { icon: Lock, title: "Nothing is stored", text: "Uploads are written to a temporary file, analysed and deleted immediately. Self-host it to keep audio on your own machine." },
  ];
  return (
    <section className="section reveal" id="good-to-know" ref={ref}>
      <div className="section-head"><p className="kicker">Good to know</p><h2>Use it wisely</h2></div>
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
