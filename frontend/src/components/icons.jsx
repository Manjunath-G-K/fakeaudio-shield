// Minimal inline icons (24x24, stroke = currentColor) so no icon library is needed.
const Icon = ({ children, size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const ShieldIcon = (p) => (
  <Icon {...p}><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" /><path d="M8.5 12h1.5l1-2.5 2 5 1-2.5h1.5" /></Icon>
);
export const UploadIcon = (p) => (
  <Icon {...p}><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></Icon>
);
export const WaveIcon = (p) => (
  <Icon {...p}><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0" /></Icon>
);
export const FilterIcon = (p) => (
  <Icon {...p}><path d="M4 5h16l-6 7v6l-4 2v-8L4 5z" /></Icon>
);
export const SpectrumIcon = (p) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 16v-3M11 16V9M15 16v-5M19 16V8" /></Icon>
);
export const BrainIcon = (p) => (
  <Icon {...p}><path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 003 3h1V4H9z" /><path d="M15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-3 3h-1V4h1z" /></Icon>
);
export const LayersIcon = (p) => (
  <Icon {...p}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></Icon>
);
export const GaugeIcon = (p) => (
  <Icon {...p}><path d="M4 18a8 8 0 1116 0" /><path d="M12 18l4-6" /></Icon>
);
export const CheckIcon = (p) => (<Icon {...p}><path d="M5 12.5l4.5 4.5L19 7" /></Icon>);
export const XIcon = (p) => (<Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>);
export const AlertIcon = (p) => (
  <Icon {...p}><path d="M12 3l9.5 17h-19L12 3z" /><path d="M12 10v4M12 17.5h0" /></Icon>
);
export const SearchIcon = (p) => (<Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Icon>);
export const NewsIcon = (p) => (
  <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h6M7 13h10M7 16h7" /></Icon>
);
export const ScaleIcon = (p) => (
  <Icon {...p}><path d="M12 4v16M6 20h12M5 8h14" /><path d="M5 8l-2.5 6a3 3 0 005 0L5 8zM19 8l-2.5 6a3 3 0 005 0L19 8z" /></Icon>
);
export const FlagIcon = (p) => (<Icon {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></Icon>);
export const PlayIcon = (p) => (<Icon {...p}><path d="M7 5l12 7-12 7V5z" /></Icon>);
export const GlobeIcon = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></Icon>
);
export const ArrowRightIcon = (p) => (<Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>);
