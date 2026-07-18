/* Tek yerde tutulan ikonlar — hepsi 24x24 stroke tabanlı, tutarlı ağırlıkta. */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconHome = (p) => (
  <svg {...base} {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg>
);

export const IconNote = (p) => (
  <svg {...base} {...p}><path d="M5 4h9l5 5v11H5z" /><path d="M14 4v5h5" /><path d="M8.5 13h7M8.5 16.5h4" /></svg>
);

export const IconGame = (p) => (
  <svg {...base} {...p}><rect x="2.5" y="7" width="19" height="10" rx="4" /><path d="M7 10.5v3M5.5 12h3M15.5 11.5h.01M18 13.5h.01" /></svg>
);

export const IconBrush = (p) => (
  <svg {...base} {...p}><path d="M20 4.5c-1 3.5-5 7-9.5 9.5" /><path d="M11 14c1 1.5 1 3.5-.5 5-1.5 1.5-4 1.5-6.5 1 1.5-1 1.5-2.5 1.5-4 0-1.5 1.5-3 3-3 1 0 2 .4 2.5 1z" /></svg>
);

export const IconRoom = (p) => (
  <svg {...base} {...p}><circle cx="9" cy="10" r="3.2" /><circle cx="15" cy="10" r="3.2" /><path d="M4 19c.6-2.6 2.6-4 5-4M20 19c-.6-2.6-2.6-4-5-4" /></svg>
);

export const IconArchive = (p) => (
  <svg {...base} {...p}><rect x="3" y="4.5" width="18" height="4.5" rx="1.6" /><path d="M4.5 9v10.5h15V9" /><path d="M10 13h4" /></svg>
);

export const IconPlus = (p) => (
  <svg {...base} strokeWidth="2.2" {...p}><path d="M12 5.5v13M5.5 12h13" /></svg>
);

export const IconBack = (p) => (
  <svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>
);

export const IconUndo = (p) => (
  <svg {...base} {...p}><path d="M8 7H5V4" /><path d="M5.5 7A8 8 0 1 1 5 13" /></svg>
);

export const IconRedo = (p) => (
  <svg {...base} {...p}><path d="M16 7h3V4" /><path d="M18.5 7A8 8 0 1 0 19 13" /></svg>
);

export const IconTrash = (p) => (
  <svg {...base} {...p}><path d="M4.5 7h15" /><path d="M9 7V4.8h6V7" /><path d="M6.5 7l.9 12.2h9.2L17.5 7" /></svg>
);

export const IconCheck = (p) => (
  <svg {...base} strokeWidth="2.2" {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export const IconCopy = (p) => (
  <svg {...base} {...p}><rect x="9" y="9" width="11" height="11" rx="3" /><path d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15" /></svg>
);

export const IconClose = (p) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);

export const IconSettings = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></svg>
);