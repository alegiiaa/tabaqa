// The Tabaqa app's data + decision layer (TEAM SPEC 2026-07-17, the 10-stage journey).
//
// Everything the journey screens show is FETCHED (sandbox HTTP, offline fallback
// for the curated cast) and then DERIVED (bank/derive.ts over the fused RawSet;
// lib/lenders.ts per-lender policy engines over the derived inputs). Nothing is
// scripted: Ahmed's approval, Sara's empty offers page and Khalid's review banner
// are all outcomes of the same functions run on different raw payloads — and any
// of the 500,000 cohort NINs walks the same journey.

import { API_BASE } from '../../lib/api'
import type { StatementInput, StatementRowInput } from '../../lib/api'
import {
  createDeskOrder, getDeskOrder, newOrderId,
  type OrderEvent, type OrderStatus,
} from '../../lib/ordersDesk'
import { encodeStatement } from '../../lib/reportlink'
import {
  computeOffers, LenderPolicy, LockedOffer, Offer, OffersResult, OfferInputs,
  SAMA_CAP_EMPLOYEE, ProductType,
} from '../../lib/lenders'
import { decide, deriveProfile, eligibleIncomeOf, DecisionResult, Profile } from '../bank/derive'
import { fmt } from '../bank/financeMath'
import { RAW_SETS, PersonaId, RawSet, RawTx } from '../bank/raw'

// ── transport — real HTTP to the Tabaqa Sandbox, bundled fallback offline ────

export type Transport = 'sandbox' | 'local'

const FETCH_TIMEOUT_MS = 10_000

class SbxHttpError extends Error {
  status: number
  body: any
  constructor(status: number, body: any) {
    super(`sandbox HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

async function sbx(path: string): Promise<Record<string, any>> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/sandbox/v1${path}`, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) {
      let body: any = null
      try { body = await res.json() } catch { /* non-JSON error body */ }
      throw new SbxHttpError(res.status, body)
    }
    return (await res.json()) as Record<string, any>
  } finally {
    clearTimeout(timer)
  }
}

/** Warm the serverless lambda the moment the journey opens (same trick as /bank). */
export function warmSandbox(): void {
  sbx('').catch(() => {})
}

/** True only for the sandbox's OWN "no such test identity" 404 — a plain route
 *  404 (older API deploy without an endpoint) must fall back, not blame the NIN. */
function ninUnknown404(e: unknown): boolean {
  return e instanceof SbxHttpError && e.status === 404 &&
    typeof (e.body as any)?.detail === 'string' &&
    (e.body as any).detail.startsWith('Unknown test national ID')
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** The curated cast, addressable by NIN — the offline fallback only covers these. */
export const NIN_TO_PERSONA: Record<string, PersonaId> = {
  '1084634821': 'ahmed',
  '2047183377': 'sara',
  '1069127734': 'khalid',
}
export const CAST = [
  { nin: '1084634821', nameAr: 'أحمد القحطاني', hintAr: 'موافقة — الصورة الكاملة تغطي المبلغ' },
  { nin: '2047183377', nameAr: 'سارة الشمري', hintAr: 'لا عروض متوافقة — الالتزامات فوق الحد' },
  { nin: '1069127734', nameAr: 'خالد العتيبي', hintAr: 'مراجعة — الراتب المعلن لا يطابق الحركات' },
]

// seeded PRNG for offline fallbacks — same NIN, same numbers, every run
function seedOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── the seven consented reads of the spec, stage 3 ───────────────────────────

export interface Got<T> { data: T; transport: Transport }

export interface Identity { nameAr: string; nameEn: string; age: number }

/** The bundled offline identity — curated cast only. */
function localIdentity(nin: string): Identity | null {
  const p = NIN_TO_PERSONA[nin]
  if (!p) return null
  const rec = RAW_SETS[p].employment.record
  const rng = mulberry32(seedOf(`age-${nin}`))
  return {
    nameAr: String(rec.full_name),
    nameEn: p.charAt(0).toUpperCase() + p.slice(1),
    age: Math.max(23 + Math.floor(rng() * 20), 21 + Number(rec.service_years ?? 0)),
  }
}

export async function fetchIdentity(nin: string): Promise<Got<Identity>> {
  try {
    const env = await sbx(`/identities/${nin}`)
    return {
      data: { nameAr: String(env.name_ar), nameEn: String(env.name_en), age: Number(env.age) },
      transport: 'sandbox',
    }
  } catch {
    const local = localIdentity(nin)
    if (!local) throw new Error('cohort identities exist only in the sandbox')
    await wait(240)
    return { data: local, transport: 'local' }
  }
}

// ── the login gate — "who am I" + type-ahead over the test population ────────

export interface WhoAmI extends Identity {
  memberNo: number | null // 1-based position in the 500k cohort; null for the cast
  population: number
  transport: Transport
}

/** Resolve a NIN to its person — the login screen's reveal moment.
 *  Throws 'unknown-nin' (sandbox says no such test identity) or
 *  'offline-cohort' (no server and the NIN is not one of the bundled cast). */
export async function whoami(nin: string): Promise<WhoAmI> {
  try {
    const env = await sbx(`/identities/${nin}`)
    return {
      nameAr: String(env.name_ar),
      nameEn: String(env.name_en),
      age: Number(env.age),
      memberNo: env.cohort_member_no != null ? Number(env.cohort_member_no) : null,
      population: Number(env.cohort_population ?? 500_000),
      transport: 'sandbox',
    }
  } catch (e) {
    if (ninUnknown404(e)) throw new Error('unknown-nin')
    const local = localIdentity(nin)
    if (!local) throw new Error('offline-cohort')
    await wait(240)
    return { ...local, memberNo: null, population: 500_000, transport: 'local' }
  }
}

export interface IdentitySuggestion { nin: string; nameAr: string; hintAr: string; kind: 'cast' | 'cohort' }

/** Type-ahead over cast + cohort NINs — sandbox-only convenience (synthetic
 *  identities; a real identity system never autocompletes IDs). Offline it
 *  degrades to the bundled cast. */
export async function suggestIdentities(prefix: string, limit = 5): Promise<IdentitySuggestion[]> {
  try {
    const env = await sbx(`/cohort/suggest?prefix=${encodeURIComponent(prefix)}&limit=${limit}`)
    return (env.matches as Record<string, any>[]).map((m) => ({
      nin: String(m.national_id),
      nameAr: String(m.name_ar),
      hintAr: String(m.hint_ar ?? ''),
      kind: m.kind === 'cast' ? 'cast' : 'cohort',
    }))
  } catch {
    return CAST.filter((c) => c.nin.startsWith(prefix)).slice(0, limit)
      .map((c) => ({ nin: c.nin, nameAr: c.nameAr, hintAr: c.hintAr, kind: 'cast' as const }))
  }
}

const SLUG_TO_KEY = {
  'credit-bureau': 'credit',
  employment: 'employment',
  'bank-core': 'bank',
  'open-banking': 'openbanking',
  wallet: 'wallet',
} as const
type SlugKey = typeof SLUG_TO_KEY
export type DecisionSlug = keyof SlugKey
const LOCAL_MS: Record<DecisionSlug, number> = {
  'credit-bureau': 340, employment: 300, 'bank-core': 420, 'open-banking': 650, wallet: 380,
}

export async function fetchDecisionSource<S extends DecisionSlug>(
  nin: string, slug: S,
): Promise<Got<RawSet[SlugKey[S]]>> {
  try {
    const env = await sbx(`/${slug}/${nin}`)
    return { data: env.data as RawSet[SlugKey[S]], transport: 'sandbox' }
  } catch (e) {
    const p = NIN_TO_PERSONA[nin]
    if (!p) throw e
    await wait(LOCAL_MS[slug])
    return { data: RAW_SETS[p][SLUG_TO_KEY[slug]] as RawSet[SlugKey[S]], transport: 'local' }
  }
}

export interface Household { marital: string; dependents: number }
export interface Investments { count: number; total: number }
export interface Assets { count: number; total: number; kinds: string[] }

const MARITAL = ['أعزب', 'متزوج', 'متزوج', 'مطلّق'] // offline approximation of the server's weights

function localRoadmap(nin: string): { household: Household; investments: Investments; assets: Assets } {
  const rng = mulberry32(seedOf(`roadmap-${nin}`))
  const marital = MARITAL[Math.floor(rng() * MARITAL.length)]
  const dependents = marital === 'متزوج' ? Math.floor(rng() * 5) : 0
  const hasInv = rng() < 0.3
  const hasProp = rng() < 0.22
  return {
    household: { marital, dependents },
    investments: hasInv
      ? { count: 1 + Math.floor(rng() * 3), total: Math.round((20_000 + rng() * 160_000) / 1000) * 1000 }
      : { count: 0, total: 0 },
    assets: hasProp
      ? { count: 1, total: Math.round((350_000 + rng() * 900_000) / 10_000) * 10_000, kinds: ['شقة سكنية'] }
      : { count: 0, total: 0, kinds: [] },
  }
}

export async function fetchHousehold(nin: string): Promise<Got<Household>> {
  try {
    const env = await sbx(`/household/${nin}`)
    const rec = env.data.record
    return {
      data: { marital: String(rec.marital_status), dependents: Number(rec.dependents_count) },
      transport: 'sandbox',
    }
  } catch {
    await wait(280)
    return { data: localRoadmap(nin).household, transport: 'local' }
  }
}

export async function fetchInvestments(nin: string): Promise<Got<Investments>> {
  try {
    const env = await sbx(`/investments/${nin}`)
    const p = env.data.portfolio
    return {
      data: { count: (p.holdings ?? []).length, total: Number(p.total_market_value ?? 0) },
      transport: 'sandbox',
    }
  } catch {
    await wait(360)
    return { data: localRoadmap(nin).investments, transport: 'local' }
  }
}

export async function fetchAssets(nin: string): Promise<Got<Assets>> {
  try {
    const env = await sbx(`/assets/${nin}`)
    const r = env.data.registry
    const props: { type: string }[] = r.properties ?? []
    return {
      data: { count: props.length, total: Number(r.total_estimated_value ?? 0), kinds: props.map((p) => p.type) },
      transport: 'sandbox',
    }
  } catch {
    await wait(430)
    return { data: localRoadmap(nin).assets, transport: 'local' }
  }
}

export async function randomCohortMember(): Promise<{ nin: string; nameAr: string }> {
  const env = await sbx('/cohort/sample')
  return { nin: String(env.national_id), nameAr: String(env.name_ar) }
}

// ── Nafath (محاكاة) — stage 2's identity verification ────────────────────────

export interface NafathSession { requestId: string; number: number; nameAr: string; transport: Transport }

export async function nafathInit(nin: string): Promise<NafathSession> {
  try {
    const env = await sbx(`/nafath/init/${nin}`)
    return {
      requestId: String(env.request_id),
      number: Number(env.number),
      nameAr: String(env.name_ar),
      transport: 'sandbox',
    }
  } catch (e) {
    if (ninUnknown404(e)) throw new Error('unknown-nin')
    const p = NIN_TO_PERSONA[nin]
    if (!p) throw new Error('offline-cohort')
    await wait(320)
    const rng = mulberry32(seedOf(`nafath-${nin}-${Date.now() >> 12}`))
    return {
      requestId: `nfz_local_${Math.floor(rng() * 1e8).toString(16)}`,
      number: 10 + Math.floor(rng() * 90),
      nameAr: String(RAW_SETS[p].employment.record.full_name),
      transport: 'local',
    }
  }
}

export async function nafathVerify(nin: string, s: NafathSession, chosen: number): Promise<boolean> {
  if (s.transport === 'sandbox') {
    try {
      const env = await sbx(`/nafath/verify/${nin}?request_id=${encodeURIComponent(s.requestId)}&chosen=${chosen}`)
      return Boolean(env.verified)
    } catch { /* network died mid-session — fall through to the local compare */ }
  }
  await wait(520)
  return chosen === s.number
}

// ── stage 4 — the unified financial file ─────────────────────────────────────

export interface JourneyData {
  nin: string
  identity: Identity
  raw: RawSet
  profile: Profile
  decision: DecisionResult
  household: Household
  investments: Investments
  assets: Assets
  transport: Transport
  txCount: number
}

export function assembleJourney(
  nin: string,
  identity: Got<Identity>,
  credit: Got<RawSet['credit']>,
  employment: Got<RawSet['employment']>,
  bank: Got<RawSet['bank']>,
  openbanking: Got<RawSet['openbanking']>,
  wallet: Got<RawSet['wallet']>,
  household: Got<Household>,
  investments: Got<Investments>,
  assets: Got<Assets>,
): JourneyData {
  const raw: RawSet = {
    bank: bank.data, openbanking: openbanking.data, wallet: wallet.data,
    employment: employment.data, credit: credit.data,
  }
  const profile = deriveProfile(raw, identity.data.nameEn)
  const everything = [identity, credit, employment, bank, openbanking, wallet, household, investments, assets]
  return {
    nin,
    identity: identity.data,
    raw,
    profile,
    decision: decide(profile),
    household: household.data,
    investments: investments.data,
    assets: assets.data,
    transport: everything.every((g) => g.transport === 'sandbox') ? 'sandbox' : 'local',
    txCount: bank.data.transactions.length + openbanking.data.transactions.length + wallet.data.transactions.length,
  }
}

// ── the Tabaqa indicator set (stage 4's مؤشرات) ──────────────────────────────

export interface TabaqaScore { score: number; risk: 'low' | 'medium' | 'high' }

/** Deterministic, explainable score proxy over the derived profile — the same
 *  inputs the dashboard scorecard reads, folded to one 1–99 number client-side. */
export function tabaqaScore(p: Profile): TabaqaScore {
  const base: Record<string, number> = { A: 74, B: 67, C: 59, D: 50, E: 32 }
  let s = base[p.grade] ?? 58
  s += p.stability === 'مستقر' ? 3 : p.stability === 'غير مستقر' ? -6 : 0
  s += p.salaryMatchesEmployment ? 2 : -6
  const inc = eligibleIncomeOf(p)
  const load = inc > 0 ? p.obligations / inc : 1
  s += load < 0.15 ? 3 : load < 0.3 ? 1 : -5
  if (p.seriousDelinquency) s = Math.min(s, 30)
  s = Math.max(20, Math.min(95, Math.round(s)))
  return { score: s, risk: p.seriousDelinquency ? 'high' : s >= 72 ? 'low' : s >= 55 ? 'medium' : 'high' }
}

export function journeyOfferInputs(d: JourneyData): OfferInputs {
  const t = tabaqaScore(d.profile)
  return {
    income: Math.round(eligibleIncomeOf(d.profile)),
    obligations: d.profile.obligations,
    score: t.score,
    riskFlag: t.risk,
    recourseProjected: null,
  }
}

export function journeyOffers(d: JourneyData, product: ProductType, amount: number | null, tenor: number): OffersResult {
  return computeOffers(journeyOfferInputs(d), { product, amount, tenor })
}

/** Sara's empty-state helper: the monthly obligation cut that reopens the market. */
export function unlockHint(p: Profile): string | null {
  const room = SAMA_CAP_EMPLOYEE * eligibleIncomeOf(p) - p.obligations
  if (room > 0) return null
  const cut = Math.ceil(-room / 50) * 50
  return `سداد أو إعادة جدولة نحو ${fmt(cut)} ر.س من التزاماتك الشهرية يعيد فتح عروض متوافقة لك.`
}

// ── stages 6–7 — sorting + the hidden non-compliant list ─────────────────────

/** Illustrative per-lender issuance speed (days) — sandbox metadata, not policy. */
export const ISSUANCE_DAYS: Record<string, number> = { waha: 3, sidra: 2, mada: 0, nakhla: 1, yusr: 1 }

export type SortKey = 'best' | 'amount' | 'rate' | 'tenor' | 'speed'
export const SORTS: { k: SortKey; label: string }[] = [
  { k: 'best', label: 'الأنسب' },
  { k: 'amount', label: 'أعلى مبلغ' },
  { k: 'rate', label: 'أقل نسبة' },
  { k: 'tenor', label: 'أطول مدة' },
  { k: 'speed', label: 'الأسرع إصدارًا' },
]

export function sortOffers(offers: Offer[], k: SortKey): Offer[] {
  const c = [...offers]
  switch (k) {
    case 'amount': return c.sort((a, b) => b.amount - a.amount || a.totalCost - b.totalCost)
    case 'rate': return c.sort((a, b) => a.annualRate - b.annualRate || a.totalCost - b.totalCost)
    case 'tenor': return c.sort((a, b) => b.tenor - a.tenor || a.totalCost - b.totalCost)
    case 'speed': return c.sort((a, b) =>
      (ISSUANCE_DAYS[a.lender.id] ?? 9) - (ISSUANCE_DAYS[b.lender.id] ?? 9) || a.totalCost - b.totalCost)
    default: return c // computeOffers already ranks: full offers by total cost, then counters
  }
}

export function lockReasonAr(l: LockedOffer): string {
  switch (l.reason.kind) {
    case 'score': return `تشترط الجهة درجة ${l.reason.minScore}+ — ينقصك ${l.reason.gap} نقطة`
    case 'risk': return 'نطاق المخاطر في ملفك خارج سياسة الجهة'
    case 'dbr': return `القسط المطلوب يتجاوز المتاح — أقصى تمويل لدى الجهة ${fmt(l.reason.maxFinancing)} ر.س`
    case 'amount_range': return `المبلغ خارج نطاق الجهة (${fmt(l.reason.min)}–${fmt(l.reason.max)} ر.س)`
    case 'income': return 'تعذّر احتساب دخل معتمد من المصادر الموثّقة'
  }
}

// ── stage 9 — the lender's OWN final verification ────────────────────────────
// The lender re-runs its internal checks on (a) Tabaqa's analysis results and
// (b) the data it is already entitled to (its accounts, the bureau, employment
// verification). It never receives the raw fused file — which is exactly why
// its verdict can occasionally differ from Tabaqa's (spec stage 9).

export interface CheckStep { t: string; d?: string; ok: boolean }
export interface FinalVerdict { approved: boolean; reasonAr: string; steps: CheckStep[] }

function salaryMonthsAtBankCore(raw: RawSet): number {
  const months = new Set<string>()
  for (const t of raw.bank.transactions) {
    if (t.type === 'credit' && t.category === 'راتب') months.add(t.date.slice(0, 7))
  }
  return months.size
}

export function lenderFinalCheck(lender: LenderPolicy, d: JourneyData, offer: Offer): FinalVerdict {
  const p = d.profile
  const t = tabaqaScore(p)
  const steps: CheckStep[] = []
  let reasonAr = ''

  steps.push({
    t: 'استلام نتائج تحليل طبقة',
    d: `درجة ${t.score}/99 · دخل معتمد ${fmt(eligibleIncomeOf(p))} ر.س · التزامات ${fmt(p.obligations)} ر.س`,
    ok: true,
  })

  const noDelinq = !p.seriousDelinquency
  steps.push({
    t: 'الاستعلام الائتماني لدى الجهة',
    d: noDelinq ? `درجة ${p.grade} · لا تعثرات مسجَّلة` : 'تعثّر جوهري مسجَّل',
    ok: noDelinq,
  })
  if (!noDelinq && !reasonAr) reasonAr = 'الاستعلام الائتماني لدى الجهة أظهر تعثرًا مسجَّلًا.'

  const reconciled = p.salaryMatchesEmployment
  steps.push({
    t: 'مطابقة الدخل مع جهة التوظيف',
    d: reconciled
      ? `راتب موثّق ${fmt(p.verifiedSalary)} ر.س — مطابق`
      : 'الراتب المعلن لا يطابق الحركات — يتطلب مراجعة يدوية لدى الجهة',
    ok: reconciled,
  })
  if (!reconciled && !reasonAr) reasonAr = 'لم تتمكن الجهة من مطابقة الدخل المعلن — أُحيل الطلب للمراجعة اليدوية لديها ولم يُقبل تلقائيًا.'

  // the lender-specific internal policy — the honest source of Tabaqa-vs-bank divergence
  let quirkOk = true
  let quirkD = 'لا اشتراطات إضافية'
  if (lender.id === 'mada') {
    const m = salaryMonthsAtBankCore(d.raw)
    quirkOk = m >= 3
    quirkD = quirkOk
      ? `ورود الراتب ${m} أشهر في الحساب الأساسي — مستوفى`
      : `تشترط الجهة ورود الراتب ٣ أشهر على الأقل في حسابك الأساسي — الظاهر ${m === 2 ? 'شهران' : m === 1 ? 'شهر واحد' : m} فقط`
    if (!quirkOk && !reasonAr) {
      reasonAr = 'سياسة الجهة الداخلية تشترط ورود الراتب في حسابك الأساسي ثلاثة أشهر على الأقل — راتبك انتقل حديثًا، فاعتذرت الجهة رغم توافق ملفك لدى طبقة. اختر عرض جهة أخرى.'
    }
  } else if (lender.id === 'waha') {
    quirkOk = ['A', 'B'].includes(p.grade) && p.serviceYears >= 2
    quirkD = quirkOk
      ? `درجة ${p.grade} وخدمة ${p.serviceYears} سنوات — مستوفى`
      : 'تشترط الجهة درجة ائتمانية A/B وخدمة سنتين فأكثر'
    if (!quirkOk && !reasonAr) reasonAr = 'لم يستوفِ الملف اشتراطات الجهة الداخلية (الدرجة الائتمانية أو مدة الخدمة).'
  }
  steps.push({ t: 'سياسة الجهة الداخلية', d: quirkD, ok: quirkOk })

  const dbrOk = offer.dbrAfter <= offer.dbrCap + 1e-9
  steps.push({
    t: 'حد الاستقطاع النظامي',
    d: `${(offer.dbrAfter * 100).toFixed(1)}٪ من حد ${(offer.dbrCap * 100).toFixed(1)}٪`,
    ok: dbrOk,
  })
  if (!dbrOk && !reasonAr) reasonAr = 'القسط يتجاوز حد الاستقطاع النظامي وفق احتساب الجهة.'

  const approved = steps.every((s) => s.ok)
  return {
    approved,
    reasonAr: approved
      ? 'قرار الجهة النهائي مطابق لنتيجة طبقة — تمت الموافقة.'
      : reasonAr,
    steps,
  }
}

// ── stage 10 — receipt number + the lender's downloadable Tabaqa report ──────

export function tabaqaAppNo(nin: string, lenderId: string): string {
  return `TBQ-${String(seedOf(`${nin}:${lenderId}`) % 1_000_000).padStart(6, '0')}`
}

// The API's ingest parses real calendar dates; the client engine only ever
// slices months — so a stray "2026-02-29" in a canonical file works everywhere
// client-side but 422s the scorer. Clamp impossible days to the month's end.
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
function safeDate(iso: string): string {
  const [y, m, dd] = iso.split('-').map(Number)
  if (!y || !m || !dd) return iso
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const max = m === 2 && leap ? 29 : MONTH_DAYS[m - 1] ?? 31
  return dd > max ? `${iso.slice(0, 8)}${String(max).padStart(2, '0')}` : iso
}

/** The applicant's fused statement, encoded for the desk (orders' report_d) —
 *  what makes the lender-side report THIS person's report, re-scored live. */
export function reportD(d: JourneyData): string {
  // Synthetic employer IBAN, stamped on salary credits AND handed to the engine
  // as context.salary_iban — the match is what lets Masdr payslip verification
  // stamp the salary VERIFY_AMOUNT (the raw persona rows carry no counterparty).
  const salaryIban = `SA57TBQ0${d.nin}`
  const rows: StatementRowInput[] = []
  const add = (source: string, tx: RawTx[]) => {
    for (const t of tx) {
      rows.push({
        date: safeDate(t.date),
        description: t.description,
        amount: t.type === 'credit' ? t.amount : -t.amount,
        source,
        ...(t.type === 'credit' && t.category === 'راتب' ? { counterparty_iban: salaryIban } : {}),
      })
    }
  }
  // the scoring engine's source taxonomy: 'bank' | 'wallet' | 'bank:<name>'/'wallet:<name>'
  add('bank', d.raw.bank.transactions)
  add('bank:المصرفية المفتوحة', d.raw.openbanking.transactions)
  add('wallet', d.raw.wallet.transactions)
  // The raw persona files carry no balance column; a zero opening would rebuild
  // the running balance into overdrafts the applicant never had (the raw data
  // has no NSF events). Per source: the smallest opening that keeps the account
  // non-negative, plus a modest buffer.
  const opening: Record<string, number> = {}
  const bySource = new Map<string, StatementRowInput[]>()
  for (const r of rows) {
    const g = bySource.get(r.source) ?? []
    g.push(r)
    bySource.set(r.source, g)
  }
  for (const [source, g] of bySource) {
    let run = 0
    let min = 0
    for (const r of [...g].sort((a, b) => a.date.localeCompare(b.date))) {
      run += r.amount ?? 0
      if (run < min) min = run
    }
    opening[source] = Math.max(0, -min) + 1_500
  }
  const si: StatementInput = {
    name: d.identity.nameAr,
    rows,
    context: {
      amount_convention: 'signed',
      opening_balances: opening,
      employer: String(d.raw.employment.record.employer_name ?? ''),
      salary_iban: salaryIban,
      monthly_wage: Number(d.raw.employment.record.verified_monthly_salary ?? 0) || undefined,
    },
  }
  return encodeStatement(si)
}

/** The verifiable Tabaqa report (/report — the Watheeq-style attestation). */
export function lenderReportUrl(d: JourneyData): string {
  return `/report?d=${reportD(d)}`
}

// ── stage 8 — hand the order to the Tabaqa dashboard (the lender's desk) ─────
// The order goes through lib/ordersDesk: INSERT into the shared Supabase desk
// (Realtime pushes it onto the dashboard the same second) with the sandbox
// API's in-memory desk as mirror + offline fallback. The id is generated HERE
// so both desks agree on it before anything is sent.

export interface OrderReceipt { ok: boolean; orderId: string | null }

export async function submitOrder(d: JourneyData, offer: Offer, productAr: string): Promise<OrderReceipt> {
  const t = tabaqaScore(d.profile)
  const res = await createDeskOrder({
    id: newOrderId(),
    national_id: d.nin,
    applicant_ar: d.identity.nameAr,
    lender_id: offer.lender.id,
    lender_ar: offer.lender.nameAr,
    product_ar: productAr,
    amount: offer.amount,
    tenor_months: offer.tenor,
    installment: offer.installment,
    apr: offer.annualRate,
    total: offer.totalCost,
    score: t.score,
    risk: t.risk,
    eligible_income: Math.round(eligibleIncomeOf(d.profile)),
    obligations: d.profile.obligations,
    report_d: reportD(d),
  })
  return { ok: res.ok, orderId: res.orderId }
}

// ── stage 10, closed loop — the app tracks its order until the desk answers ──
// The applicant's side of "accept within 24 hours": the app remembers the last
// submitted order PER IDENTITY (localStorage — the tracking card must survive
// an app relaunch), shows it as the "طلب التمويل الحالي" card on the home
// screen, and watches it (Supabase Realtime + poll). Every change of state —
// قبول, رفض, or a tenor extension by the bank worker — raises a notice once:
// the last-notified signature (status:tenor) is stored alongside the order.

export interface TrackedOrder {
  id: string
  nin: string
  lenderAr: string
  productAr: string
  amount: number
  tenor: number
  installment: number
  at: number
  sig: string // last signature the user was notified about, e.g. "pending:48"
}

const TRACK_PREFIX = 'tabaqa.tapp.order.v2:'

export function trackOrder(t: Omit<TrackedOrder, 'at' | 'sig'>): void {
  const rec: TrackedOrder = { ...t, at: Date.now(), sig: `pending:${t.tenor}` }
  try { localStorage.setItem(TRACK_PREFIX + t.nin, JSON.stringify(rec)) } catch { /* private mode */ }
}

export function loadTrackedOrder(nin: string): TrackedOrder | null {
  try {
    const raw = localStorage.getItem(TRACK_PREFIX + nin)
    if (!raw) return null
    const t = JSON.parse(raw) as TrackedOrder
    return t?.id ? t : null
  } catch {
    return null
  }
}

/** Persist the signature the user has now been notified about. */
export function rememberOrderSig(nin: string, sig: string): TrackedOrder | null {
  const t = loadTrackedOrder(nin)
  if (!t) return null
  const upd = { ...t, sig }
  try { localStorage.setItem(TRACK_PREFIX + nin, JSON.stringify(upd)) } catch { /* ignore */ }
  return upd
}

/** The live truth about a submitted order, wherever the desk lives right now. */
export interface OrderState {
  status: OrderStatus
  lenderAr: string
  amount: number
  tenor: number
  installment: number
  originalTenor: number | null
  events: OrderEvent[]
}

export const orderSig = (s: OrderState): string => `${s.status}:${s.tenor}`

export async function fetchOrderState(orderId: string): Promise<OrderState | null> {
  const got = await getDeskOrder(orderId)
  if (!got) return null // desk unreachable — keep waiting quietly
  const o = got.order
  return {
    status: o.status,
    lenderAr: o.lender_ar,
    amount: o.amount,
    tenor: o.tenor_months,
    installment: o.installment,
    originalTenor: o.original_tenor_months,
    events: o.events,
  }
}

export const ORDER_STATUS_AR: Record<OrderStatus, string> = {
  pending: 'قيد مراجعة الجهة التمويلية',
  accepted: 'تمت الموافقة ✓',
  declined: 'اعتذرت الجهة',
  expired: 'انتهت مهلة الاعتماد',
}
