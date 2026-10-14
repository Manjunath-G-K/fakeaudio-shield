const pc = (x, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}`);

function Section({ n, id, title, children }) {
  return (
    <section className="sheet-section" id={id} aria-labelledby={`${id}-h`}>
      <div className="sheet-index"><span className="sheet-n">{n}</span><h2 id={`${id}-h`}>{title}</h2></div>
      <div className="sheet-body">{children}</div>
    </section>
  );
}

/* 01 — signal chain, drawn like an instrument schematic */
const Block = ({ name, spec }) => (
  <div className="block"><span className="block-name">{name}</span><span className="block-spec">{spec}</span></div>
);

export function Pipeline() {
  return (
    <Section n="01" id="pipeline" title="Signal chain">
      <p className="sheet-lead">
        Every file takes the same path during training and prediction. Both use one shared
        configuration, so the model never sees audio prepared differently from what it learned on.
      </p>
      <div className="chain-layout">
      <div className="chain" role="img" aria-label="Pipeline: input, resample, trim and normalise, segment, then Wav2Vec2 and log-mel plus MFCC in parallel, then LCNN, then decision">
        <Block name="Input" spec="wav flac mp3 ogg m4a" />
        <Block name="Resample" spec="16 000 Hz · mono" />
        <Block name="Trim + normalise" spec="top-db 35 · peak 0.95" />
        <Block name="Segment" spec="4.0 s windows" />
        <div className="chain-split">
          <Block name="Wav2Vec2" spec="base · layer 6 · frozen · 768 / 20 ms" />
          <Block name="Log-mel + MFCC" spec="80 + 20 / 20 ms · Librosa" />
        </div>
        <Block name="LCNN" spec="Max-Feature-Map · 2 classes" />
        <Block name="Decision" spec="softmax · mean of segments · τ 0.5" />
      </div>
      <ul className="notes">
        <li><b>Wav2Vec2</b> is a speech model pre-trained on 960 h of unlabelled audio. Its middle layer keeps fine acoustic detail that synthetic voices tend to get slightly wrong.</li>
        <li><b>Log-mel + MFCC</b> describe how energy spreads over frequency, frame by frame. They are aligned to the same 20 ms grid as Wav2Vec2 and stacked beside it.</li>
        <li><b>LCNN</b> (Light CNN with Max-Feature-Map) is the classic ASVspoof countermeasure: small, fast, trainable on a CPU.</li>
      </ul>
      </div>
    </Section>
  );
}

/* 02 — live measurements from /api/health */
export function Measurements({ health }) {
  const dev = health?.metrics?.dev;
  const test = health?.metrics?.test;
  const attacks = Object.entries(test?.by_attack ?? {});
  const info = health?.train_info;
  return (
    <Section n="02" id="measurements" title="Measurements">
      <p className="sheet-lead">
        Read live from the running model. The test set uses 13 voice-generation systems the model
        never saw in training, which is the honest estimate of how it does on new fakes.
      </p>
      <table className="spec-table">
        <thead>
          <tr><th>Split</th><th>Attacks</th><th className="num">EER %</th><th className="num">Real passed</th><th className="num">Fake caught</th><th className="num hide-sm">Accuracy %</th></tr>
        </thead>
        <tbody>
          <tr><td>Dev</td><td>A01–A06 · seen</td><td className="num">{pc(dev?.eer, 2)}</td>
            <td className="num">{dev ? `${dev.bonafide_correct}/${dev.bonafide_total}` : "—"}</td>
            <td className="num">{dev ? `${dev.spoof_correct}/${dev.spoof_total}` : "—"}</td>
            <td className="num hide-sm">{pc(dev?.accuracy)}</td></tr>
          <tr className="strong"><td>Test</td><td>A07–A19 · unseen</td><td className="num">{pc(test?.eer, 2)}</td>
            <td className="num">{test ? `${test.bonafide_correct}/${test.bonafide_total}` : "—"}</td>
            <td className="num">{test ? `${test.spoof_correct}/${test.spoof_total}` : "—"}</td>
            <td className="num hide-sm">{pc(test?.accuracy)}</td></tr>
        </tbody>
      </table>
      <p className="caption">
        EER = equal error rate, the point where false alarms equal misses (lower is better).
        {info && <> Model trained on {(info.train_bonafide + info.train_spoof).toLocaleString("en-IN")} clips · {info.datasets}{health.trained_at && <> · {new Date(health.trained_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>}.</>}
      </p>

      {attacks.length > 0 && (
        <figure className="attack-chart">
          <figcaption><span className="label">Fake detection by unseen attack · test set · threshold 0.5</span></figcaption>
          <div className="attacks">
            {attacks.map(([a, m]) => {
              const rate = m.spoof_total ? m.spoof_correct / m.spoof_total : 0;
              return (
                <div key={a} className="attack" title={`${a}: ${m.spoof_correct}/${m.spoof_total} caught`}>
                  <span className="attack-id">{a}</span>
                  <span className="attack-bar"><span style={{ width: `${rate * 100}%` }} className={rate < 0.5 ? "low" : ""} /><i /></span>
                  <span className="attack-val">{Math.round(rate * 100)}</span>
                </div>
              );
            })}
          </div>
          <p className="caption">Each bar is the share of that system's fakes caught. The tick marks 50 %. Real speech: {test ? `${test.bonafide_correct} of ${test.bonafide_total}` : "—"} passed.</p>
        </figure>
      )}
    </Section>
  );
}

/* 03 — limits */
export function Limits() {
  return (
    <Section n="03" id="limits" title="Limits">
      <ol className="limits">
        <li><b>Unseen generators are the weak spot.</b> At the 0.5 threshold about a third of fakes from systems absent in training pass as real (see A10 above, and sample 05).</li>
        <li><b>English only, for now.</b> Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi and Bengali are being added (Kathbath real + IndicSynth synthetic speech, split by speaker).</li>
        <li><b>Small, CPU-trained model.</b> 2,500 training clips and a frozen Wav2Vec2. Fine-tuning needs a GPU.</li>
        <li><b>Recording conditions matter.</b> Phone calls, heavy noise, music or re-recorded audio are outside the training data.</li>
        <li><b>A prediction, not proof.</b> The confidence is the model's probability, not a calibrated chance of fraud. Use it to support a human decision.</li>
      </ol>
    </Section>
  );
}

/* 04 — data & privacy */
export function DataPrivacy() {
  return (
    <Section n="04" id="data" title="Data & privacy">
      <dl className="kv">
        <div><dt>Processing</dt><dd>Runs on this machine. The file goes to the local backend (port 8000), is written to a temporary file for analysis, and is deleted straight away. The spectrogram is computed in your browser.</dd></div>
        <div><dt>Training data</dt><dd>ASVspoof 2019 LA (Edinburgh DataShare), Open Data Commons Attribution License.</dd></div>
        <div><dt>Sample clips</dt><dd>Five clips from the ASVspoof 2019 LA evaluation set, redistributed under the same licence.</dd></div>
        <div><dt>Coming</dt><dd>Kathbath (AI4Bharat, CC BY 4.0) and IndicSynth (CC BY-NC 4.0) for Indian languages.</dd></div>
      </dl>
    </Section>
  );
}
