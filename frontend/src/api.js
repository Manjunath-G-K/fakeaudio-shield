// Small wrapper around the FastAPI backend.
// Development: Vite proxies /api to port 8000. Production: same origin (FastAPI serves the built
// site), or set VITE_API_BASE at build time when the API lives on another host.
const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export const ALLOWED = [".wav", ".flac", ".mp3", ".ogg", ".m4a"];
export const MAX_MB = 20;

export const pct = (x, digits = 1) => `${(x * 100).toFixed(digits)}%`;

async function readError(res) {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
  } catch {
    /* not JSON: the proxy could not reach the backend */
  }
  if (res.status >= 500) return "The detector is not responding. Make sure the backend server is running.";
  return `Request failed (HTTP ${res.status}).`;
}

export async function getHealth() {
  try {
    const res = await fetch(`${BASE}/api/health`);
    return res.ok ? await res.json() : { error: await readError(res) };
  } catch {
    return { error: "Cannot reach the detector. Start the backend server and try again." };
  }
}

/** Full evaluation report (per-language metrics, dataset, training). null if unavailable. */
export async function getReport() {
  try {
    const res = await fetch(`${BASE}/api/report`);
    return res.ok ? await res.json() : { error: await readError(res) };
  } catch {
    return { error: "Cannot reach the backend." };
  }
}

/** Learning-curve study (training clips vs EER). null if not run yet. */
export async function getDataSizeStudy() {
  try {
    const res = await fetch(`${BASE}/api/data-size-study`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function predict(file, language) {
  const form = new FormData();
  form.append("file", file);
  if (language) form.append("language", language);
  let res;
  try {
    res = await fetch(`${BASE}/api/predict`, { method: "POST", body: form });
  } catch {
    throw new Error("Cannot reach the backend. Is it running?");
  }
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
