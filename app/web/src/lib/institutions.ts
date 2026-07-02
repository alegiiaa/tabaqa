// Saudi open-banking institution directory — the single source of brand truth for
// the Connect picker and the dashboard account cards. Add an entry here and it
// shows up in the picker AND themes its payment card automatically.
//
// `logoOk` marks institutions whose real brand logo at `domain` was verified to
// resolve correctly via Google's faviconV2 service; those render the real logo.
// The rest fall back to a uniform brand-colored monogram chip — so the picker is
// always consistent and never shows a wrong/placeholder logo.

export type InstKind = 'bank' | 'wallet'

export interface Institution {
  id: string
  name: [string, string]   // [en, ar]
  kind: InstKind
  bg: string               // brand color → chip + payment-card gradient
  accent: string           // chip + wordmark accent
  monogram: string         // short uppercase mark — fallback chip when no real logo
  domain?: string          // brand domain → real logo source
  logoOk?: boolean         // true → real logo verified to resolve at `domain`
  logo?: string            // optional bundled logo path (overrides everything)
  logoFull?: boolean       // true → bundled logo is a full-bleed app icon (fill tile, no white frame)
}

export const INSTITUTIONS: Institution[] = [
  // ── banks ──
  { id: 'alrajhi',  name: ['Al Rajhi Bank', 'مصرف الراجحي'], kind: 'bank', bg: 'linear-gradient(135deg,#1466c4 0%,#0c4da2 55%,#06306b 100%)', accent: '#e9c46a', monogram: 'AR', domain: 'alrajhibank.com', logoOk: true },
  { id: 'snb',      name: ['Saudi National Bank', 'البنك الأهلي'], kind: 'bank', bg: 'linear-gradient(135deg,#10b3a3 0%,#0a8a7e 55%,#055e56 100%)', accent: '#f4d06a', monogram: 'SNB', domain: 'alahli.com', logoOk: true },
  { id: 'riyad',    name: ['Riyad Bank', 'بنك الرياض'], kind: 'bank', bg: 'linear-gradient(135deg,#27406b 0%,#16243f 60%,#0c1730 100%)', accent: '#9ec1ff', monogram: 'RB', domain: 'riyadbank.com', logoOk: true },
  { id: 'alinma',   name: ['Alinma Bank', 'مصرف الإنماء'], kind: 'bank', bg: 'linear-gradient(135deg,#8a2be0 0%,#5b1f86 55%,#3a1257 100%)', accent: '#f4c95d', monogram: 'AL', domain: 'alinma.com', logoOk: true },
  { id: 'sab',      name: ['Saudi Awwal Bank', 'البنك الأول'], kind: 'bank', bg: 'linear-gradient(135deg,#d11f3a 0%,#a3122a 55%,#5a0a16 100%)', accent: '#f1b0b0', monogram: 'SAB', domain: 'sab.com', logoOk: true },
  { id: 'albilad',  name: ['Bank Albilad', 'بنك البلاد'], kind: 'bank', bg: 'linear-gradient(135deg,#0a7d3e 0%,#076230 55%,#053f20 100%)', accent: '#e9c46a', monogram: 'AB', domain: 'bankalbilad.com', logoOk: true },
  { id: 'anb',      name: ['Arab National Bank', 'البنك العربي'], kind: 'bank', bg: 'linear-gradient(135deg,#0b5cab 0%,#08468a 55%,#063463 100%)', accent: '#cfe0ff', monogram: 'ANB', domain: 'anb.com.sa', logoOk: true },
  { id: 'bsf',      name: ['Banque Saudi Fransi', 'البنك السعودي الفرنسي'], kind: 'bank', bg: 'linear-gradient(135deg,#0c3b3b 0%,#072a2a 55%,#041a1a 100%)', accent: '#bfeaea', monogram: 'BSF', domain: 'alfransi.com.sa', logo: '/logos/bsf.png' },
  { id: 'stcbank',  name: ['stc bank', 'stc بنك'], kind: 'bank', bg: 'linear-gradient(135deg,#7b1fa2 0%,#4f008c 55%,#2a0049 100%)', accent: '#e6b3ff', monogram: 'STC', domain: 'stcbank.com.sa', logoOk: true },
  { id: 'd360',     name: ['D360 Bank', 'بنك D360'], kind: 'bank', bg: 'linear-gradient(135deg,#12b886 0%,#0a8f68 55%,#065c43 100%)', accent: '#c8f5e4', monogram: 'D360', domain: 'd360.com' },
  // ── wallets ──
  { id: 'barq',   name: ['Barq', 'برق'], kind: 'wallet', bg: 'linear-gradient(135deg,#1a2c44 0%,#101a2e 55%,#070b16 100%)', accent: '#c6ff3c', monogram: 'BRQ', domain: 'getbarq.com', logo: '/logos/barq.png', logoFull: true },
  { id: 'stcpay', name: ['stc pay', 'stc pay'], kind: 'wallet', bg: 'linear-gradient(135deg,#5b1a8f 0%,#430d6e 55%,#2a0049 100%)', accent: '#e6b3ff', monogram: 'PAY', domain: 'stcpay.com.sa', logo: '/logos/stcpay.png', logoFull: true },
  { id: 'urpay',  name: ['urpay', 'يورباي'], kind: 'wallet', bg: 'linear-gradient(135deg,#2b5cff 0%,#1e44d6 55%,#142e99 100%)', accent: '#cfe0ff', monogram: 'UR', domain: 'urpay.com', logo: '/logos/urpay.png', logoFull: true },
]

export const BANKS = INSTITUTIONS.filter((i) => i.kind === 'bank')
export const WALLETS = INSTITUTIONS.filter((i) => i.kind === 'wallet')

const BY_ID: Record<string, Institution> = Object.fromEntries(INSTITUTIONS.map((i) => [i.id, i]))

export function institution(id: string | undefined | null): Institution | undefined {
  return id ? BY_ID[id] : undefined
}

/** Google faviconV2 logo URL for a domain (high-res, transparent where available). */
export function faviconV2(domain: string, size = 128): string {
  return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=${size}`
}

/** Real brand-logo URL for an institution, or null if it should use its chip. */
export function logoUrl(inst: Institution | undefined): string | null {
  if (!inst) return null
  if (inst.logo) return inst.logo
  return inst.logoOk && inst.domain ? faviconV2(inst.domain) : null
}

/** Resolve a ledger source like "bank:alinma" / "wallet:barq" → its Institution. */
export function institutionFromSource(source: string): Institution | undefined {
  const provider = source.split(':', 2)[1] ?? source
  return BY_ID[provider]
}

/** Localized short label for a source's institution, with a generic fallback. */
export function sourceLabel(source: string, tx: (en: string, ar: string) => string): string {
  const inst = institutionFromSource(source)
  if (inst) return tx(inst.name[0], inst.name[1])
  return source.startsWith('wallet:') ? tx('Wallet', 'محفظة') : tx('Bank', 'بنك')
}
