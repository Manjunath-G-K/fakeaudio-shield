// Small building blocks of the report page: grouped lists, rows, inline charts.
import { pct } from "../../lib/format.js";
import { Chevron } from "../../components/icons.jsx";

export function Group({ id, title, note, children }) {
  return (
    <section className="group" id={id} aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`}>{title}</h2>
      <div className="group-body">{children}</div>
      {note && <p className="group-note">{note}</p>}
    </section>
  );
}

/** Plain row: label on the left, value on the right. */
export const Row = ({ label, sub, value, valueSub }) => (
  <div className="row-item">
    <span className="row-label">{label}{sub && <small>{sub}</small>}</span>
    <span className="row-value tabular">{value}{valueSub && <small>{valueSub}</small>}</span>
  </div>
);

/** Row that expands to show more. */
export function ExpandRow({ summary, children }) {
  return (
    <details className="row-expand">
      <summary>{summary}<Chevron size={16} className="row-chevron" /></summary>
      <div className="row-detail">{children}</div>
    </details>
  );
}

const SCALE = 0.3;   // EER axis: 0–30%
const at = (v) => `${Math.min(100, (v / SCALE) * 100)}%`;

/** Tiny number line: EER dot with its 95% interval, and the 10% "supported" line. */
export function EerLine({ eer, ci, status }) {
  return (
    <span className="eer-line" role="img" aria-label={`EER ${pct(eer)}, 95% interval ${ci ? `${pct(ci[0])} to ${pct(ci[1])}` : "not available"}`}>
      <span className="eer-ok" style={{ width: at(0.1) }} />
      {ci && <span className="eer-ci" style={{ left: at(ci[0]), width: `max(3px, calc(${at(ci[1])} - ${at(ci[0])}))` }} />}
      <span className={`eer-dot s-${status.replace(" ", "-")}`} style={{ left: at(eer) }} />
    </span>
  );
}

export const EerScale = () => (
  <div className="eer-scale" aria-hidden="true">
    <span style={{ left: 0 }}>0%</span><span className="at-line" style={{ left: at(0.1) }}>10% supported</span><span style={{ left: "100%" }}>30%</span>
  </div>
);

/** Horizontal share bars, e.g. AI voices caught per generator. */
export function ShareBars({ rows }) {
  return (
    <ul className="share-bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span>
          <span className="share-track"><span className={r.value < 0.5 ? "low" : ""} style={{ width: `${r.value * 100}%` }} /></span>
          <span className="tabular">{Math.round(r.value * 100)}%<small> {r.detail}</small></span>
        </li>
      ))}
    </ul>
  );
}

/** Train/dev/test proportions of one language. */
export function SplitBar({ d }) {
  const n = (s) => d[s].bonafide + d[s].spoof;
  const total = n("train") + n("dev") + n("test") || 1;
  return (
    <span className="split-bar" role="img" aria-label={`train ${n("train")}, dev ${n("dev")}, test ${n("test")}`}>
      {["train", "dev", "test"].map((s) => <span key={s} className={`sp-${s}`} style={{ width: `${(n(s) / total) * 100}%` }} />)}
    </span>
  );
}

/** Dev EER per epoch, best epoch marked. */
export function EpochSpark({ history, best }) {
  if (!history?.length || history.length < 2) return null;
  const w = 240, h = 56, pad = 6;
  const v = history.map((x) => x.dev_macro_eer ?? x.dev_eer);
  const top = Math.max(...v) || 1;
  const px = (i) => pad + (i / (v.length - 1)) * (w - pad * 2);
  const py = (y) => h - pad - (y / top) * (h - pad * 2);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Dev error rate after each training epoch">
      <path d={v.map((y, i) => `${i ? "L" : "M"}${px(i)},${py(y)}`).join(" ")} />
      {v.map((y, i) => <circle key={i} cx={px(i)} cy={py(y)} r={history[i].epoch === best ? 4.5 : 2.5} className={history[i].epoch === best ? "best" : ""} />)}
    </svg>
  );
}

/** Test and dev EER against training-set size (log scale). */
export function LearningCurve({ rows }) {
  const w = 560, h = 200, l = 40, r = 16, t = 24, b = 40;
  const top = Math.max(...rows.flatMap((p) => [p.test_eer, p.dev_eer])) * 1.2;
  const xs = rows.map((p) => Math.log10(p.train_clips));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const px = (n) => l + ((Math.log10(n) - x0) / (x1 - x0 || 1)) * (w - l - r);
  const py = (v) => t + (1 - v / top) * (h - t - b);
  const line = (k) => rows.map((p, i) => `${i ? "L" : "M"}${px(p.train_clips)},${py(p[k])}`).join(" ");
  return (
    <svg className="lcurve" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Error rate against number of training clips">
      {[0, top / 2, top].map((v) => <g key={v}><line x1={l} x2={w - r} y1={py(v)} y2={py(v)} /><text x={l - 6} y={py(v) + 4} className="end">{pct(v, 0)}</text></g>)}
      <path d={line("dev_eer")} className="dev" />
      <path d={line("test_eer")} className="test" />
      {rows.map((p) => (
        <g key={p.train_clips}>
          <circle cx={px(p.train_clips)} cy={py(p.test_eer)} r="4.5" />
          <text x={px(p.train_clips)} y={py(p.test_eer) - 10} className="strong">{pct(p.test_eer)}</text>
          <text x={px(p.train_clips)} y={h - 20}>{p.train_clips.toLocaleString("en-US")}</text>
        </g>
      ))}
      <text x={(l + w - r) / 2} y={h - 4}>training clips (log scale)</text>
    </svg>
  );
}
