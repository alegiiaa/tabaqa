import { useState } from 'react'
import type { IconKey, ResolvedTxn } from '../../lib/merchants'

// Logo.dev publishable token (safe to expose in client URLs). Absent → tiles only.
const LOGO_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN as string | undefined

// Stroke-based glyphs (currentColor) — clean at any size, no external assets.
const ICONS: Record<IconKey, JSX.Element> = {
  coffee: <><path d="M5 8h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z" /><path d="M16 9h2a2 2 0 0 1 0 4h-2" /><path d="M8 3v2M11 3v2" /></>,
  cart: <><circle cx="9" cy="19" r="1.4" /><circle cx="16" cy="19" r="1.4" /><path d="M3 4h2l2 11h10l2-7H6" /></>,
  fuel: <><rect x="4" y="4" width="9" height="16" rx="1.5" /><path d="M4 11h9" /><path d="M16 8l2 2v6a1.5 1.5 0 0 1-3 0V6" /></>,
  bag: <><path d="M5 8h14l-1 11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h3" /><path d="M3 9h13a2 2 0 0 1 2 2" /></>,
  signal: <><path d="M5 19v-4M10 19v-8M15 19v-11M20 19V5" /></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
  person: <><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></>,
  swap: <><path d="M7 7h11l-3-3M17 17H6l3 3" /></>,
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></>,
  food: <><path d="M5 4v7a3 3 0 0 0 6 0V4M8 4v16" /><path d="M17 4c-1.5 0-2.5 2-2.5 5 0 2 1 3 2.5 3v8" /></>,
  store: <><path d="M4 9l1-5h14l1 5" /><path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" /><path d="M5 11v8h14v-8" /></>,
}

export function MerchantLogo({ r, size = 40 }: { r: ResolvedTxn; size?: number }) {
  // Real brand logo via Logo.dev when we have a domain + token. `fallback=404` makes
  // unknown brands (and a bad/missing token → 401) return an error, so the <img>
  // fires onError and we drop to the branded tile below. We remember the failed src
  // (not just a bool) so a re-used component instance still tries a new merchant's logo.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const src = LOGO_TOKEN && r.domain
    ? `https://img.logo.dev/${r.domain}?token=${LOGO_TOKEN}&size=${size * 2}&format=png&fallback=404`
    : null

  if (src && src !== failedSrc) {
    return (
      <span className="mlogo mlogo-img" style={{ width: size, height: size }} aria-hidden>
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
        />
      </span>
    )
  }

  const fs = r.monogram && r.monogram.length > 1 ? size * 0.3 : size * 0.42
  return (
    <span
      className="mlogo"
      style={{ width: size, height: size, background: r.color, color: r.text }}
      aria-hidden
    >
      {r.monogram ? (
        <span className="mlogo-mono" style={{ fontSize: fs }}>{r.monogram}</span>
      ) : (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          {ICONS[r.icon]}
        </svg>
      )}
    </span>
  )
}
