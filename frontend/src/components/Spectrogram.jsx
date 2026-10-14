import { useEffect, useMemo, useRef, useState } from "react";

const PAPER = [238, 237, 232];
const INK = [18, 18, 18];

/** Render the spectrogram once at native resolution (1 px per frame x bin). */
function toImage(spec) {
  const { data, frames, bins } = spec;
  const c = document.createElement("canvas");
  c.width = frames;
  c.height = bins;
  const img = c.getContext("2d").createImageData(frames, bins);
  for (let f = 0; f < frames; f++) {
    for (let b = 0; b < bins; b++) {
      const v = Math.pow(data[f * bins + b], 2.2);      // gamma: quiet detail stays light
      const o = ((bins - 1 - b) * frames + f) * 4;      // low frequencies at the bottom
      img.data[o] = PAPER[0] + (INK[0] - PAPER[0]) * v;
      img.data[o + 1] = PAPER[1] + (INK[1] - PAPER[1]) * v;
      img.data[o + 2] = PAPER[2] + (INK[2] - PAPER[2]) * v;
      img.data[o + 3] = 255;
    }
  }
  c.getContext("2d").putImageData(img, 0, 0);
  return c;
}

function ticks(duration) {
  if (!duration) return [];
  const step = duration <= 3 ? 0.5 : duration <= 8 ? 1 : duration <= 20 ? 2 : duration <= 40 ? 5 : 10;
  const out = [];
  for (let t = 0; t <= duration + 1e-6; t += step) out.push(t);
  return out;
}

export default function Spectrogram({ spec, duration, scanning, audioRef, status }) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [head, setHead] = useState(null);
  const image = useMemo(() => (spec ? toImage(spec) : null), [spec]);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    const ctx = cv.getContext("2d");
    ctx.fillStyle = `rgb(${PAPER.join(",")})`;
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (image) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, cv.width, cv.height);
    }
  }, [image, size]);

  // playhead follows the <audio> element while it plays
  useEffect(() => {
    const a = audioRef?.current;
    if (!a || !duration) return;
    let raf = 0;
    const tick = () => { setHead(a.currentTime / duration); if (!a.paused) raf = requestAnimationFrame(tick); };
    const onPlay = () => { raf = requestAnimationFrame(tick); };
    const onStop = () => { cancelAnimationFrame(raf); setHead(a.ended ? null : a.currentTime / duration); };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onStop);
    a.addEventListener("ended", onStop);
    a.addEventListener("seeked", onStop);
    return () => {
      cancelAnimationFrame(raf);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onStop);
      a.removeEventListener("ended", onStop);
      a.removeEventListener("seeked", onStop);
    };
  }, [audioRef, duration, spec]);

  return (
    <figure className="spectro">
      <div className="spectro-yaxis" aria-hidden="true">
        <span>8k</span><span>6k</span><span>4k</span><span>2k</span><span>0</span>
      </div>
      <div className="spectro-plot" ref={boxRef}>
        <canvas ref={canvasRef} role="img"
                aria-label={spec ? `Spectrogram, 0 to 8 kHz, ${duration.toFixed(2)} seconds` : "Empty spectrogram"} />
        <div className="spectro-grid" aria-hidden="true"><i /><i /><i /></div>
        {!spec && <div className="spectro-empty">{status}</div>}
        {scanning && <div className="spectro-scan" aria-hidden="true" />}
        {head != null && head > 0 && <div className="spectro-head" style={{ left: `${Math.min(100, head * 100)}%` }} aria-hidden="true" />}
      </div>
      <div className="spectro-xaxis" aria-hidden="true">
        {ticks(duration).map((t) => (
          <span key={t} style={{ left: `${(t / duration) * 100}%` }}>{t.toFixed(t % 1 ? 1 : 0)}s</span>
        ))}
      </div>
    </figure>
  );
}
