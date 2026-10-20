/** 0.0825 -> "8.3%" */
export const pct = (x, digits = 1) => (x == null ? "–" : `${(x * 100).toFixed(digits)}%`);

/** A model score is an estimate, never certainty: ">99" / "<1" instead of 100 / 0. */
export const prob = (x) => (x >= 0.995 ? ">99" : x < 0.005 ? "<1" : `${Math.round(x * 100)}`);

/** [0.06, 0.10] -> "6.0–10.0%" */
export const range = (ci, digits = 1) => (ci ? `${(ci[0] * 100).toFixed(digits)}–${(ci[1] * 100).toFixed(digits)}%` : "–");

export const num = (n) => (n == null ? "–" : Number(n).toLocaleString("en-US"));

export const ratio = (k, n) => (n ? k / n : null);

export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function confidenceLevel(c) {
  if (c >= 0.9) return { key: "high", label: "High confidence" };
  if (c >= 0.7) return { key: "mid", label: "Moderate confidence" };
  return { key: "low", label: "Low confidence, treat with caution" };
}
