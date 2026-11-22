const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const ChevronLeft = ({ size = 22 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
)
export const ChevronRight = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
)
export const Plus = ({ size = 24, width = 2.2 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth={width}><path d="M12 5v14M5 12h14" /></svg>
)
export const Close = ({ size = 20 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
)
export const Check = ({ size = 16 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2"><path d="M20 6L9 17l-5-5" /></svg>
)
export const Gear = ({ size = 20 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
export const GridIcon = ({ size = 22 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
export const Cash = ({ size = 22 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
)
export const ListIcon = ({ size = 22 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
)
export const Info = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
)
export const Download = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8"><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
)
export const Upload = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8"><path d="M12 21V9M7 14l5-5 5 5" /><path d="M5 3h14" /></svg>
)
export const Sheet = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
)
export const Backspace = ({ size = 22 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8"><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" /><path d="M17 9l-5 6M12 9l5 6" /></svg>
)
export const Trash = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
)
export const Repeat = ({ size = 14 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>
)
