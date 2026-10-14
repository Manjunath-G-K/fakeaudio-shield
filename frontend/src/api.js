// Small wrapper around the FastAPI backend (proxied by Vite at /api).

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
  if (res.status >= 500) return "The backend is not responding. Make sure the FastAPI server is running on port 8000.";
  return `Request failed (HTTP ${res.status}).`;
}

export async function getHealth() {
  try {
    const res = await fetch("/api/health");
    return res.ok ? await res.json() : { error: await readError(res) };
  } catch {
    return { error: "Cannot reach the backend. Start the FastAPI server on port 8000." };
  }
}

export async function predict(file) {
  const form = new FormData();
  form.append("file", file);
  let res;
  try {
    res = await fetch("/api/predict", { method: "POST", body: form });
  } catch {
    throw new Error("Cannot reach the backend. Is it running?");
  }
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
