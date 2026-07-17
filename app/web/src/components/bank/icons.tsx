// Monoline icon set for the bank shell. One stroke family (1.7px, round caps,
// currentColor) so every surface tints its own icons — the line-icon language of
// premium Saudi bank apps (Alinma-class). Emojis read consumer-grade; these don't.

const PATHS = {
  home: (
    <>
      <path d="M4.6 10.4 12 4.3l7.4 6.1V19a1.5 1.5 0 0 1-1.5 1.5H6.1A1.5 1.5 0 0 1 4.6 19z" />
      <path d="M9.7 20.5v-5.2h4.6v5.2" />
    </>
  ),
  cash: (
    <>
      <rect x="2.9" y="6.3" width="18.2" height="11.4" rx="2.1" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.3 9.5h.01M17.7 14.5h.01" />
    </>
  ),
  card: (
    <>
      <rect x="2.9" y="5.5" width="18.2" height="13" rx="2.3" />
      <path d="M2.9 9.7h18.2M6.4 14.9h3.8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.3" r="3.5" />
      <path d="M5 20.1c.9-3.3 3.7-5.1 7-5.1s6.1 1.8 7 5.1" />
    </>
  ),
  transfer: (
    <>
      <path d="M7.3 16.9V7.3m0 0L3.9 10.7M7.3 7.3l3.4 3.4" />
      <path d="M16.7 7.1v9.6m0 0 3.4-3.4m-3.4 3.4-3.4-3.4" />
    </>
  ),
  bill: (
    <>
      <path d="M6.2 3.6h11.6v16.8l-1.93-1.4-1.93 1.4-1.94-1.4-1.93 1.4-1.94-1.4-1.93 1.4z" />
      <path d="M9.2 8.4h5.6M9.2 11.8h5.6" />
    </>
  ),
  phone: (
    <>
      <rect x="7.2" y="3.1" width="9.6" height="17.8" rx="2.2" />
      <path d="M12 8.4v4.2M9.9 10.5h4.2" />
      <path d="M11 17.7h2" />
    </>
  ),
  car: (
    <>
      <path d="M19 17h2a1 1 0 0 0 1-1v-3c0-.9-.6-1.6-1.5-1.9-1.8-.5-4.5-1.1-4.5-1.1s-1.3-1.4-2.2-2.3a2.6 2.6 0 0 0-1.8-.7H5c-.6 0-1.1.3-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4a1 1 0 0 0 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  building: (
    <>
      <path d="M6 20.5V6.2A1.2 1.2 0 0 1 7.2 5h5.6A1.2 1.2 0 0 1 14 6.2v14.3" />
      <path d="M14 9.6h3.3a1.2 1.2 0 0 1 1.2 1.2v9.7" />
      <path d="M3.6 20.5h16.8" />
      <path d="M9 8.6h2M9 12h2M9 15.4h2" />
    </>
  ),
  bank: (
    <>
      <path d="m12 3.4 8.6 4.9v1.5H3.4V8.3z" />
      <path d="M5.8 9.8v6.9M10 9.8v6.9M14 9.8v6.9M18.2 9.8v6.9" />
      <path d="M3.4 20.4h17.2" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  wallet: (
    <>
      <path d="M20.6 9.9V8.3a2.1 2.1 0 0 0-2.1-2.1H5.1A2.1 2.1 0 0 0 3 8.3v9.4a2.1 2.1 0 0 0 2.1 2.1h13.4a2.1 2.1 0 0 0 2.1-2.1v-1.6" />
      <path d="M21.4 9.9h-4.9a2.7 2.7 0 1 0 0 5.4h4.9z" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.4" y="7.3" width="17.2" height="12.4" rx="2.2" />
      <path d="M9.2 7.3V5.9a1.8 1.8 0 0 1 1.8-1.8h2a1.8 1.8 0 0 1 1.8 1.8v1.4" />
      <path d="M3.4 12.4h17.2" />
    </>
  ),
  chart: (
    <>
      <path d="m3.4 17.2 5.2-5.2 3.4 3.4 7.2-7.2" />
      <path d="M15.4 8.2h3.8V12" />
    </>
  ),
  check: <path d="m5 12.7 4.6 4.6L19 7.7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.6V12l2.9 1.9" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

export function Ic({ name, size = 22, stroke = 1.7 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
