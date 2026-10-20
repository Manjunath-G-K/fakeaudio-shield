// Inline icons on a 24px grid (stroke = currentColor). Decorative unless given a title by the caller.
const Svg = ({ children, size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
);

export const ShieldWave = (p) => (
  <Svg {...p}><path d="M12 2.8l7.5 3v5.6c0 4.6-3.1 8.4-7.5 10-4.4-1.6-7.5-5.4-7.5-10V5.8l7.5-3z" /><path d="M8.5 12h1M11 9.5v5M13.5 10.5v3M16 12h-.5" /></Svg>
);
export const Mic = (p) => <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></Svg>;
export const Paperclip = (p) => <Svg {...p}><path d="M20.5 11.5l-8.2 8.2a5 5 0 01-7.1-7.1l8.6-8.6a3.4 3.4 0 014.8 4.8l-8.5 8.5a1.7 1.7 0 01-2.4-2.4l7.8-7.8" /></Svg>;
export const Send = (p) => <Svg {...p}><path d="M4.5 12l15-7.5-5 15-2.8-6.2L4.5 12z" fill="currentColor" stroke="none" /></Svg>;
export const Trash = (p) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></Svg>;
export const Play = (p) => <Svg {...p}><path d="M8 5.5v13l10.5-6.5L8 5.5z" fill="currentColor" stroke="none" /></Svg>;
export const Pause = (p) => <Svg {...p}><rect x="6.5" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="13.7" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none" /></Svg>;
export const Waveform = (p) => <Svg {...p}><path d="M3 12h1.5M6.5 8v8M10 4.5v15M13.5 9v6M17 6.5v11M20.5 11v2" /></Svg>;
export const Info = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const Close = (p) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const Chevron = (p) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const Back = (p) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const Globe = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></Svg>;
export const Upload = (p) => <Svg {...p}><path d="M12 15V4M7 9l5-5 5 5M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" /></Svg>;
export const Inbox = (p) => <Svg {...p}><path d="M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6l2.5-8z" /></Svg>;
export const Share = (p) => <Svg {...p}><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12.5V19a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0019 19v-6.5" /></Svg>;
export const Report = (p) => <Svg {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9.5 17v-3M12.5 17v-6M15.5 17v-4" /></Svg>;
export const Check = (p) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const DoubleCheck = (p) => <Svg {...p}><path d="M2.5 12.5L7 17l9.5-9.5M11 16l1 1 9.5-9.5" /></Svg>;
export const Clock = (p) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const Alert = (p) => <Svg {...p}><path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></Svg>;
export const Lock = (p) => <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></Svg>;
export const Spark = (p) => <Svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" /></Svg>;
export const Refresh = (p) => <Svg {...p}><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" /></Svg>;
