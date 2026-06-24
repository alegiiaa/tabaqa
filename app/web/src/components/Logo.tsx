/** The Tabaqa "stacked layers" mark — white (on the hero image) or blue gradient. */
export function TabaqaMark({ variant = 'white' }: { variant?: 'white' | 'gradient' }) {
  if (variant === 'gradient') {
    return (
      <svg className="mark" viewBox="0 0 100 92" aria-label="Tabaqa">
        <defs>
          <linearGradient id="tabaqa-mark-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <g fill="url(#tabaqa-mark-grad)">
          <rect x="6" y="66" width="88" height="20" rx="8" />
          <rect x="6" y="39" width="88" height="20" rx="8" />
          <rect x="6" y="12" width="88" height="20" rx="8" transform="rotate(-8 50 22)" />
        </g>
      </svg>
    )
  }
  return (
    <svg className="mark" viewBox="0 0 100 92" aria-label="Tabaqa">
      <g fill="#ffffff">
        <rect x="6" y="66" width="88" height="20" rx="8" />
        <rect x="6" y="39" width="88" height="20" rx="8" />
        <rect x="6" y="12" width="88" height="20" rx="8" transform="rotate(-8 50 22)" />
      </g>
    </svg>
  )
}
