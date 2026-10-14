import { useEffect, useState } from "react";

const BARS = 96;

/** Peak envelope of an audio file, decoded in the browser (no upload needed). */
async function envelope(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / BARS));
    const peaks = [];
    for (let i = 0; i < BARS; i++) {
      let max = 0;
      for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j++) max = Math.max(max, Math.abs(data[j]));
      peaks.push(max);
    }
    const top = Math.max(...peaks, 1e-6);
    return { peaks: peaks.map((p) => p / top), duration: buf.duration };
  } finally {
    ctx.close();
  }
}

/**
 * Waveform of the selected file.
 * tone: "idle" | "scanning" | "real" | "spoof"
 */
export default function Waveform({ file, tone = "idle" }) {
  const [wave, setWave] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setWave(null);
    setFailed(false);
    if (file) {
      envelope(file)
        .then((w) => alive && setWave(w))
        .catch(() => alive && setFailed(true));
    }
    return () => { alive = false; };
  }, [file]);

  const peaks = wave?.peaks ?? Array.from({ length: BARS }, (_, i) => 0.08 + 0.05 * Math.sin(i / 3));
  const w = 4, gap = 2, h = 72;

  return (
    <div className={`waveform tone-${tone} ${failed ? "failed" : ""}`}>
      <svg viewBox={`0 0 ${BARS * (w + gap)} ${h}`} preserveAspectRatio="none" role="img"
           aria-label={failed ? "Waveform preview unavailable for this file" : "Waveform of the selected audio"}>
        {peaks.map((p, i) => {
          const bh = Math.max(2, p * (h - 6));
          return <rect key={i} x={i * (w + gap)} y={(h - bh) / 2} width={w} height={bh} rx={2} />;
        })}
      </svg>
      {tone === "scanning" && <div className="scanline" aria-hidden="true" />}
      <div className="waveform-meta">
        {failed ? "Preview unavailable: the browser could not decode this file"
          : wave ? `${wave.duration.toFixed(2)} s` : file ? "Reading audio…" : ""}
      </div>
    </div>
  );
}
