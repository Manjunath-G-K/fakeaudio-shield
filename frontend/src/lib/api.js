// Client for the FastAPI backend.
// Development: Vite proxies /api to port 8000. Production: same origin (FastAPI serves the built
// site), or set VITE_API_BASE at build time when the API lives on another host.
const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export const ALLOWED_TYPES = [".wav", ".flac", ".mp3", ".ogg", ".m4a"];
export const MAX_UPLOAD_MB = 20;

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

async function getJson(path, offlineMessage) {
  try {
    const res = await fetch(`${BASE}${path}`);
    return res.ok ? await res.json() : { error: await readError(res) };
  } catch {
    return { error: offlineMessage };
  }
}

/** Model status and evaluated languages. */
export const getHealth = () => getJson("/api/health", "Cannot reach the detector. Start the backend server and try again.");

/** Full evaluation report (per-language metrics, dataset, training). */
export const getReport = () => getJson("/api/report", "Cannot reach the detector.");

/** Learning-curve study, or null when it has not been run. */
export async function getDataSizeStudy() {
  const r = await getJson("/api/data-size-study", "");
  return r.error ? null : r;
}

/** Upload one clip; language selects the model and must be one of the evaluated languages. */
export async function predict(file, language) {
  const form = new FormData();
  form.append("file", file);
  if (language) form.append("language", language);
  let res;
  try {
    res = await fetch(`${BASE}/api/predict`, { method: "POST", body: form });
  } catch {
    throw new Error("Cannot reach the detector. Is the backend running?");
  }
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
