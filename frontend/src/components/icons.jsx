// Small inline icon set (24x24, stroke = currentColor).
const I = ({ children, size = 20, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);

export const Mic = (p) => <I {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></I>;
export const Upload = (p) => <I {...p}><path d="M12 15V4M7 9l5-5 5 5M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" /></I>;
export const Sparkle = (p) => <I {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></I>;
export const Play = (p) => <I {...p}><path d="M7 4.5v15l12-7.5-12-7.5z" fill="currentColor" stroke="none" /></I>;
export const Pause = (p) => <I {...p}><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></I>;
export const Stop = (p) => <I {...p}><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none" /></I>;
export const Redo = (p) => <I {...p}><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" /></I>;
export const Check = (p) => <I {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></I>;
export const Cross = (p) => <I {...p}><path d="M6 6l12 12M18 6L6 18" /></I>;
export const Alert = (p) => <I {...p}><path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></I>;
export const Download = (p) => <I {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></I>;
export const Shield = (p) => <I {...p}><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></I>;
export const Robot = (p) => <I {...p}><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5" /></I>;
export const Person = (p) => <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></I>;
export const Wave = (p) => <I {...p}><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10" /></I>;
export const Brain = (p) => <I {...p}><path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 003 3h1V4H9zM15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-3 3h-1V4h1z" /></I>;
export const Lock = (p) => <I {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></I>;
export const Chevron = (p) => <I {...p}><path d="M6 9l6 6 6-6" /></I>;
