import { useCountUp } from "../hooks.js";

const pct = (x, d = 1) => (x == null ? "–" : `${(x * 100).toFixed(d)}%`);

/** Animated count-up number, e.g. <CountUp value={0.0825} format={(v) => pct(v, 2)} /> */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString("en-IN") }) {
  const [v, ref] = useCountUp(value);
  return <span ref={ref}>{value == null ? "–" : format(v)}</span>;
}

/** Ring showing a 0..1 score that fills when scrolled into view. */
export function ScoreRing({ value, size = 64, tone = "brand", label }) {
  const [v, ref] = useCountUp(value ?? 0, 1200);
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  return (
    <span className={`ring tone-${tone}`} ref={ref} style={{ width: size, height: size }} role="img"
          aria-label={value == null ? `${label}: not measured` : `${label}: ${pct(value, 0)}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        {value != null && (
          <circle cx={size / 2} cy={size / 2} r={r} className="ring-fill"
                  strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )}
      </svg>
      <b>{value == null ? "–" : `${Math.round(v * 100)}`}<small>{value == null ? "" : "%"}</small></b>
    </span>
  );
}

/**
 * Horizontal EER chart with 95% CI whiskers and the support thresholds (10% / 25%).
 * rows: [{ lang, eer, ci: [lo, hi], status }]
 */
export function EerChart({ rows, max = 0.5 }) {
  const x = (v) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="eer-chart" role="img" aria-label="Equal error rate per language with 95% confidence intervals">
      <div className="eer-zones" aria-hidden="true">
        <span className="zone ok" style={{ width: x(0.1) }}><em>supported ≤ 10%</em></span>
        <span className="zone mid" style={{ left: x(0.1), width: `calc(${x(0.25)} - ${x(0.1)})` }}><em>experimental ≤ 25%</em></span>
      </div>
      {rows.map((r) => (
        <div className="eer-row" key={r.lang}>
          <span className="eer-lang">{r.lang}</span>
          <span className="eer-track">
            {r.ci && <span className="eer-ci" style={{ left: x(r.ci[0]), width: `calc(${x(r.ci[1])} - ${x(r.ci[0])})` }} />}
            {r.eer != null && <span className={`eer-dot s-${r.status?.replace(" ", "-")}`} style={{ left: x(r.eer) }} />}
          </span>
          <span className="eer-val">{pct(r.eer)}</span>
        </div>
      ))}
      <div className="eer-axis" aria-hidden="true">
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5].filter((t) => t <= max).map((t) => <span key={t} style={{ left: x(t) }}>{Math.round(t * 100)}%</span>)}
      </div>
    </div>
  );
}

/** Small line chart of dev EER by epoch. history: [{ epoch, dev_macro_eer }] */
export function TrainingCurve({ history, best }) {
  if (!history?.length) return null;
  const w = 320, h = 120, pad = 22;
  const vals = history.map((p) => p.dev_macro_eer ?? p.dev_eer);
  const top = Math.max(...vals) * 1.1 || 1;
  const px = (i) => pad + (i / Math.max(1, history.length - 1)) * (w - pad * 2);
  const py = (v) => h - pad - (v / top) * (h - pad * 2);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  return (
    <svg className="curve" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Dev EER after each training epoch">
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} className="curve-axis" />
      <path d={`${d} L${px(vals.length - 1)},${h - pad} L${pad},${h - pad} Z`} className="curve-area" />
      <path d={d} className="curve-line" />
      {vals.map((v, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(v)} r={history[i].epoch === best ? 5 : 3} className={history[i].epoch === best ? "curve-best" : "curve-dot"} />
          <text x={px(i)} y={h - 6} className="curve-label">{history[i].epoch}</text>
        </g>
      ))}
      <text x={pad} y={12} className="curve-label">{pct(top, 0)}</text>
    </svg>
  );
}

/** Learning curve: test EER (and dev EER) against number of training clips. rows: [{ train_clips, test_eer, dev_eer }] */
export function LearningCurve({ rows }) {
  if (!rows?.length) return null;
  const w = 520, h = 214, l = 44, r = 16, t = 30, b = 42;
  const top = Math.max(...rows.flatMap((p) => [p.test_eer, p.dev_eer])) * 1.15;
  const xs = rows.map((p) => Math.log10(p.train_clips));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const px = (n) => l + ((Math.log10(n) - x0) / (x1 - x0 || 1)) * (w - l - r);
  const py = (v) => t + (1 - v / top) * (h - t - b);
  const line = (key) => rows.map((p, i) => `${i ? "L" : "M"}${px(p.train_clips).toFixed(1)},${py(p[key]).toFixed(1)}`).join(" ");
  const ticks = [0, top / 2, top].map((v) => Math.round(v * 1000) / 1000);
  return (
    <svg className="lcurve" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Equal error rate versus number of training clips">
      {ticks.map((v) => (
        <g key={v}><line x1={l} x2={w - r} y1={py(v)} y2={py(v)} className="curve-axis" /><text x={l - 6} y={py(v) + 3} className="curve-label end">{pct(v, 0)}</text></g>
      ))}
      <path d={line("dev_eer")} className="curve-line dev" />
      <path d={line("test_eer")} className="curve-line" />
      {rows.map((p) => (
        <g key={p.train_clips}>
          <circle cx={px(p.train_clips)} cy={py(p.test_eer)} r={4.5} className="curve-best" />
          <text x={px(p.train_clips)} y={py(p.test_eer) - 9} className="curve-label strong">{pct(p.test_eer, 1)}</text>
          <text x={px(p.train_clips)} y={h - 24} className="curve-label">{p.train_clips.toLocaleString("en-US")}</text>
        </g>
      ))}
      <text x={(l + w - r) / 2} y={h - 6} className="curve-label">training clips (log scale)</text>
    </svg>
  );
}

/** Stacked horizontal bar of counts, e.g. train / dev / test. */
export function StackBar({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="stack" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
      {parts.map((p) => <span key={p.label} className={`stack-${p.key}`} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />)}
    </div>
  );
}

export { pct };
