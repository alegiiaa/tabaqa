// Financial Intelligence Engine (PRODUCT_SPEC §7) + Automated Decision Engine (§10)
// — derives an applicant's normalized profile FROM the raw connector payloads and
// then rules on it. Every number the offers screen shows traces back through here
// to actual transactions in web/src/data/<persona>/*.json:
//   income detection → salary cross-checked vs the employment source,
//   internal-transfer dedup, recurring side-income vs irregular transfers,
//   expense categorization → essentials, obligation cross-check vs the bureau.
// The counting percentages are BANK CONFIG (spec §7: "configurable by the bank").
//
// Nothing here is persona-specific: the same functions run over any RawSet, which
// is why the three demo outcomes (Ahmed approved / Sara declined / Khalid review)
// are COMPUTED verdicts, not labels attached to three fixtures.

import { SAMA_CAP_EMPLOYEE } from '../../lib/lenders'
import { ahmedRaw, RawSet, RawTx } from './raw'

export const BANK_CONFIG = {
  salaryCountPct: 1.0, // 100% of verified salary
  stableSideIncomePct: 0.5, // 50% of stable side income
  irregularIncomePct: 0.0, // 0% of irregular transfers
  recurringMinMonths: 5, // stream must appear ≥5 of 6 months to count as stable
  salaryTolerancePct: 0.1, // employment-vs-transactions match tolerance
  minEligibleIncome: 4_000, // bank policy floor (spec §10: "income below the required minimum")
}

const MONTHS = 6
const month = (t: RawTx) => t.date.slice(0, 7)
const avg = (total: number) => Math.round(total / MONTHS)

/** Group credits by stream (description), keep streams present in ≥ N distinct months. */
function recurringMonthly(tx: RawTx[], category: string): number {
  const streams = new Map<string, Map<string, number>>()
  for (const t of tx) {
    if (t.type !== 'credit' || t.category !== category) continue
    const s = streams.get(t.description) ?? new Map()
    s.set(month(t), (s.get(month(t)) ?? 0) + t.amount)
    streams.set(t.description, s)
  }
  let total = 0
  for (const s of streams.values()) {
    if (s.size >= BANK_CONFIG.recurringMinMonths) {
      total += [...s.values()].reduce((a, b) => a + b, 0)
    }
  }
  return avg(total)
}

// ── Income detection (§7) ────────────────────────────────────────────────────

/** Bank-only view: naive average of ALL inflows at this bank — the thin picture. */
export function bankVisibleIncome(raw: RawSet): number {
  const credits = raw.bank.transactions.filter((t) => t.type === 'credit')
  return avg(credits.reduce((s, t) => s + t.amount, 0))
}

/**
 * Fused salary: salary-tagged credits across bank + open banking (internal
 * transfers excluded), verified against the employment source. Returns the
 * employment figure only when transactions confirm it month-by-month — otherwise
 * the engine falls back to what it can actually SEE and flags the mismatch.
 */
export function verifiedSalary(raw: RawSet): { amount: number; monthsSeen: number; matchesEmployment: boolean } {
  const all = [...raw.bank.transactions, ...raw.openbanking.transactions]
  const byMonth = new Map<string, number>()
  for (const t of all) {
    if (t.type === 'credit' && t.category === 'راتب' && !t.internal_transfer) {
      byMonth.set(month(t), (byMonth.get(month(t)) ?? 0) + t.amount)
    }
  }
  const monthsSeen = byMonth.size
  const mean = [...byMonth.values()].reduce((a, b) => a + b, 0) / Math.max(1, monthsSeen)
  const claimed = Number(raw.employment.record.verified_monthly_salary)
  const matchesEmployment =
    monthsSeen >= BANK_CONFIG.recurringMinMonths &&
    Math.abs(mean - claimed) / claimed <= BANK_CONFIG.salaryTolerancePct
  return { amount: matchesEmployment ? claimed : Math.round(mean), monthsSeen, matchesEmployment }
}

/** Stable wallet side income (recurring streams) vs irregular transfers. */
export function sideIncome(raw: RawSet): { stable: number; irregular: number } {
  const tx = raw.wallet.transactions
  return {
    stable: recurringMonthly(tx, 'دخل جانبي'),
    irregular: avg(tx.filter((t) => t.category === 'تحويلات غير منتظمة').reduce((s, t) => s + t.amount, 0)),
  }
}

// ── Expense analysis (§7) ────────────────────────────────────────────────────

const ESSENTIAL_CATEGORIES = new Set(['سكن', 'خدمات', 'اتصالات', 'تأمين', 'تعليم', 'اشتراكات', 'غذاء', 'مواصلات'])

export function essentialExpenses(raw: RawSet): number {
  const debits = raw.bank.transactions.filter((t) => t.type === 'debit' && ESSENTIAL_CATEGORIES.has(t.category))
  return avg(debits.reduce((s, t) => s + t.amount, 0))
}

// ── Obligation detection (§7) — bureau lines cross-checked vs actual debits ──

export interface ObligationCheck {
  type: string
  monthly: number
  /** true when a matching recurring debit was found in the consented accounts */
  seenInTransactions: boolean
}

export function obligations(raw: RawSet): { total: number; lines: ObligationCheck[] } {
  const debits = [...raw.bank.transactions, ...raw.wallet.transactions].filter(
    (t) => t.type === 'debit' && (t.category === 'التزام تمويلي' || t.category === 'سداد بطاقة'),
  )
  const lines = raw.credit.report.obligations.map((o) => ({
    type: o.type,
    monthly: o.monthly_payment,
    seenInTransactions: debits.some((t) => Math.abs(t.amount - o.monthly_payment) / o.monthly_payment <= 0.1),
  }))
  return { total: raw.credit.report.total_monthly_obligations, lines }
}

// ── Income stability (§7, rule-based) ────────────────────────────────────────

export type Stability = 'مستقر' | 'مستقر نسبيًا' | 'غير مستقر'

export function incomeStability(raw: RawSet): Stability {
  const salary = verifiedSalary(raw)
  const serviceOk = Number(raw.employment.record.service_years) * 12 >= 12
  if (serviceOk && salary.monthsSeen >= MONTHS && salary.matchesEmployment) return 'مستقر'
  if (salary.monthsSeen >= 3) return 'مستقر نسبيًا'
  return 'غير مستقر'
}

// ── The normalized profile (§6) — consumed by financeMath.ts ─────────────────

export interface Profile {
  name: string
  nameEn: string
  sector: string
  serviceYears: number
  verifiedSalary: number
  sideIncome: number
  sideIncomeHaircut: number
  irregularIncome: number
  bankVisibleIncome: number
  obligations: number
  essentials: number
  grade: string
  stability: Stability
  /** true when the employment source's salary claim is confirmed by transactions */
  salaryMatchesEmployment: boolean
  /** distinct months carrying a salary-tagged credit across bank + open banking */
  salaryMonthsSeen: number
  /** what the employment source CLAIMS — kept next to what we derived, never blended */
  claimedSalary: number
  seriousDelinquency: boolean
}

/** Run the whole Financial Intelligence layer over one applicant's raw sources. */
export function deriveProfile(raw: RawSet, nameEn: string): Profile {
  const salary = verifiedSalary(raw)
  const side = sideIncome(raw)
  return {
    name: String(raw.employment.record.full_name),
    nameEn,
    sector: String(raw.employment.record.employment_sector),
    serviceYears: Number(raw.employment.record.service_years),
    verifiedSalary: salary.amount,
    sideIncome: side.stable,
    sideIncomeHaircut: BANK_CONFIG.stableSideIncomePct,
    irregularIncome: side.irregular,
    bankVisibleIncome: bankVisibleIncome(raw),
    obligations: obligations(raw).total,
    essentials: essentialExpenses(raw),
    grade: raw.credit.report.credit_grade,
    stability: incomeStability(raw),
    salaryMatchesEmployment: salary.matchesEmployment,
    salaryMonthsSeen: salary.monthsSeen,
    claimedSalary: Number(raw.employment.record.verified_monthly_salary),
    seriousDelinquency: raw.credit.report.serious_delinquency,
  }
}

// ── Affordability (§8) — the single source of the cap arithmetic ─────────────

/**
 * Eligible income under the bank's counting policy: 100% of verified salary +
 * 50% of stable side income + 0% of irregular transfers (spec §7).
 * `fused = false` is the bank-only view — what this bank's own account can see.
 */
export function eligibleIncomeOf(p: Profile, fused = true): number {
  if (!fused) return p.bankVisibleIncome
  return p.verifiedSalary * BANK_CONFIG.salaryCountPct + p.sideIncome * p.sideIncomeHaircut
}

/**
 * Monthly installment room under the SAMA employee cap (spec §8), UNCLAMPED —
 * a negative result is the decline signal itself (§10: obligations exceed the
 * allowed limit), so callers that render a room must clamp at 0 themselves.
 */
export function installmentRoomOf(p: Profile, fused = true): number {
  return eligibleIncomeOf(p, fused) * SAMA_CAP_EMPLOYEE - p.obligations
}

// ── Automated Decision Engine (§10) ──────────────────────────────────────────

export type Decision = 'approved' | 'declined' | 'review'

export interface DecisionResult {
  decision: Decision
  /** the customer-facing explanation — understandable, never internal risk logic (§10) */
  reasonAr: string
  reasonEn: string
}

/**
 * The three outcomes of spec §10, decided in policy order:
 *   1. mandatory decline (serious delinquency) — outranks everything;
 *   2. review triggers — employment/transaction conflict, or highly irregular
 *      income. We refuse to auto-decide on data we cannot reconcile;
 *   3. affordability declines — income below the floor, or obligations that
 *      leave no room under the regulatory cap;
 *   4. otherwise: automatically approved.
 * Review is checked BEFORE affordability on purpose: an unreconciled income
 * figure must not be used to auto-decline someone.
 */
export function decide(p: Profile): DecisionResult {
  if (p.seriousDelinquency) {
    return {
      decision: 'declined',
      reasonAr: 'لا يمكن الموافقة حاليًا بسبب وجود تعثّر جوهري في سجلك الائتماني.',
      reasonEn: 'You are currently not eligible because your credit record shows a serious delinquency.',
    }
  }
  if (!p.salaryMatchesEmployment) {
    return {
      decision: 'review',
      reasonAr: 'بيانات التوظيف لا تتطابق مع حركات الراتب في حساباتك — تمت إحالة طلبك للمراجعة اليدوية.',
      reasonEn: 'Employment information conflicts with salary transactions — your application was routed to manual review.',
    }
  }
  if (p.stability === 'غير مستقر') {
    return {
      decision: 'review',
      reasonAr: 'دخلك غير منتظم بدرجة تتطلب مراجعة يدوية — تمت إحالة طلبك لمختص.',
      reasonEn: 'Your income is highly irregular and requires manual review — your application was routed to a specialist.',
    }
  }
  if (eligibleIncomeOf(p) < BANK_CONFIG.minEligibleIncome) {
    return {
      decision: 'declined',
      reasonAr: 'لا يمكن الموافقة حاليًا لأن دخلك المعتمد أقل من الحد الأدنى المطلوب للمنتج.',
      reasonEn: 'You are currently not eligible because your eligible income is below the required minimum.',
    }
  }
  if (installmentRoomOf(p) <= 0) {
    return {
      decision: 'declined',
      reasonAr: 'لا يمكن الموافقة حاليًا لأن التزاماتك الشهرية القائمة تتجاوز الحد المعتمد لدى المصرف.',
      reasonEn: "You are currently not eligible because your existing monthly obligations exceed the bank's approved limit.",
    }
  }
  return {
    decision: 'approved',
    reasonAr: 'بياناتك مكتملة ودخلك موثّق والتزاماتك ضمن الحد النظامي — تمت الموافقة تلقائيًا.',
    reasonEn: 'Your data is complete, your income is verified and your obligations are within the regulatory limit — automatically approved.',
  }
}

/** Ahmed (spec §21) — the profile financeMath.ts serves the offers screen from. */
export const PROFILE = deriveProfile(ahmedRaw, 'Ahmed Al-Qahtani')
