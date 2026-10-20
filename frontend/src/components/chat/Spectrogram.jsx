import { useEffect, useRef } from "react";

// light-to-teal colour ramp for intensities 0..255
const RAMP = (() => {
  const stops = [[245, 248, 246], [205, 238, 229], [111, 201, 177], [11, 122, 108], [42, 74, 122]];
  return Array.from({ length: 256 }, (_, v) => {
    const t = (v / 255) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(t)), f = t - i;
    return stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f));
  });
})();

/** Scrolling spectrogram of a live microphone (AnalyserNode), drawn on a canvas. Low frequencies at the bottom. */
export default function Spectrogram({ analyser, maxHz = 8000 }) {
  const canvas = useRef(null);
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !analyser) return;
    const dpr = window.devicePixelRatio || 1;
    const fit = () => {
      cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
      const c = cv.getContext("2d"); c.fillStyle = "rgb(245,248,246)"; c.fillRect(0, 0, cv.width, cv.height);
    };
    fit();
    const ctx = cv.getContext("2d");
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const nyquist = analyser.context.sampleRate / 2;
    const top = Math.min(bins.length - 1, Math.round((maxHz / nyquist) * bins.length));
    let raf;
    const draw = () => {
      analyser.getByteFrequencyData(bins);
      const w = cv.width, h = cv.height, col = Math.max(2, Math.round(2 * dpr));
      ctx.drawImage(cv, -col, 0);                               // scroll left
      const img = ctx.createImageData(col, h);
      for (let y = 0; y < h; y++) {
        // log-ish frequency axis: more rows for the speech range
        const frac = 1 - y / (h - 1);
        const bin = Math.min(top, Math.round(Math.pow(frac, 1.8) * top));
        const [r, g, b] = RAMP[bins[bin]];
        for (let x = 0; x < col; x++) {
          const o = (y * col + x) * 4;
          img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, w - col, 0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", fit);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", fit); };
  }, [analyser, maxHz]);
  return <canvas ref={canvas} className="spectrogram" aria-hidden="true" />;
}
