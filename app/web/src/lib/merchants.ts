// Brand registry — turns a raw transaction into a branded, logo-ready record so
// the ledger reads like a real banking-app feed. Resolution order:
//   1. the canonical `merchant` the backend resolved (pipeline/enrich.py)
//   2. a keyword scan over raw_desc (Latin + Arabic)
//   3. a fallback by txn_type (salary → employer, p2p → person, …)
import type { Transaction } from './api'

export type IconKey =
  | 'coffee' | 'cart' | 'fuel' | 'bag' | 'card' | 'wallet' | 'signal'
  | 'building' | 'person' | 'swap' | 'home' | 'food' | 'store'

export interface Brand {
  label: string
  color: string          // tile background (brand colour)
  text?: string          // tile foreground (default #fff)
  icon: IconKey
  monogram?: string      // short wordmark shown instead of the icon
  domain?: string        // brand domain → real logo via Logo.dev (falls back to the tile if absent/unknown)
  category: string       // category key → CATEGORY_LABELS
}

// Keyed by the lowercased canonical merchant name from enrich.py, plus a few
// extra ids the keyword scan can hit directly. `domain` is resolved to a real
// logo at render time by <MerchantLogo> via Logo.dev — no bundled image assets.
// (Domains below were verified to resolve on Logo.dev; misses fall back to the icon.)
export const BRANDS: Record<string, Brand> = {
  // ── gig / delivery ──
  jahez:         { label: 'Jahez',         color: '#E2231A', icon: 'food',  monogram: 'ج', domain: 'jahez.net',         category: 'gig' },
  hungerstation: { label: 'HungerStation', color: '#F58220', icon: 'food',  monogram: 'H', domain: 'hungerstation.com', category: 'gig' },
  mrsool:        { label: 'Mrsool',        color: '#00B0A6', icon: 'food',  monogram: 'M', category: 'gig' }, // no Logo.dev logo → food icon
  careem:        { label: 'Careem',        color: '#0BA14A', icon: 'food',  monogram: 'C', domain: 'careem.com',        category: 'gig' },
  uber:          { label: 'Uber',          color: '#0a0d14', icon: 'food',  monogram: 'U', domain: 'uber.com',          category: 'gig' },
  // ── groceries / retail ──
  panda:     { label: 'Panda',     color: '#2FA84F', icon: 'cart',  domain: 'panda.com.sa',      category: 'grocery' },
  tamimi:    { label: 'Tamimi',    color: '#0F7B3E', icon: 'cart',  domain: 'tamimimarkets.com', category: 'grocery' },
  carrefour: { label: 'Carrefour', color: '#004E9F', icon: 'cart',  monogram: 'C', domain: 'carrefour.com', category: 'grocery' },
  othaim:    { label: 'Othaim',    color: '#E11B22', icon: 'cart',  domain: 'othaimmarkets.com', category: 'grocery' },
  jarir:     { label: 'Jarir',     color: '#E4002B', icon: 'store', domain: 'jarir.com',         category: 'retail' },
  // ── coffee / food ──
  starbucks: { label: 'Starbucks', color: '#00704A', icon: 'coffee', domain: 'starbucks.com', category: 'coffee' },
  barns:     { label: "Barn's",    color: '#5A2A1B', icon: 'coffee', domain: 'barns.com.sa',  category: 'coffee' },
  // ── fuel ──
  sasco:    { label: 'SASCO',    color: '#0B6B3A', icon: 'fuel', domain: 'sasco.com.sa', category: 'fuel' },
  petromin: { label: 'Petromin', color: '#C8102E', icon: 'fuel', domain: 'petromin.com', category: 'fuel' },
  // ── e-commerce / wallets ──
  noon:   { label: 'noon',   color: '#FEEE00', text: '#1a1a1a', icon: 'bag',    monogram: 'noon', domain: 'noon.com',     category: 'ecommerce' },
  amazon: { label: 'Amazon', color: '#232F3E', icon: 'bag',    monogram: 'a',  domain: 'amazon.com',   category: 'ecommerce' },
  urpay:  { label: 'urpay',  color: '#6A1B9A', icon: 'wallet', monogram: 'ur', domain: 'urpay.com.sa', category: 'wallet' },
  // ── telecom ──
  stc:    { label: 'STC',    color: '#4F008C', icon: 'signal', monogram: 'stc', domain: 'stc.com.sa',    category: 'telecom' },
  mobily: { label: 'Mobily', color: '#00B5A5', icon: 'signal', domain: 'mobily.com.sa', category: 'telecom' },
}

// raw_desc keyword (normalised, Latin + Arabic) → brand id.
const KEYWORDS: [string[], string][] = [
  [['jahez', 'جاهز'], 'jahez'],
  [['hungerstation', 'هنقرستيشن'], 'hungerstation'],
  [['mrsool', 'مرسول'], 'mrsool'],
  [['careem', 'كريم'], 'careem'],
  [['uber'], 'uber'],
  [['starbucks', 'ستاربكس'], 'starbucks'],
  [['barns', 'بارنز'], 'barns'],
  [['بنده', 'panda'], 'panda'],
  [['carrefour', 'كارفور'], 'carrefour'],
  [['tamimi', 'تميمي'], 'tamimi'],
  [['othaim', 'العثيم'], 'othaim'],
  [['jarir', 'جرير'], 'jarir'],
  [['sasco', 'ساسكو'], 'sasco'],
  [['petromin'], 'petromin'],
  [['noon', 'نون'], 'noon'],
  [['amazon', 'امازون'], 'amazon'],
  [['urpay'], 'urpay'],
  [['stc'], 'stc'],
  [['mobily'], 'mobily'],
]

export interface ResolvedTxn {
  title: string        // clean display name
  color: string
  text: string
  icon: IconKey
  monogram?: string
  domain?: string      // brand domain → real logo via Logo.dev
  category: string     // CATEGORY_LABELS key
}

// category key → [en, ar] for the small caption under the merchant name.
export const CATEGORY_LABELS: Record<string, [string, string]> = {
  gig: ['Delivery payout', 'دخل توصيل'],
  grocery: ['Groceries', 'بقالة'],
  retail: ['Retail', 'تجزئة'],
  coffee: ['Coffee', 'قهوة'],
  fuel: ['Fuel', 'وقود'],
  ecommerce: ['Online', 'تسوّق إلكتروني'],
  wallet: ['Wallet', 'محفظة'],
  telecom: ['Telecom', 'اتصالات'],
  salary: ['Salary', 'راتب'],
  p2p: ['Transfer received', 'تحويل وارد'],
  internal: ['Internal transfer', 'تحويل داخلي'],
  obligation: ['Financing', 'تمويل'],
  purchase: ['Purchase', 'مشتريات'],
}

const norm = (s: string) =>
  (s || '')
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase()

function brandToResolved(b: Brand): ResolvedTxn {
  return { title: b.label, color: b.color, text: b.text ?? '#fff', icon: b.icon, monogram: b.monogram, domain: b.domain, category: b.category }
}

/** A transaction → a branded, logo-ready record for the feed. */
export function resolveMerchant(t: Pick<Transaction, 'merchant' | 'raw_desc' | 'txn_type' | 'category' | 'direction'>): ResolvedTxn {
  // 1) trust the backend-resolved canonical merchant
  if (t.merchant) {
    const b = BRANDS[norm(t.merchant)]
    if (b) return brandToResolved(b)
  }
  // 2) keyword scan over the raw description
  const desc = norm(t.raw_desc)
  for (const [tokens, id] of KEYWORDS) {
    if (tokens.some((tok) => desc.includes(norm(tok)))) return brandToResolved(BRANDS[id])
  }
  // 3) fall back by transaction type
  switch (t.txn_type) {
    case 'salary': {
      const who = t.raw_desc.split(/[-–]/).slice(1).join('-').trim() || 'Employer'
      return { title: who, color: '#1d4ed8', text: '#fff', icon: 'building', category: 'salary' }
    }
    case 'p2p': {
      const who = t.raw_desc.replace(/^.*?(من|from)\s*/i, '').trim() || 'Transfer'
      return { title: who, color: '#0f9d63', text: '#fff', icon: 'person', category: 'p2p' }
    }
    case 'internal_movement':
      return { title: 'Barq ⇄ Bank', color: '#576070', text: '#fff', icon: 'swap', category: 'internal' }
    case 'loan_obligation':
      return { title: t.raw_desc.includes('عقاري') ? 'Home financing' : 'Financing', color: '#9a6700', text: '#fff', icon: 'home', category: 'obligation' }
    default:
      return { title: t.raw_desc || 'Purchase', color: '#8b94a4', text: '#fff', icon: 'card', category: 'purchase' }
  }
}
