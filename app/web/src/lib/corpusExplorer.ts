// Corpus scale explorer — makes the 1,000,000-account synthetic corpus browsable
// (data/synthetic/corpus_segments.json, learned from real Berka, TSTR 96%).
// Applicant #i is DERIVED deterministically from its index: hash(i) → segment by
// the corpus' real shares → seeded jitter around that segment's median profile →
// the same §20-style decision rules every time. Nothing is stored: pick any N in
// [1, 1M] and any applicant inside it exists, reproducibly.
// Provenance: segment shares/medians come verbatim from the eval pipeline
// (eval/corpus.py); web/src/data/corpus_segments.json is a copy — re-copy on regen.

import segmentsRaw from '../data/corpus_segments.json'

export const CORPUS_TOTAL = 1_000_000

export interface Segment {
  key: string
  label: string
  share: number
  bad_rate: number
  median_profile: Record<string, number>
}

export const SEGMENTS: Segment[] = (segmentsRaw as { segments: Segment[] }).segments

export const SEGMENT_AR: Record<string, string> = {
  thin_file: 'ملف رقيق — تاريخ مصرفي قصير',
  high_obligation: 'التزامات مرتفعة',
  irregular_income: 'دخل غير منتظم — عمل حر',
  stable_salaried: 'راتب مستقر',
}
export const SEGMENT_EN: Record<string, string> = {
  thin_file: 'Thin-file',
  high_obligation: 'Heavily obligated',
  irregular_income: 'Irregular income',
  stable_salaried: 'Stable salaried',
}

// ── deterministic per-index randomness ───────────────────────────────────────

/** splitmix32 — one 32-bit hash step; good avalanche, zero deps. */
function hash32(x: number): number {
  x = (x + 0x9e3779b9) | 0
  let z = x ^ (x >>> 16)
  z = Math.imul(z, 0x21f0aaad)
  z = z ^ (z >>> 15)
  z = Math.imul(z, 0x735a2d97)
  return (z ^ (z >>> 15)) >>> 0
}

/** A tiny seeded stream of uniforms for applicant i. */
function stream(i: number) {
  let s = hash32(i)
  return () => {
    s = hash32(s)
    return s / 4294967296
  }
}

// ── the applicant at index i ─────────────────────────────────────────────────

const FIRST = [
  ['محمد', 'Mohammed'], ['أحمد', 'Ahmed'], ['عبدالله', 'Abdullah'], ['سلطان', 'Sultan'],
  ['فهد', 'Fahd'], ['خالد', 'Khalid'], ['سعود', 'Saud'], ['ناصر', 'Nasser'],
  ['بدر', 'Badr'], ['تركي', 'Turki'], ['سالم', 'Salem'], ['ماجد', 'Majed'],
  ['نورة', 'Noura'], ['سارة', 'Sara'], ['ريم', 'Reem'], ['لطيفة', 'Latifa'],
  ['هند', 'Hind'], ['منيرة', 'Munira'], ['عهود', 'Ohoud'], ['أمل', 'Amal'],
] as const
const LAST = [
  ['القحطاني', 'Al-Qahtani'], ['العتيبي', 'Al-Otaibi'], ['الدوسري', 'Al-Dossari'],
  ['الشمري', 'Al-Shammari'], ['المطيري', 'Al-Mutairi'], ['الغامدي', 'Al-Ghamdi'],
  ['الزهراني', 'Al-Zahrani'], ['الحربي', 'Al-Harbi'], ['السبيعي', 'Al-Subaie'],
  ['العنزي', 'Al-Anazi'], ['الشهري', 'Al-Shehri'], ['البقمي', 'Al-Buqami'],
  ['المالكي', 'Al-Malki'], ['الجهني', 'Al-Juhani'], ['الرشيدي', 'Al-Rashidi'],
  ['باوزير', 'Bawazir'],
] as const

export type Decision = 'approved' | 'declined' | 'review'

export interface CorpusApplicant {
  index: number
  nameAr: string
  nameEn: string
  segment: Segment
  age: number
  incomeRegularity: number
  incomeExpenseRatio: number
  obligationLoad: number
  avgBalance: number
  balanceVolatility: number
  loanAsk: number
  grade: 'A' | 'B' | 'C' | 'D'
  decision: Decision
  reasonAr: string
  reasonEn: string
}

const cumShares = (() => {
  let acc = 0
  return SEGMENTS.map((s) => (acc += s.share))
})()

function jitter(r: () => number, base: number, pct: number, min = 0, max = Infinity): number {
  const v = base * (1 - pct + r() * 2 * pct)
  return Math.min(max, Math.max(min, v))
}

/** Deterministic applicant for any index in [1, CORPUS_TOTAL]. */
export function applicantAt(i: number): CorpusApplicant {
  const r = stream(i)
  const u = r()
  const segment = SEGMENTS[cumShares.findIndex((c) => u <= c)] ?? SEGMENTS[SEGMENTS.length - 1]
  const m = segment.median_profile

  const fn = FIRST[Math.floor(r() * FIRST.length)]
  const ln = LAST[Math.floor(r() * LAST.length)]

  const incomeRegularity = jitter(r, m.income_regularity, 0.45, 0.02, 0.98)
  const incomeExpenseRatio = jitter(r, m.income_expense_ratio, 0.12, 0.85, 2.2)
  const obligationLoad = jitter(r, m.recurring_obligation_load, 0.4, 0.01, 0.6)
  const avgBalance = Math.round(jitter(r, m.avg_balance, 0.5, 1200) / 10) * 10
  const balanceVolatility = jitter(r, m.balance_volatility, 0.3, 0.05, 0.95)
  const loanAsk = Math.round(jitter(r, m.loan_amount, 0.45, 15_000, 500_000) / 1000) * 1000
  const age = Math.round(jitter(r, m.age, 0.2, 21, 59))

  // Risk grade from the segment's real bad rate, spread by the individual draw.
  // Spread and cutoffs tuned so manual review stays exception-based (spec §10).
  const pd = segment.bad_rate * jitter(r, 1, 0.55, 0.5, 1.6)
  const grade = pd < 0.06 ? 'A' : pd < 0.11 ? 'B' : pd < 0.2 ? 'C' : 'D'

  // §20-mirror decision rules, computed from the generated features.
  let decision: Decision = 'approved'
  let reasonAr = 'ضمن حدود الاستقطاع والسياسة — موافقة تلقائية'
  let reasonEn = 'Within DBR and policy limits — auto-approved'
  if (obligationLoad > 1 / 3) {
    decision = 'declined'
    reasonAr = 'الالتزامات القائمة تتجاوز حد الاستقطاع النظامي'
    reasonEn = 'Existing obligations exceed the debt-burden limit'
  } else if (incomeExpenseRatio < 1.02) {
    decision = 'declined'
    reasonAr = 'لا يوجد دخل متاح كافٍ بعد المصروفات الأساسية'
    reasonEn = 'No sufficient disposable income after essentials'
  } else if (incomeRegularity < 0.08) {
    decision = 'review'
    reasonAr = 'دخل غير منتظم بدرجة عالية — مراجعة يدوية'
    reasonEn = 'Highly irregular income — manual review'
  } else if (grade === 'D') {
    decision = 'review'
    reasonAr = 'درجة مخاطر تتطلب مراجعة يدوية وفق سياسة المصرف'
    reasonEn = 'Risk grade requires manual review per bank policy'
  }

  return {
    index: i,
    nameAr: `${fn[0]} ${ln[0]}`,
    nameEn: `${fn[1]} ${ln[1]}`,
    segment,
    age,
    incomeRegularity,
    incomeExpenseRatio,
    obligationLoad,
    avgBalance,
    balanceVolatility,
    loanAsk,
    grade,
    decision,
    reasonAr,
    reasonEn,
  }
}

// ── portfolio aggregates for any N — O(1) at slider time ─────────────────────
// Decision rates per segment are Monte-Carlo'd ONCE at module load from the same
// applicantAt() generator (so the aggregate always agrees with the individuals),
// then scaled analytically to the selected N.

const MC_PER_SEGMENT = 4000
const rates = (() => {
  const bySeg = new Map<string, { approved: number; declined: number; review: number; loanSum: number; n: number }>()
  for (const s of SEGMENTS) bySeg.set(s.key, { approved: 0, declined: 0, review: 0, loanSum: 0, n: 0 })
  // Sample a fixed slice of the index space — deterministic, generator-faithful.
  const need = MC_PER_SEGMENT * SEGMENTS.length
  for (let i = 1, done = 0; done < need && i <= 400_000; i++) {
    const a = applicantAt(i)
    const b = bySeg.get(a.segment.key)!
    if (b.n >= MC_PER_SEGMENT) continue
    b.n++
    done++
    b[a.decision]++
    if (a.decision === 'approved') b.loanSum += a.loanAsk
  }
  return bySeg
})()

export interface PortfolioStats {
  n: number
  approved: number
  declined: number
  review: number
  /** SAR volume of auto-approved financing */
  approvedVolume: number
  /** exposure-weighted portfolio bad rate (from the corpus' real segment bad rates) */
  weightedBadRate: number
  thinFileShare: number
  segments: { segment: Segment; count: number }[]
}

export function portfolioFor(n: number): PortfolioStats {
  let approved = 0
  let declined = 0
  let review = 0
  let approvedVolume = 0
  let badAcc = 0
  const segments = SEGMENTS.map((s) => {
    const count = Math.round(s.share * n)
    const r = rates.get(s.key)!
    approved += (r.approved / r.n) * count
    declined += (r.declined / r.n) * count
    review += (r.review / r.n) * count
    approvedVolume += (r.loanSum / Math.max(1, r.approved)) * (r.approved / r.n) * count
    badAcc += s.bad_rate * s.share
    return { segment: s, count }
  })
  const thin = SEGMENTS.find((s) => s.key === 'thin_file')!
  return {
    n,
    approved: Math.round(approved),
    declined: Math.round(declined),
    review: Math.round(review),
    approvedVolume: Math.round(approvedVolume),
    weightedBadRate: badAcc,
    thinFileShare: thin.share,
    segments,
  }
}
