// Demo financing math for the in-bank تمويل journey (PRODUCT_SPEC §8, §11, §21).
// Every figure shown on screen is COMPUTED here from Ahmed's profile via the SAMA
// employee cap + a standard annuity — nothing is hardcoded as a "result".
// Demo formula, isolated so a bank's official calculation can replace it (spec §8).

import { PROFILE, eligibleIncomeOf, installmentRoomOf } from './derive'

// Spec §21 — Ahmed Al-Qahtani, DERIVED from the raw connector datasets
// (web/src/data/ahmed/*.json) by the Financial Intelligence layer (derive.ts):
// the verified 18,000 salary is cross-checked employment-vs-transactions, the
// 2,000 stable side income (counted at 50%) comes from recurring wallet streams,
// and bankVisibleIncome is what THIS bank's account alone can see (his salary
// moved here only 2 months ago — the thin-file picture the fusion fixes).
export const AHMED = PROFILE

// One bank, one product, three configurations (spec §11 — this is NOT a marketplace).
export const PRODUCT = {
  nameAr: 'تمويل المركبات',
  minAmount: 20_000,
  maxAmount: 500_000,
  adminFee: 1_500,
  terms: [
    { months: 60, apr: 0.062 },
    { months: 48, apr: 0.059, recommended: true },
    { months: 36, apr: 0.056 },
  ] as { months: number; apr: number; recommended?: boolean }[],
}

// The cap arithmetic itself lives in derive.ts (eligibleIncomeOf/installmentRoomOf)
// so the offers screen and the §10 decision engine can never drift apart — these
// two are Ahmed-bound conveniences over the same functions.
export function eligibleIncome(fused: boolean): number {
  return eligibleIncomeOf(AHMED, fused)
}

/** Monthly installment room under the SAMA employee cap (spec §8). */
export function installmentRoom(fused: boolean): number {
  return Math.max(0, installmentRoomOf(AHMED, fused))
}

function annuityFactor(apr: number, months: number): number {
  const r = apr / 12
  const g = Math.pow(1 + r, months)
  return (g - 1) / (r * g)
}

/** Max financing = installment room stretched over the friendliest available term. */
export function maxFinancing(fused: boolean): number {
  const room = installmentRoom(fused)
  return Math.max(...PRODUCT.terms.map((t) => room * annuityFactor(t.apr, t.months)))
}

export function installmentFor(amount: number, apr: number, months: number): number {
  const r = apr / 12
  const g = Math.pow(1 + r, months)
  return (amount * (r * g)) / (g - 1)
}

export interface BankOffer {
  months: number
  apr: number
  installment: number
  total: number
  adminFee: number
  recommended: boolean
  /** false when this term's installment exceeds Ahmed's SAMA room — shown locked. */
  available: boolean
}

/** The three same-bank configurations for a given amount, rule-checked honestly. */
export function offersFor(amount: number, fused = true): BankOffer[] {
  const room = installmentRoom(fused)
  return PRODUCT.terms.map((t) => {
    const installment = installmentFor(amount, t.apr, t.months)
    return {
      months: t.months,
      apr: t.apr,
      installment,
      total: installment * t.months + PRODUCT.adminFee,
      adminFee: PRODUCT.adminFee,
      recommended: Boolean(t.recommended),
      available: installment <= room,
    }
  })
}

export interface ScheduleRow {
  n: number
  pay: number
  principal: number
  profit: number
  balance: number
}

export function schedule(amount: number, apr: number, months: number): ScheduleRow[] {
  const r = apr / 12
  const pay = installmentFor(amount, apr, months)
  let balance = amount
  const rows: ScheduleRow[] = []
  for (let n = 1; n <= months; n++) {
    const profit = balance * r
    const principal = pay - profit
    balance = Math.max(0, balance - principal)
    rows.push({ n, pay, principal, profit, balance })
  }
  return rows
}

export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US')
export const pct = (x: number): string => `${(x * 100).toFixed(1)}%`
