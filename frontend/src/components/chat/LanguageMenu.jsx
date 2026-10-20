import { useEffect, useRef, useState } from "react";
import { pct } from "../../lib/format.js";
import { NATIVE_NAME } from "../../lib/languages.js";
import { Chevron, Globe } from "../icons.jsx";

/** Language chip in the composer; opens a list with native names and measured accuracy. */
export default function LanguageMenu({ languages, value, onChange, report, disabled }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className="lang-menu" ref={root}>
      <button type="button" className="lang-chip" onClick={() => setOpen((o) => !o)} disabled={disabled}
              aria-haspopup="listbox" aria-expanded={open} aria-label={`Language: ${value}. Change`}>
        <Globe size={16} /><span>{value}</span><Chevron size={14} />
      </button>
      {open && (
        <ul className="popover lang-list" role="listbox" aria-label="Language spoken in the clip">
          <li className="popover-title" role="presentation">Language spoken in the clip</li>
          {languages.map((l) => {
            const L = report?.languages?.[l];
            return (
              <li key={l} role="option" aria-selected={value === l}>
                <button type="button" className={value === l ? "on" : ""} onClick={() => { onChange(l); setOpen(false); }}>
                  <span className={`status-dot s-${(L?.status ?? "none").replace(" ", "-")}`} />
                  <span className="lang-name">{l}{NATIVE_NAME[l] !== l && <small>{NATIVE_NAME[l]}</small>}</span>
                  <span className="lang-score tabular">{L ? pct(L.test.accuracy, 0) : ""}</span>
                </button>
              </li>
            );
          })}
          <li className="popover-foot" role="presentation"><span className="status-dot s-supported" /> supported <span className="status-dot s-experimental" /> experimental · % = test accuracy</li>
        </ul>
      )}
    </div>
  );
}
