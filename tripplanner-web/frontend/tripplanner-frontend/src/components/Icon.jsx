// Íconos de línea (24×24, trazo 1.8) dibujados para TripPlanner AI.
const PATHS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>,
  chat: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.2A2.5 2.5 0 0 1 4 13.5z" /><path d="M8.5 8.5h7M8.5 11.5h4.5" /></>,
  plane: <path d="M21 15.5v-2l-8-5V3.8a1.5 1.5 0 0 0-3 0v4.7l-8 5v2l8-2.5v5L7.5 19.5V21l4-1.2 4 1.2v-1.5L13 18v-5z" />,
  weather: <><circle cx="9" cy="8" r="3.2" /><path d="M9 2v1.3M3 8h1.3M4.8 3.8l.9.9M13.2 3.8l-.9.9" /><path d="M8 20h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.3A3 3 0 0 0 8 20z" /></>,
  map: <><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  ticket: <><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" /><path d="M14 6.5v11" strokeDasharray="2 2.2" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  send: <path d="M4 12 20 4l-6 16-2.8-6.2z M11.2 13.8 20 4" />,
  sparkles: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
  file: <><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  food: <><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" /><path d="M17 21V3c-2 1.2-3 4-3 7v3h3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
  users: <><circle cx="9" cy="8" r="3.3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M18 14.5a5.5 5.5 0 0 1 3 5.5" /></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="3.5" y="7.5" width="17" height="12" rx="2.5" /><circle cx="16.5" cy="13.5" r="1.2" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  check: <path d="M5 12.5 10 17l9-10" />,
  edit: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z M13.5 6.5l4 4" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 3v5h5M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 21v-5h-5" /></>,
}

export default function Icon({ name, size = 20, className = '', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`icon ${className}`} {...rest}>
      {PATHS[name] || null}
    </svg>
  )
}

/** Marca: rosa de los vientos con estela de vuelo. */
export function BrandMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="brand-mark">
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" /><stop offset="1" stopColor="#5cc8ff" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#0e2231" stroke="url(#bm-g)" strokeWidth="1.5" />
      <path d="M8 27c6-1 12-6 16-13" stroke="#ff7a59" strokeWidth="1.6" strokeDasharray="2 2.6" fill="none" strokeLinecap="round" />
      <path d="M27.5 9.5 31 7l-1.3 4.2-3.4 1.2z" fill="#ff7a59" />
      <path d="M20 11.5 22 20l-2 8.5L18 20z" fill="url(#bm-g)" />
      <path d="M11.5 20 20 18l8.5 2-8.5 2z" fill="url(#bm-g)" opacity=".55" />
      <circle cx="20" cy="20" r="1.6" fill="#06121b" />
    </svg>
  )
}
