// Languages with measured results. The backend's /api/health is the source of truth; this is the fallback.
export const LANGUAGES = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam"];

export const NATIVE_NAME = {
  English: "English", Hindi: "हिन्दी", Kannada: "ಕನ್ನಡ", Tamil: "தமிழ்", Telugu: "తెలుగు", Malayalam: "മലയാളം",
};

export const STATUS = {
  supported: { label: "Supported", tone: "real" },
  experimental: { label: "Experimental", tone: "warn" },
  "not supported": { label: "Not supported", tone: "ai" },
};

export const statusOf = (report, lang) => report?.languages?.[lang]?.status ?? null;

/** One plain sentence about what was measured for this language. */
export function languageNote(report, lang) {
  const L = report?.languages?.[lang];
  if (!L) return null;
  const t = L.test;
  const clips = t.bonafide_total + t.spoof_total;
  const parts = [`For ${lang}, ${Math.round(t.accuracy * 100)}% of ${clips} unseen test clips were classified correctly (EER ${(t.eer * 100).toFixed(1)}%). Status: ${L.status}.`];
  if (L.status_reason) parts.push(L.status_reason);
  else if (L.status === "experimental" && t.speakers < 10) parts.push(`Only ${t.speakers} test speakers so far, so treat results as indicative.`);
  if (L.shortcut_probe?.shortcut_risk) parts.push("Real and AI test clips also differ in recording conditions, so this score may be optimistic.");
  return { tone: L.status === "supported" ? "real" : "warn", text: parts.join(" ") };
}
