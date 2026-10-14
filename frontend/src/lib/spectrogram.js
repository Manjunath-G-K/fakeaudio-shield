// Browser-side spectrogram: decode -> 16 kHz mono -> STFT (Hann, 512-point FFT, 10 ms hop).
// Same sample rate the model uses, so the picture shows exactly the 0-8 kHz band it hears.

export const SR = 16000;
const N_FFT = 512;
const HOP = 160;
const MAX_SECONDS = 60; // the backend also analyses at most 60 s
const DB_RANGE = 80;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {           // bit-reversal permutation
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/** Decode any browser-supported file and return 16 kHz mono samples. */
export async function decode16k(blob) {
  const ctx = new OfflineAudioContext(1, 1, SR);   // decodeAudioData resamples to the context rate
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const n = Math.min(buf.length, SR * MAX_SECONDS);
  const out = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += ch[i] / buf.numberOfChannels;
  }
  return { samples: out, duration: buf.duration };
}

/** Log-magnitude spectrogram, values scaled to 0..1 (0 = -80 dB below the loudest bin). */
export function stft(samples) {
  const bins = N_FFT / 2 + 1;
  const frames = Math.max(1, Math.floor((samples.length - N_FFT) / HOP) + 1);
  const win = new Float32Array(N_FFT).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT));
  const db = new Float32Array(frames * bins);
  const re = new Float32Array(N_FFT), im = new Float32Array(N_FFT);
  let max = -Infinity;
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N_FFT; i++) { re[i] = (samples[f * HOP + i] || 0) * win[i]; im[i] = 0; }
    fft(re, im);
    for (let b = 0; b < bins; b++) {
      const v = 10 * Math.log10(re[b] * re[b] + im[b] * im[b] + 1e-10);
      db[f * bins + b] = v;
      if (v > max) max = v;
    }
  }
  for (let i = 0; i < db.length; i++) db[i] = Math.min(1, Math.max(0, (db[i] - max + DB_RANGE) / DB_RANGE));
  return { data: db, frames, bins, hopSeconds: HOP / SR };
}
