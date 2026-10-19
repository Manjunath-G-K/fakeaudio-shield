import { useCountUp } from "../hooks.js";

const pct = (x, d = 1) => (x == null ? "–" : `${(x * 100).toFixed(d)}%`);
// a model score is an estimate, never certainty: show ">99" / "<1" instead of 100 / 0
const prob = (x) => (x >= 0.995 ? ">99" : x < 0.005 ? "<1" : `${Math.round(x * 100)}`);

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

/** Half-circle gauge for P(AI), 0..1, with the decision line at 50%. */
export function Gauge({ value }) {
  const [v, ref] = useCountUp(value, 900);
  const r = 80, cx = 100, cy = 96, len = Math.PI * r;
  const at = (p) => [cx - r * Math.cos(Math.PI * p), cy - r * Math.sin(Math.PI * p)];
  const [nx, ny] = at(v);
  const arc = `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;
  return (
    <div className="gauge" ref={ref} role="img" aria-label={`Chance the voice is AI-generated: ${prob(value)}%`}>
      <svg viewBox="0 0 200 112" aria-hidden="true">
        <defs>
          <linearGradient id="gauge-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--real)" /><stop offset="50%" stopColor="var(--warn-line)" /><stop offset="100%" stopColor="var(--ai)" />
          </linearGradient>
        </defs>
        <path d={arc} className="gauge-track" />
        <path d={arc} className="gauge-fill" strokeDasharray={len} strokeDashoffset={len * (1 - v)} />
        <line x1={cx} y1={cy - r - 9} x2={cx} y2={cy - r + 9} className="gauge-mid" />
        <circle cx={nx} cy={ny} r="7.5" className="gauge-knob" />
      </svg>
      <div className="gauge-value"><b>{v === value ? prob(value) : Math.round(v * 100)}<small>%</small></b><span>chance of AI</span></div>
      <div className="gauge-ends" aria-hidden="true"><span>Real</span><span>AI</span></div>
    </div>
  );
}

/** One block per analysed 4-second part, coloured by its P(AI). */
export function SegmentStrip({ segments }) {
  if (!segments?.length) return null;
  const total = segments[segments.length - 1].end || 1;
  return (
    <div className="segs">
      <div className="segs-head"><span>Timeline</span><span>{segments.length} part{segments.length > 1 ? "s" : ""} · {total.toFixed(1)} s of speech</span></div>
      <div className="segs-bar" role="list">
        {segments.map((s) => {
          const p = s.spoof_probability;
          return (
            <span key={s.start} role="listitem" className={p >= 0.5 ? "ai" : "real"}
                  style={{ flexGrow: Math.max(0.5, s.end - s.start), "--p": p }}
                  title={`${s.start.toFixed(1)}–${s.end.toFixed(1)} s: ${prob(p)}% AI`}
                  aria-label={`${s.start.toFixed(1)} to ${s.end.toFixed(1)} seconds: ${prob(p)}% AI`}>
              <i>{prob(p)}%</i>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export { pct };
