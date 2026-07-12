// The marketplace's lender layer — demo lenders as PUBLISHED PRODUCT POLICIES.
//
// Each lender is a policy config (rate tiers, DBR cap, score floor, amount/tenor
// range), NOT a proprietary model: real lenders never hand over their underwriting
// formula, but they do publish product criteria — that is what an aggregator runs on.
// The math here mirrors affordability.py exactly (annuity → installment → DBR vs the
// SAMA cap) so an offer on screen is the same arithmetic the API serves; it runs
// client-side for instant search UX, like the checkIntegrity mirror in adapters.ts.
//
// All lenders are fictional and clearly labelled illustrative in the UI. The final
// credit decision always belongs to the licensed lender (shown on every offer).

import type { ScoreResult } from './api'

export type ProductType = 'auto' | 'personal' | 'goods'

export interface LenderPolicy {
  id: string
  nameEn: string
  nameAr: string
  kind: 'bank' | 'digital' | 'finance' | 'micro'
  kindEn: string
  kindAr: string
  color: string // brand accent for the card monogram
  products: ProductType[]
  minScore: number
  maxRisk: 'low' | 'medium' | 'high' // most permissive Tabaqa risk band accepted
  dbrCap: number // lender's internal installment cap — may be tighter than SAMA's
  minAmount: number
  maxAmount: number
  minTenor: number
  maxTenor: number
  baseRate: number // APR for low-risk applicants
  mediumSpread: number // added for medium risk (risk-based pricing, visible on screen)
  adminFeePct: number // ≤ 0.01 — SAMA caps the admin fee at min(1%, SAR 5,000)
}

// SAMA Responsible Lending Principles, Circular 46538/99 Ch. IV — the binding
// salary-deduction cap. Every lender policy is clamped to it.
export const SAMA_CAP_EMPLOYEE = 0.3333
export const SAMA_ADMIN_FEE_CEILING_SAR = 5_000
export const SAMA_ADMIN_FEE_CEILING_PCT = 0.01

export const LENDERS: LenderPolicy[] = [
  {
    id: 'waha', nameEn: 'Al Waha Bank', nameAr: 'مصرف الواحة',
    kind: 'bank', kindEn: 'Bank', kindAr: 'بنك', color: '#1d4ed8',
    products: ['auto', 'personal'],
    minScore: 72, maxRisk: 'low', dbrCap: 0.30,
    minAmount: 20_000, maxAmount: 500_000, minTenor: 12, maxTenor: 60,
    baseRate: 0.069, mediumSpread: 0.015, adminFeePct: 0.01,
  },
  {
    id: 'sidra', nameEn: 'Sidra Bank', nameAr: 'بنك السدرة',
    kind: 'bank', kindEn: 'Bank', kindAr: 'بنك', color: '#0e7490',
    products: ['auto', 'personal', 'goods'],
    minScore: 62, maxRisk: 'medium', dbrCap: 0.3333,
    minAmount: 10_000, maxAmount: 300_000, minTenor: 12, maxTenor: 60,
    baseRate: 0.084, mediumSpread: 0.015, adminFeePct: 0.01,
  },
  {
    id: 'mada', nameEn: 'Mada Digital Bank', nameAr: 'بنك المدى الرقمي',
    kind: 'digital', kindEn: 'Digital bank', kindAr: 'بنك رقمي', color: '#7c3aed',
    products: ['auto', 'personal', 'goods'],
    minScore: 55, maxRisk: 'medium', dbrCap: 0.3333,
    minAmount: 5_000, maxAmount: 150_000, minTenor: 6, maxTenor: 48,
    baseRate: 0.099, mediumSpread: 0.02, adminFeePct: 0.005,
  },
  {
    id: 'nakhla', nameEn: 'Nakhla Finance', nameAr: 'النخلة للتمويل',
    kind: 'finance', kindEn: 'Finance co.', kindAr: 'شركة تمويل', color: '#b45309',
    products: ['auto', 'personal', 'goods'],
    minScore: 45, maxRisk: 'medium', dbrCap: 0.3333,
    minAmount: 5_000, maxAmount: 100_000, minTenor: 6, maxTenor: 36,
    baseRate: 0.125, mediumSpread: 0.03, adminFeePct: 0.01,
  },
  {
    id: 'yusr', nameEn: 'Yusr Microfinance', nameAr: 'يُسر للتمويل الأصغر',
    kind: 'micro', kindEn: 'Microfinance', kindAr: 'تمويل أصغر', color: '#0f9d63',
    products: ['personal', 'goods'],
    minScore: 35, maxRisk: 'high', dbrCap: 0.3333,
    minAmount: 2_000, maxAmount: 30_000, minTenor: 6, maxTenor: 24,
    baseRate: 0.15, mediumSpread: 0.04, adminFeePct: 0.01,
  },
]

export interface OfferSearch {
  product: ProductType
  amount: number | null // null → "max I can get" mode
  tenor: number // requested months; clamped per lender
}

export interface Offer {
  lender: LenderPolicy
  amount: number
  reducedFrom: number | null // counter-offer: requested amount didn't fit, this did
  tenor: number
  annualRate: number
  installment: number
  adminFee: number
  totalCost: number // installment × tenor + admin fee
  dbrBefore: number
  dbrAfter: number
  dbrCap: number
  maxFinancing: number // at this lender's policy
  annuityFactor: number
  best: boolean
}

export type LockReason =
  | { kind: 'score'; minScore: number; gap: number; unlockedByRecourse: boolean }
  | { kind: 'risk' }
  | { kind: 'dbr'; maxFinancing: number }
  | { kind: 'amount_range'; min: number; max: number }
  | { kind: 'income' }

export interface LockedOffer {
  lender: LenderPolicy
  reason: LockReason
}

export interface OffersResult {
  offers: Offer[]
  locked: LockedOffer[]
  fullOfferCount: number // offers at the full requested amount (the headline number)
  bestMaxFinancing: number // the largest amount any lender extends
}

// Present-value annuity factor — identical to affordability.annuity_factor.
export function annuityFactor(annualRate: number, months: number): number {
  const n = Math.max(1, Math.round(months))
  const i = annualRate / 12
  if (i === 0) return n
  return (Math.pow(1 + i, n) - 1) / (i * Math.pow(1 + i, n))
}

const RISK_ORDER = { low: 0, medium: 1, high: 2 } as const

export interface OfferInputs {
  income: number // verified monthly income the offers run on
  obligations: number // existing monthly obligations (absolute SAR)
  score: number
  riskFlag: string
  recourseProjected: number | null // recourse projected_score, for unlock chips
}

/** Pull the offer inputs out of a scored profile. `bankOnly` swaps the income lens. */
export function offerInputs(r: ScoreResult, bankOnly = false): OfferInputs {
  const trueIncome = r.income.true_monthly_income
  return {
    income: bankOnly ? r.income.bank_only_income : trueIncome,
    // Obligations are real regardless of which income the lender can see.
    obligations: r.features ? Math.round(r.features.recurring_obligation_load * trueIncome) : 0,
    score: r.tabaqa_score,
    riskFlag: r.risk_flag,
    recourseProjected: r.recourse && !r.recourse.already_prime ? r.recourse.projected_score : null,
  }
}

export function computeOffers(inp: OfferInputs, search: OfferSearch): OffersResult {
  const offers: Offer[] = []
  const locked: LockedOffer[] = []

  for (const lender of LENDERS) {
    if (!lender.products.includes(search.product)) continue

    if (inp.income <= 0) {
      locked.push({ lender, reason: { kind: 'income' } })
      continue
    }
    if (inp.score < lender.minScore) {
      locked.push({
        lender,
        reason: {
          kind: 'score',
          minScore: lender.minScore,
          gap: lender.minScore - inp.score,
          unlockedByRecourse: inp.recourseProjected != null && inp.recourseProjected >= lender.minScore,
        },
      })
      continue
    }
    if (RISK_ORDER[inp.riskFlag as keyof typeof RISK_ORDER] > RISK_ORDER[lender.maxRisk]) {
      locked.push({ lender, reason: { kind: 'risk' } })
      continue
    }

    const cap = Math.min(lender.dbrCap, SAMA_CAP_EMPLOYEE)
    const rate = lender.baseRate + (inp.riskFlag === 'medium' ? lender.mediumSpread : 0)
    const tenor = Math.min(Math.max(search.tenor, lender.minTenor), lender.maxTenor)
    const af = annuityFactor(rate, tenor)

    const maxInstallment = cap * inp.income - inp.obligations
    const maxFinancing = Math.min(Math.max(0, maxInstallment) * af, lender.maxAmount)

    const requested = search.amount
    const amount = requested == null ? maxFinancing : Math.min(requested, maxFinancing, lender.maxAmount)
    if (amount < lender.minAmount) {
      if (requested != null && requested >= lender.minAmount && requested <= lender.maxAmount) {
        locked.push({ lender, reason: { kind: 'dbr', maxFinancing } })
      } else {
        locked.push({ lender, reason: { kind: 'amount_range', min: lender.minAmount, max: lender.maxAmount } })
      }
      continue
    }

    const installment = amount / af
    const adminFee = Math.min(
      amount * lender.adminFeePct,
      amount * SAMA_ADMIN_FEE_CEILING_PCT,
      SAMA_ADMIN_FEE_CEILING_SAR,
    )
    offers.push({
      lender,
      amount: Math.round(amount),
      reducedFrom: requested != null && amount < requested ? requested : null,
      tenor,
      annualRate: rate,
      installment: Math.round(installment),
      adminFee: Math.round(adminFee),
      totalCost: Math.round(installment * tenor + adminFee),
      dbrBefore: inp.obligations / inp.income,
      dbrAfter: (inp.obligations + installment) / inp.income,
      dbrCap: cap,
      maxFinancing: Math.round(maxFinancing),
      annuityFactor: af,
      best: false,
    })
  }

  // Rank: full-amount offers first by total cost (cheapest wins the green frame);
  // counter-offers after, largest amount first. In max mode, largest amount wins.
  offers.sort((a, b) => {
    const aFull = a.reducedFrom == null ? 0 : 1
    const bFull = b.reducedFrom == null ? 0 : 1
    if (search.amount == null) return b.amount - a.amount || a.totalCost - b.totalCost
    if (aFull !== bFull) return aFull - bFull
    return aFull === 0 ? a.totalCost - b.totalCost : b.amount - a.amount
  })
  if (offers.length > 0) offers[0].best = true

  return {
    offers,
    locked,
    fullOfferCount: offers.filter((o) => o.reducedFrom == null).length,
    bestMaxFinancing: offers.reduce((m, o) => Math.max(m, o.maxFinancing), 0),
  }
}
