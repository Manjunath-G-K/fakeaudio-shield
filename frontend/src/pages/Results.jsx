import { useEffect, useState } from "react";
import { getDataSizeStudy } from "../api.js";
import { CountUp, EerChart, LearningCurve, StackBar, TrainingCurve, pct } from "../components/charts.jsx";
import { Alert, Arrow, Chart, Cpu, Database, Globe, Redo } from "../components/icons.jsx";
import { useReveal } from "../hooks.js";
import { ALL_LANGUAGES } from "../samples.js";

const ci = (c, d = 1) => (c ? `${(c[0] * 100).toFixed(d)}–${(c[1] * 100).toFixed(d)}%` : "–");
const rate = (k, n) => (n ? k / n : null);
const DEF_LABELS = { eer: "EER", accuracy: "Accuracy", real_passed: "Real passed", fake_caught: "AI caught",
  ci: "Confidence intervals", support_rule: "Support status" };
const STATUS = { supported: "Supported", experimental: "Experimental", "not supported": "Not supported" };

function Section({ id, icon: Ico, title, sub, children }) {
  const ref = useReveal();
  return (
    <section className="r-section reveal" id={id} ref={ref}>
      <div className="r-head">
        <span className="r-icon"><Ico size={20} /></span>
        <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      </div>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="results" aria-busy="true">
      <div className="sk sk-title" /><div className="sk sk-line" />
      <div className="r-summary">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-card" />)}</div>
      <div className="sk sk-block" />
    </div>
  );
}

function DataSizeStudy() {
  const [study, setStudy] = useState(undefined);
  useEffect(() => { getDataSizeStudy().then(setStudy); }, []);
  if (study === undefined) return <div className="sk sk-block" />;
  if (!study) return <p className="condition">The data-size study has not been run yet (<code>python data_size_study.py</code>).</p>;
  const rows = study.results;
  const full = rows[rows.length - 1], half = rows.find((r) => r.fraction === 0.5), tenth = rows[0];
  return (
    <div className="two-col">
      <div>
        <LearningCurve rows={rows} />
        <p className="fineprint">Purple: test EER. Light: dev EER. {study.model}; {study.epochs} epochs; {study.note}</p>
      </div>
      <div>
        <h3>What this shows</h3>
        <p className="condition">
          Going from {tenth.train_clips.toLocaleString("en-US")} to {half.train_clips.toLocaleString("en-US")} training clips changed test EER from {pct(tenth.test_eer)} to {pct(half.test_eer)};
          doubling again to {full.train_clips.toLocaleString("en-US")} changed it to {pct(full.test_eer)}.
        </p>
        <p className="condition">
          Because the speech model (Wav2Vec2) is pre-trained and frozen, the classifier only has to learn a small decision on top of it,
          so a few thousand balanced, diverse clips go a long way. What limits accuracy on new fakes is the <em>variety</em> of
          voice generators in training (see the per-attack chart), not the raw clip count. That is why we did not collect 100,000 clips.
        </p>
      </div>
    </div>
  );
}

function LanguageExplorer({ languages }) {
  const names = Object.keys(languages);
  const [sel, setSel] = useState(names[0]);
  const L = languages[sel];
  if (!L) return null;
  const attacks = Object.entries(L.test.by_attack ?? {});
  const isAsv = attacks.some(([a]) => /^A\d+/.test(a));
  return (
    <div className="explorer">
      <div className="explorer-tabs" role="tablist" aria-label="Choose a language">
        {names.map((n) => (
          <button key={n} role="tab" type="button" aria-selected={sel === n} className={sel === n ? "on" : ""} onClick={() => setSel(n)}>{n}</button>
        ))}
      </div>
      <div className="explorer-body">
        <div className="explorer-col">
          <h3>{sel}: dev vs test</h3>
          <table className="mini">
            <thead><tr><th /><th>EER</th><th>Accuracy</th><th>Clips</th></tr></thead>
            <tbody>
              {["dev", "test"].map((s) => L[s] && (
                <tr key={s}><td>{s === "dev" ? "Dev (model selection)" : "Test (final)"}</td>
                  <td>{pct(L[s].eer)}</td><td>{pct(L[s].accuracy)}</td><td>{L[s].bonafide_total + L[s].spoof_total}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="condition">{L.test_condition}</p>
          {L.train && <p className="condition">Trained on {L.train.bonafide} real + {L.train.spoof} AI clips.</p>}
        </div>
        <div className="explorer-col">
          <h3>AI voices caught, by {isAsv ? "attack system" : "generator"}</h3>
          {attacks.length === 0 ? <p className="condition">No breakdown available.</p> : (
            <ul className="attack-bars">
              {attacks.map(([a, m]) => {
                const r = rate(m.spoof_correct, m.spoof_total);
                return (
                  <li key={a}>
                    <span>{a}</span>
                    <span className="abar"><span className={r < 0.5 ? "low" : ""} style={{ width: `${r * 100}%` }} /><i /></span>
                    <span className="aval">{Math.round(r * 100)}% <small>({m.spoof_correct}/{m.spoof_total})</small></span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="condition">The tick marks 50%. Orange bars are systems the model catches less than half the time.</p>
        </div>
      </div>
    </div>
  );
}

export default function Results({ report, reload }) {
  if (!report) return <Skeleton />;
  if (report.error) {
    return (
      <div className="results empty-state">
        <Alert size={28} />
        <h1>Results aren't available</h1>
        <p>{report.error}</p>
        <button type="button" className="btn primary" onClick={reload}><Redo size={18} /> Try again</button>
      </div>
    );
  }

  const langs = report.languages;
  const names = Object.keys(langs);
  const o = report.overall;
  const ds = report.dataset;
  const tr = report.training;
  const testClips = o.bonafide_total + o.spoof_total;
  const usedSources = new Set(Object.values(ds?.languages ?? {}).flatMap((d) => d.sources));
  const needWork = [
    ...names.filter((n) => langs[n].status !== "supported").map((n) => ({ lang: n, why: `${STATUS[langs[n].status]}: test EER ${pct(langs[n].test.eer)} (95% CI ${ci(langs[n].test.eer_ci)}).` })),
    ...ALL_LANGUAGES.filter((l) => !langs[l]).map((l) => ({ lang: l, why: ds?.excluded_languages?.[l] ? `Not trained: ${ds.excluded_languages[l]}.` : "Not collected yet." })),
  ];

  return (
    <div className="results">
      <header className="r-hero">
        <p className="eyebrow">Evaluation report · {new Date(report.generated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
        <h1>Measured results</h1>
        <p className="lead">Everything on this page is read live from the evaluation stored with the running model. Test clips come from speakers, and for English from voice-generation systems, that the model never saw during training.</p>
        <a href="#/" className="btn ghost">Try it yourself <Arrow size={18} /></a>
      </header>

      <div className="r-summary">
        <div className="r-card"><dt><CountUp value={names.length} /></dt><dd>{names.length === 1 ? "language evaluated" : "languages evaluated"}</dd></div>
        <div className="r-card"><dt><CountUp value={testClips} /></dt><dd>unseen test clips</dd></div>
        <div className="r-card good"><dt><CountUp value={rate(o.bonafide_correct, o.bonafide_total)} format={(v) => pct(v)} /></dt><dd>real voices recognised as real</dd></div>
        <div className="r-card warn"><dt><CountUp value={rate(o.spoof_correct, o.spoof_total)} format={(v) => pct(v)} /></dt><dd>AI voices caught</dd></div>
        <div className="r-card"><dt><CountUp value={o.macro_eer} format={(v) => pct(v, 2)} /></dt><dd>equal error rate, mean over languages</dd></div>
      </div>

      <Section id="per-language" icon={Globe} title="Results per language"
               sub="Each language is evaluated separately on its own speaker-disjoint test set. Dots are the EER; bars are 95% confidence intervals.">
        <EerChart rows={names.map((n) => ({ lang: n, eer: langs[n].test.eer, ci: langs[n].test.eer_ci, status: langs[n].status }))} />
        <div className="table-wrap">
          <table className="r-table">
            <thead>
              <tr><th>Language</th><th>Status</th><th>EER (95% CI)</th><th>Accuracy (95% CI)</th><th>Real passed</th><th>AI caught</th><th>Test clips</th><th>Speakers</th></tr>
            </thead>
            <tbody>
              {names.map((n) => {
                const t = langs[n].test;
                return (
                  <tr key={n}>
                    <td><strong>{n}</strong></td>
                    <td><span className={`chip st-${langs[n].status.replace(" ", "-")}`}>{STATUS[langs[n].status]}</span></td>
                    <td>{pct(t.eer)} <small>({ci(t.eer_ci)})</small></td>
                    <td>{pct(t.accuracy)} <small>({ci(t.accuracy_ci)})</small></td>
                    <td>{t.bonafide_correct}/{t.bonafide_total}</td>
                    <td>{t.spoof_correct}/{t.spoof_total}</td>
                    <td>{t.bonafide_total} + {t.spoof_total}</td>
                    <td>{t.speakers}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="fineprint">Status rule: {report.metric_definitions?.support_rule}</p>
      </Section>

      <Section id="explore" icon={Chart} title="Explore a language" sub="Where the model is strong and where it struggles.">
        <LanguageExplorer languages={langs} />
      </Section>

      <Section id="gaps" icon={Alert} title="Languages that need more work" sub="Listed honestly, with the reason.">
        {needWork.length === 0 ? <p className="condition">None. Every listed language is supported.</p> : (
          <ul className="gaps">{needWork.map((g) => <li key={g.lang}><strong>{g.lang}</strong><span>{g.why}</span></li>)}</ul>
        )}
      </Section>

      {ds && (
        <Section id="data" icon={Database} title="Dataset" sub={`${ds.records_found.toLocaleString("en-IN")} clips collected → ${ds.records_kept.toLocaleString("en-IN")} kept after cleaning and balancing.`}>
          <div className="table-wrap">
            <table className="r-table">
              <thead><tr><th>Language</th><th>Train (real + AI)</th><th>Dev</th><th>Test</th><th>Split</th><th>Hours</th><th>Sources</th></tr></thead>
              <tbody>
                {Object.entries(ds.languages).map(([l, d]) => (
                  <tr key={l}>
                    <td><strong>{l}</strong></td>
                    {["train", "dev", "test"].map((s) => <td key={s}>{d[s].bonafide} + {d[s].spoof} <small>({d[s].speakers} spk)</small></td>)}
                    <td className="bar-cell"><StackBar parts={["train", "dev", "test"].map((s) => ({ key: s, label: s, value: d[s].bonafide + d[s].spoof }))} /></td>
                    <td>{d.hours}</td>
                    <td>{d.sources.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="two-col">
            <div>
              <h3>Cleaning</h3>
              <ul className="kv">
                {Object.entries(ds.removed).map(([why, n]) => <li key={why}><span>{why}</span><b>{n.toLocaleString("en-IN")}</b></li>)}
                {Object.keys(ds.removed).length === 0 && <li><span>Nothing removed</span><b>0</b></li>}
              </ul>
              <ul className="notes">{ds.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
            <div>
              <h3>Sources and licences</h3>
              <ul className="kv">
                {Object.entries(ds.sources).map(([s, v]) => (
                  <li key={s}><span><a href={v.url} target="_blank" rel="noreferrer">{s}</a>{!usedSources.has(s) && <em className="tag">not used in this model</em>}</span><b>{v.license}</b></li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      )}

      <Section id="model" icon={Cpu} title="Model and training" sub="A frozen pretrained speech model plus a small trainable classifier: light enough to train and run on a laptop CPU.">
        <div className="two-col">
          <ul className="kv">
            <li><span>Speech model</span><b>{report.model.frontend}</b></li>
            <li><span>Spectral features</span><b>{report.model.spectral_features}</b></li>
            <li><span>Classifier</span><b>{report.model.classifier}</b></li>
            <li><span>Trainable parameters</span><b>{report.model.trainable_parameters.toLocaleString("en-US")}</b></li>
            <li><span>Input</span><b>{report.model.segment_seconds} s segments, averaged</b></li>
            <li><span>Decision threshold</span><b>P(AI) ≥ {report.model.threshold}</b></li>
          </ul>
          <div>
            <ul className="kv">
              <li><span>Epochs run (best)</span><b>{tr.epochs_run ?? "–"} ({tr.best_epoch})</b></li>
              <li><span>Training time</span><b>{tr.seconds ? `${Math.round(tr.seconds / 60)} min on ${tr.device}` : "–"}</b></li>
              <li><span>Optimiser</span><b>{tr.optimizer ?? "–"}, lr {tr.learning_rate ?? "–"}</b></li>
              <li><span>Balancing</span><b>{tr.balancing ?? "–"}</b></li>
              <li><span>Model selection</span><b>{tr.model_selection ?? "–"}</b></li>
            </ul>
            {tr.history && <><h3 className="curve-title">Dev EER after each epoch</h3><TrainingCurve history={tr.history} best={tr.best_epoch} /></>}
          </div>
        </div>
      </Section>

      <Section id="data-size" icon={Chart} title="How much data is enough?"
               sub="The same model trained on 10%, 25%, 50% and 100% of the English training clips, measured on the same test set.">
        <DataSizeStudy />
      </Section>

      <Section id="method" icon={Chart} title="How these numbers are measured">
        <ul className="defs">
          {Object.entries(report.metric_definitions ?? {}).map(([k, v]) => <li key={k}><strong>{DEF_LABELS[k] ?? k}</strong><span>{v}</span></li>)}
        </ul>
      </Section>
    </div>
  );
}
