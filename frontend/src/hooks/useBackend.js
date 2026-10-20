import { useCallback, useEffect, useState } from "react";
import { getHealth, getReport } from "../lib/api.js";
import { LANGUAGES } from "../lib/languages.js";

/** Loads model status and the evaluation report once; `reload` retries after the backend starts. */
export function useBackend() {
  const [health, setHealth] = useState(null);
  const [report, setReport] = useState(null);

  const reload = useCallback(async () => {
    setReport(null);
    const h = await getHealth();
    setHealth(h);
    setReport(h.model_loaded ? await getReport() : { error: h.error || h.message || "The detector is offline." });
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const ready = !!health?.model_loaded;
  return {
    health,
    ready,
    connecting: health === null,
    report: report && !report.error ? report : null,
    reportError: report?.error ?? null,
    reportLoading: report === null,
    // only languages with measured results are offered
    languages: health?.languages?.length ? health.languages : LANGUAGES,
    reload,
  };
}
