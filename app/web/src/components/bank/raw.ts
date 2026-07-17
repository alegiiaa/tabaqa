// The raw connector payloads (PRODUCT_SPEC §5, §16.3) — one RawSet per demo
// persona, exactly as the five real integrations would return them (bank core /
// open banking AIS / wallet / employment registry / credit bureau).
//
// This module holds ONLY data + shapes: connectors.ts serves it over the mock
// transport and derive.ts computes the profile FROM it. Keeping the datasets here
// (rather than inside connectors.ts) is what lets connectors.ts import derive.ts
// for the per-persona decision without the two forming an import cycle.
//
// The JSON is generated deterministically — see the seeded generators in the
// scratchpad (gen_ahmed.cjs / gen_sara.cjs / gen_khalid.cjs). Every spec-critical
// sum is engineered so the engine DERIVES the expected verdict; nothing is stated.

import ahmedBank from '../../data/ahmed/bank.json'
import ahmedOpenbanking from '../../data/ahmed/openbanking.json'
import ahmedWallet from '../../data/ahmed/wallet.json'
import ahmedEmployment from '../../data/ahmed/employment.json'
import ahmedCredit from '../../data/ahmed/credit.json'

import saraBank from '../../data/sara/bank.json'
import saraOpenbanking from '../../data/sara/openbanking.json'
import saraWallet from '../../data/sara/wallet.json'
import saraEmployment from '../../data/sara/employment.json'
import saraCredit from '../../data/sara/credit.json'

import khalidBank from '../../data/khalid/bank.json'
import khalidOpenbanking from '../../data/khalid/openbanking.json'
import khalidWallet from '../../data/khalid/wallet.json'
import khalidEmployment from '../../data/khalid/employment.json'
import khalidCredit from '../../data/khalid/credit.json'

export interface RawTx {
  date: string
  description: string
  amount: number
  type: 'credit' | 'debit'
  category: string
  internal_transfer?: boolean
}

export interface AccountPayload {
  meta: Record<string, string | boolean>
  transactions: RawTx[]
}

export interface EmploymentPayload {
  meta: object
  record: Record<string, string | number | boolean>
}

export interface CreditPayload {
  meta: object
  report: {
    credit_grade: string
    serious_delinquency: boolean
    payment_history: string
    recent_inquiries: number
    obligations: { type: string; lender: string; monthly_payment: number; outstanding: number }[]
    total_monthly_obligations: number
    total_outstanding: number
  }
}

/** The five consented sources for one applicant. */
export interface RawSet {
  bank: AccountPayload
  openbanking: AccountPayload
  wallet: AccountPayload
  employment: EmploymentPayload
  credit: CreditPayload
}

export type PersonaId = 'ahmed' | 'sara' | 'khalid'

const set = (
  bank: unknown, openbanking: unknown, wallet: unknown, employment: unknown, credit: unknown,
): RawSet => ({
  bank: bank as AccountPayload,
  openbanking: openbanking as AccountPayload,
  wallet: wallet as AccountPayload,
  employment: employment as EmploymentPayload,
  credit: credit as CreditPayload,
})

/** Spec §21 — salary domiciled here 2 months ago; the fused view approves in full. */
export const ahmedRaw = set(ahmedBank, ahmedOpenbanking, ahmedWallet, ahmedEmployment, ahmedCredit)

/** Spec §10 Decision 2 — verified and stable, but four obligations exceed the cap. */
export const saraRaw = set(saraBank, saraOpenbanking, saraWallet, saraEmployment, saraCredit)

/** Spec §10 Decision 3 — the employment source claims a salary the transactions deny. */
export const khalidRaw = set(khalidBank, khalidOpenbanking, khalidWallet, khalidEmployment, khalidCredit)

export const RAW_SETS: Record<PersonaId, RawSet> = {
  ahmed: ahmedRaw,
  sara: saraRaw,
  khalid: khalidRaw,
}
