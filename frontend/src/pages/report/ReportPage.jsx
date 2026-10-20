import { useEffect, useState } from "react";
import { Back, Globe, Info, Refresh, Report as ReportIcon, ShieldWave, Waveform } from "../../components/icons.jsx";
import { getDataSizeStudy } from "../../lib/api.js";
import { num, pct, range, ratio } from "../../lib/format.js";
import { NATIVE_NAME, STATUS } from "../../lib/languages.js";
import { EerLine, EerScale, EpochSpark, ExpandRow, Group, LearningCurve, Row, ShareBars, SplitBar } from "./parts.jsx";
import "./report.css";

const DEF_LABELS = { eer: "Equal error rate (EER)", accuracy: "Accuracy", real_passed: "Real passed", fake_caught: "AI caught",
  ci: "Confidence intervals", support_rule: "Support status", shortcut_probe: "Recording check" };

function LanguageRow({ lang, L, models }) {
  const t = L.test, s = STATUS[L.status];
  const attacks = Object.entries(t.by_attack ?? {});
  return (
    <ExpandRow summary={
      <span className="lang-row">
        <span className="lang-row-name"><span className={`status-dot s-${L.status.replace(" ", "-")}`} />{lang}<small>{NATIVE_NAME[lang] !== lang ? NATIVE_NAME[lang] : ""}</small></span>
        <EerLine eer={t.eer} ci={t.eer_ci} status={L.status} />
        <span className="lang-row-num tabular">{pct(t.eer)}<small>EER</small></span>
      </span>
    }>
      <div className="detail-grid">
        <Row label="Status" value={<span className={`pill pill-${s.tone}`}>{s.label}</span>} />
        <Row label="Accuracy" value={pct(t.accuracy)} valueSub={`95% CI ${range(t.accuracy_ci)}`} />
        <Row label="Equal error rate" value={pct(t.eer)} valueSub={`95% CI ${range(t.eer_ci)}`} />
        <Row label="Real voices passed" value={`${t.bonafide_correct} / ${t.bonafide_total}`} />
        <Row label="AI voices caught" value={`${t.spoof_correct} / ${t.spoof_total}`} />
        <Row label="Test speakers" value={t.speakers} />
        {L.dev && <Row label="Dev set (used to choose)" value={pct(L.dev.eer)} valueSub="EER" />}
        <Row label="Answered by" value={models[L.model]?.name ?? "–"} />
        {L.shortcut_probe && <Row label="Recording check" sub="EER of a classifier that sees only recording conditions"
                                  value={pct(L.shortcut_probe.channel_eer)} valueSub={L.shortcut_probe.shortcut_risk ? "shortcut risk" : "no shortcut found"} />}
      </div>
      <p className="detail-text">{L.test_condition}</p>
      {L.status_reason && <p className="detail-text warn">{L.status_reason}</p>}
      {attacks.length > 0 && (
        <>
          <h4>AI voices caught, by {attacks.some(([a]) => /^A\d+/.test(a)) ? "attack system" : "generator"}</h4>
          <ShareBars rows={attacks.map(([a, m]) => ({ label: a, value: ratio(m.spoof_correct, m.spoof_total), detail: `${m.spoof_correct}/${m.spoof_total}` }))} />
        </>
      )}
    </ExpandRow>
  );
}

function DataSize() {
  const [study, setStudy] = useState(undefined);
  useEffect(() => { getDataSizeStudy().then(setStudy); }, []);
  if (study === undefined) return <div className="row-item muted">Loading…</div>;
  if (!study) return <div className="row-item muted">Not run yet (python data_size_study.py).</div>;
  const rows = study.results, first = rows[0], last = rows[rows.length - 1];
  return (
    <div className="pad">
      <LearningCurve rows={rows} />
      <p className="detail-text">
        From {num(first.train_clips)} to {num(last.train_clips)} English training clips, test EER went from {pct(first.test_eer)} to {pct(last.test_eer)},
        and it barely moves after the halfway point. The speech model is pre-trained and frozen, so a few thousand balanced clips are
        enough; what limits detection of new fakes is the variety of voice generators, not the clip count.
      </p>
      <p className="detail-text small">Solid: test. Dashed: dev. {study.model}; {study.epochs} epochs.</p>
    </div>
  );
}

export default function ReportPage({ backend }) {
  const { report, reportError, reportLoading, reload } = backend;
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="report-page">
      <header className="report-bar">
        <a href="#/" className="report-back" aria-label="Back to the chat"><Back size={20} /><span>Chat</span></a>
        <h1>How Shield was tested</h1>
      </header>

      {reportLoading && <div className="report-col"><div className="report-state">Loading the evaluation report…</div></div>}
      {!reportLoading && !report && (
        <div className="report-col">
          <div className="report-state">
            <p>{reportError ?? "The evaluation report could not be loaded."}</p>
            <button type="button" onClick={reload}><Refresh size={15} /> Try again</button>
          </div>
        </div>
      )}

      {report && (() => {
        const o = report.overall, langs = report.languages, models = report.models ?? {}, ds = report.dataset;
        const weak = Object.entries(langs).filter(([, L]) => L.status !== "supported");
        const a10 = langs.English?.test?.by_attack?.A10;
        return (
          <div className="report-col">
            <div className="profile">
              <span className="profile-avatar"><ShieldWave size={44} /></span>
              <h2>FakeAudio Shield</h2>
              <p>Tested on {num(o.bonafide_total + o.spoof_total)} voice clips from speakers it never heard ·
                report of {new Date(report.generated_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
              <div className="profile-actions">
                <button type="button" onClick={() => jump("languages")}><Globe size={20} /><span>Languages</span></button>
                <button type="button" onClick={() => jump("data")}><Waveform size={20} /><span>Data</span></button>
                <button type="button" onClick={() => jump("models")}><ReportIcon size={20} /><span>Models</span></button>
                <button type="button" onClick={() => jump("method")}><Info size={20} /><span>Method</span></button>
              </div>
            </div>

            <Group id="overall" title="All languages together">
              <Row label="Accuracy" value={pct(o.accuracy)} valueSub={`mean per language ${pct(o.macro_accuracy)}`} />
              <Row label="Equal error rate" sub="lower is better" value={pct(o.eer)} valueSub={`mean per language ${pct(o.macro_eer, 2)}`} />
              <Row label="Real voices recognised as real" value={pct(ratio(o.bonafide_correct, o.bonafide_total))} valueSub={`${o.bonafide_correct}/${o.bonafide_total}`} />
              <Row label="AI voices caught" value={pct(ratio(o.spoof_correct, o.spoof_total))} valueSub={`${o.spoof_correct}/${o.spoof_total}`} />
            </Group>

            <Group id="languages" title="Accuracy by language"
                   note={`Supported = upper 95% bound of test EER ≤ 10% and at least 10 different test speakers. Tap a language for details.`}>
              <EerScale />
              {Object.entries(langs).map(([l, L]) => <LanguageRow key={l} lang={l} L={L} models={models} />)}
            </Group>

            <Group id="weak" title="Where Shield struggles">
              {weak.map(([l, L]) => (
                <Row key={l} label={l} sub={[L.test.speakers < 10 ? `only ${L.test.speakers} test speakers (10 needed)` : null,
                  L.test.eer_ci?.[1] > 0.1 ? `upper EER bound ${pct(L.test.eer_ci[1])} is above 10%` : null, L.status_reason].filter(Boolean).join(" · ")}
                     value={<span className={`pill pill-${STATUS[L.status].tone}`}>{STATUS[L.status].label}</span>} />
              ))}
              {a10 && <Row label="Unseen generator A10 (neural TTS)" sub="English test set" value={pct(ratio(a10.spoof_correct, a10.spoof_total), 0)} valueSub="caught" />}
              <Row label="Phone calls, noise, music, microphone echo" sub="differ from the training audio" value="untested" />
            </Group>

            {ds && (
              <Group id="data" title="Training data" note={`${num(ds.records_found)} clips collected, ${num(ds.records_kept)} kept after cleaning and balancing. Splits are speaker-disjoint.`}>
                {Object.entries(ds.languages).map(([l, d]) => (
                  <ExpandRow key={l} summary={
                    <span className="data-row">
                      <span className="lang-row-name">{l}</span>
                      <SplitBar d={d} />
                      <span className="tabular data-n">{num(d.train.bonafide + d.train.spoof + d.dev.bonafide + d.dev.spoof + d.test.bonafide + d.test.spoof)}<small>clips</small></span>
                    </span>
                  }>
                    <div className="detail-grid">
                      {["train", "dev", "test"].map((s) => <Row key={s} label={s[0].toUpperCase() + s.slice(1)} value={`${d[s].bonafide} real + ${d[s].spoof} AI`} valueSub={`${d[s].speakers} speakers`} />)}
                      <Row label="Hours of audio" value={d.hours} />
                      <Row label="Sources" value={d.sources.join(", ")} />
                    </div>
                  </ExpandRow>
                ))}
                {Object.entries(ds.removed).map(([why, n]) => <Row key={why} label={`Removed: ${why}`} value={num(n)} />)}
                {Object.entries(ds.sources).map(([s, v]) => (
                  <Row key={s} label={<a href={v.url} target="_blank" rel="noreferrer">{s}</a>} sub="dataset" value={v.license} />
                ))}
              </Group>
            )}

            <Group id="models" title="Models" note={report.model.routing}>
              <Row label="Speech model" value={report.model.frontend} />
              <Row label="Spectral features" value={report.model.spectral_features} />
              <Row label="Classifier" value={report.model.classifier} />
              {Object.entries(models).map(([k, m]) => {
                const t = m.training ?? {};
                return (
                  <ExpandRow key={k} summary={
                    <span className="data-row"><span className="lang-row-name">{m.name}</span><span className="muted small">{(m.languages ?? []).join(", ")}</span></span>
                  }>
                    <div className="detail-grid">
                      <Row label="Checkpoint" value={<code>{m.checkpoint}</code>} />
                      <Row label="Trainable parameters" value={num(m.trainable_parameters)} />
                      <Row label="Architecture" value={m.arch ? `${m.arch.proj_dim}-d projection, time pooling ×${m.arch.time_pool}` : "–"} />
                      <Row label="Epochs (best)" value={`${t.epochs_run ?? "–"} (${t.best_epoch ?? "–"})`} />
                      <Row label="Training time" value={t.seconds ? `${Math.round(t.seconds / 60)} min on ${t.device ?? "CPU"}` : "–"} />
                      <Row label="Balancing" value={t.balancing ?? "–"} />
                      <Row label="Model selection" value={t.model_selection ?? "–"} />
                      <Row label="Raw decision threshold" value={m.raw_threshold ?? "–"} />
                    </div>
                    <EpochSpark history={t.history} best={t.best_epoch} />
                  </ExpandRow>
                );
              })}
            </Group>

            <Group id="size" title="How much data is enough?"><DataSize /></Group>

            <Group id="method" title="How the numbers are measured">
              {Object.entries(report.metric_definitions ?? {}).map(([k, v]) => (
                <div key={k} className="def-row"><b>{DEF_LABELS[k] ?? k}</b><span>{v}</span></div>
              ))}
            </Group>

            <p className="report-foot">Every number on this page is read from the evaluation stored with the running models. Code: MIT. Model weights and test clips keep their dataset licences.</p>
          </div>
        );
      })()}
    </div>
  );
}
