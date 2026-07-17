// Bank-side dashboard data (PRODUCT_SPEC §15) — the operations view over the
// applications the engine has already decided.
//
// NOTHING here re-decides, re-derives or re-states a number the engine produced:
// every financial figure is read off PERSONAS / derive.ts / financeMath.ts. This
// module only adds the four *operational* fields §15 asks for that the engine
// itself does not emit (application ID, submission date, processing time,
// completion %) — and each is derived deterministically from data that is really
// there. No Math.random(), no Date.now(): the demo must render identically on
// every run.

import { PERSONA_LIST, Persona } from '../bank/connectors'
import { obligations, verifiedSalary, BANK_CONFIG, ObligationCheck } from '../bank/derive'
import { PRODUCT, offersFor, installmentFor, BankOffer } from '../bank/financeMath'
import { SAMA_CAP_EMPLOYEE } from '../../lib/lenders'

// ── The request ──────────────────────────────────────────────────────────────
// The three personas are alternate applicants through the SAME journey, and the
// journey's request amount is 150,000 (FinanceFlow's default — spec §21: Ahmed's
// SAR 150k vehicle). Mirrored here because it is UI state in FinanceFlow, not data.
export const REQUESTED_AMOUNT = 150_000

// ── Processing time ──────────────────────────────────────────────────────────
// The five connectors in connectors.ts `connectorsFor` each await a real latency
// before returning their payload. Those constants are module-private there and
// that file is verified/read-only, so the budget is mirrored — and it is the
// actual elapsed retrieval cost of a run, not a decorative number.
export const CONNECTOR_LATENCY_MS: Record<string, number> = {
  bank: 420,
  openbanking: 650,
  wallet: 380,
  employment: 300,
  credit: 340,
}

/** Sequential retrieval across the five connectors = 2,090 ms. */
export const RETRIEVAL_MS = Object.values(CONNECTOR_LATENCY_MS).reduce((a, b) => a + b, 0)

// The engine itself (deriveProfile + decide) is synchronous JS over ~170 rows —
// it costs well under a millisecond, so the retrieval budget IS the processing
// time. We say that out loud in the detail view rather than padding it.
export const ENGINE_MS_NOTE = { ar: 'أقل من 1 ملّي ثانية', en: 'under 1 ms' }

// ── Application ID ───────────────────────────────────────────────────────────
// FNV-1a over the persona id + product: stable across runs and across machines,
// which is the whole point — a demo that renumbers itself on reload is a demo
// that cannot be screenshotted.
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** `VF-######` — the shape FinanceFlow's own receipt uses, seeded off the persona. */
export function applicationId(p: Persona): string {
  return `VF-${String(fnv1a(`${p.id}:${PRODUCT.nameAr}`) % 1_000_000).padStart(6, '0')}`
}

// ── Submission date ──────────────────────────────────────────────────────────
// Real timestamps: the employment connector stamps `retrieved_at` into its own
// payload (web/src/data/<persona>/employment.json), which is the moment consent
// was exercised and the file opened. Sliced as a string — constructing a Date
// would drag in the viewer's timezone and make the demo drift.
export function submittedAt(p: Persona): { date: string; time: string; raw: string } {
  const raw = String(p.raw.employment.record.retrieved_at ?? '')
  return { date: raw.slice(0, 10), time: raw.slice(11, 16), raw }
}

// ── Affordability ceiling, per applicant ─────────────────────────────────────
// financeMath's maxFinancing() is bound to Ahmed's profile, so the ceiling is
// recomputed here for any applicant — but strictly through the EXPORTED
// installmentFor(), so the annuity math itself is never re-implemented:
// the PV annuity factor is simply 1 / installmentFor(1, apr, months).
function annuityFactorOf(apr: number, months: number): number {
  return 1 / installmentFor(1, apr, months)
}

/** Room stretched over the friendliest available term. Negative room → 0. */
export function ceilingFor(room: number): number {
  if (room <= 0) return 0
  return Math.max(...PRODUCT.terms.map((t) => room * annuityFactorOf(t.apr, t.months)))
}

/** What the bank would actually grant: the ask, capped by the ceiling, to the 1,000. */
export function grantableFor(p: Persona): number {
  return Math.min(REQUESTED_AMOUNT, Math.floor(ceilingFor(p.installmentRoom) / 1000) * 1000)
}

// ── Data verification (§15) ──────────────────────────────────────────────────

export type VerifyState = 'verified' | 'retrieved' | 'conflict'

export interface VerifyRow {
  label: { ar: string; en: string }
  state: VerifyState
  detail: { ar: string; en: string }
}

const n = (x: number) => Math.round(x).toLocaleString('en-US')

/**
 * The six §15 verification rows, each COMPUTED from the payload it describes.
 * Khalid's salary row resolves to `conflict` because verifiedSalary() rejected
 * the employment source's claim — that contradiction is the product working, so
 * it is rendered loudly rather than smoothed into a ✓.
 */
export function verifyRows(p: Persona): VerifyRow[] {
  const rec = p.raw.employment.record
  const sal = verifiedSalary(p.raw)
  const cr = p.raw.credit.report
  const ob = obligations(p.raw)
  const seen = ob.lines.filter((l) => l.seenInTransactions).length

  return [
    {
      label: { ar: 'الهوية', en: 'Identity' },
      state: 'verified',
      detail: {
        ar: `${rec.national_id_masked} · حالة المصدر: ${rec.verification_status}`,
        en: `${rec.national_id_masked} · source status: ${rec.verification_status}`,
      },
    },
    {
      label: { ar: 'التوظيف', en: 'Employment' },
      state: 'verified',
      detail: {
        ar: `${rec.employer_name} · ${rec.employment_type} · منذ ${rec.employment_start_date}`,
        en: `${rec.employer_name} · ${rec.employment_type} · since ${rec.employment_start_date}`,
      },
    },
    {
      label: { ar: 'الراتب', en: 'Salary' },
      state: sal.matchesEmployment ? 'verified' : 'conflict',
      detail: sal.matchesEmployment
        ? {
            ar: `${n(sal.amount)} ر.س — مطابق لمصدر التوظيف عبر ${sal.monthsSeen}/6 أشهر (سماحية ${BANK_CONFIG.salaryTolerancePct * 100}%)`,
            en: `SAR ${n(sal.amount)} — matches the employment source across ${sal.monthsSeen}/6 months (${BANK_CONFIG.salaryTolerancePct * 100}% tolerance)`,
          }
        : {
            ar: `تعارض: مصدر التوظيف يعلن ${n(Number(rec.verified_monthly_salary))} ر.س، والحركات تُظهر ${sal.monthsSeen}/6 أشهر راتب بمتوسط ${n(sal.amount)} ر.س. المحرّك اعتمد ما رآه، لا ما أُعلن.`,
            en: `Conflict: the employment source claims SAR ${n(Number(rec.verified_monthly_salary))}, transactions show ${sal.monthsSeen}/6 salary months averaging SAR ${n(sal.amount)}. The engine used what it saw, not what was claimed.`,
          },
    },
    {
      label: { ar: 'السجل الائتماني', en: 'Credit information' },
      state: 'retrieved',
      detail: {
        ar: `تصنيف ${cr.credit_grade} · ${ob.lines.length} التزام بإجمالي ${n(ob.total)} ر.س/شهر · ${seen}/${ob.lines.length} مطابق لحركات فعلية`,
        en: `Grade ${cr.credit_grade} · ${ob.lines.length} obligations totalling SAR ${n(ob.total)}/mo · ${seen}/${ob.lines.length} corroborated by real debits`,
      },
    },
    {
      label: { ar: 'الخدمات المصرفية المفتوحة', en: 'Open Banking data' },
      state: 'retrieved',
      detail: {
        ar: `${p.raw.openbanking.meta.institution} · ${p.counts.openbanking} عملية · ${p.raw.openbanking.meta.access}`,
        en: `${p.raw.openbanking.meta.institution} · ${p.counts.openbanking} transactions · ${p.raw.openbanking.meta.access}`,
      },
    },
    {
      label: { ar: 'المحفظة الرقمية', en: 'Wallet data' },
      state: 'retrieved',
      detail: {
        ar: `${p.raw.wallet.meta.institution} · ${p.counts.wallet} عملية · ${p.raw.wallet.meta.access}`,
        en: `${p.raw.wallet.meta.institution} · ${p.counts.wallet} transactions · ${p.raw.wallet.meta.access}`,
      },
    },
  ]
}

// ── Completion % ─────────────────────────────────────────────────────────────
// The share of the six §15 verification rows that actually cleared. Every source
// returned a payload for all three applicants, so a naive "sources that responded"
// count would print 100% for everyone and hide Khalid entirely. Completeness of a
// DECISION FILE is the useful measure: a source that returned a figure the engine
// then had to reject has not completed anything. Khalid → 5/6. The checklist is
// rendered in full on the detail page, so the number is never a bare assertion.
export function completion(p: Persona): { pct: number; passed: number; total: number } {
  const rows = verifyRows(p)
  const passed = rows.filter((r) => r.state !== 'conflict').length
  return { pct: Math.round((passed / rows.length) * 100), passed, total: rows.length }
}

// ── Audit timeline (§15) ─────────────────────────────────────────────────────

export type StepState = 'done' | 'stopped' | 'blocked'

export interface AuditStep {
  label: { ar: string; en: string }
  state: StepState
  detail?: { ar: string; en: string }
}

/**
 * The nine §15 steps, stopped where each journey ACTUALLY stopped.
 *
 * Steps 1–6 run for all three: decide() IS the bank policy (spec §10 evaluates
 * its gates in policy order), so "bank policy applied" is honestly ✓ even for
 * Khalid — the rule that fired was the reconciliation gate.
 *
 * Steps 7–9 belong to a journey that only Ahmed completed. Sara was declined at
 * step 6 and Khalid was routed to a human at step 6; neither ever selected an
 * offer, generated a document or saw an OTP. Rendering those as ✓ would be a lie
 * about the one thing this dashboard exists to prove.
 */
export function auditSteps(p: Persona): AuditStep[] {
  const ob = obligations(p.raw)
  const approved = p.decision === 'approved'
  const sel = approved ? selectedOffer(p) : null

  const blocked: { ar: string; en: string } =
    p.decision === 'declined'
      ? { ar: 'لم يُبلَغ — توقّف المسار عند الرفض', en: 'Not reached — the journey stopped at the decline' }
      : { ar: 'لم يُبلَغ — الطلب محال لمراجعة بشرية', en: 'Not reached — routed to a human reviewer' }

  const step7: AuditStep = {
    label: { ar: 'اختيار العرض', en: 'Offer selected' },
    state: approved ? 'done' : 'blocked',
    detail: sel
      ? {
          ar: `${n(grantableFor(p))} ر.س · ${sel.months} شهرًا · قسط ${n(sel.installment)} ر.س`,
          en: `SAR ${n(grantableFor(p))} · ${sel.months} months · installment SAR ${n(sel.installment)}`,
        }
      : blocked,
  }

  return [
    {
      label: { ar: 'استلام الموافقة', en: 'Consent received' },
      state: 'done',
      detail: {
        ar: `5 مصادر · اطلاع فقط · ${submittedAt(p).date} ${submittedAt(p).time}`,
        en: `5 sources · read-only · ${submittedAt(p).date} ${submittedAt(p).time}`,
      },
    },
    {
      label: { ar: 'جلب البيانات', en: 'Data retrieved' },
      state: 'done',
      detail: {
        ar: `${p.counts.accounts} حسابات · ${p.counts.total} عملية · ${RETRIEVAL_MS} ملّي ثانية`,
        en: `${p.counts.accounts} accounts · ${p.counts.total} transactions · ${RETRIEVAL_MS} ms`,
      },
    },
    {
      label: { ar: 'توحيد الملف', en: 'Profile normalized' },
      state: 'done',
      detail: {
        ar: `راتب موثّق ${n(p.profile.verifiedSalary)} · دخل جانبي مستقر ${n(p.profile.sideIncome)} · استقرار: ${p.profile.stability}`,
        en: `verified salary ${n(p.profile.verifiedSalary)} · stable side income ${n(p.profile.sideIncome)} · stability: ${p.profile.stability}`,
      },
    },
    {
      label: { ar: 'احتساب القدرة على السداد', en: 'Affordability calculated' },
      state: 'done',
      detail: {
        ar: `دخل معتمد ${n(p.eligibleIncome)} × ${(SAMA_CAP_EMPLOYEE * 100).toFixed(2)}% − التزامات ${n(ob.total)} = ${n(p.installmentRoom)} ر.س`,
        en: `eligible ${n(p.eligibleIncome)} × ${(SAMA_CAP_EMPLOYEE * 100).toFixed(2)}% − obligations ${n(ob.total)} = SAR ${n(p.installmentRoom)}`,
      },
    },
    {
      label: { ar: 'تطبيق سياسة المصرف', en: 'Bank policy applied' },
      state: 'done',
      detail: {
        ar: `حد الاستقطاع النظامي ${(SAMA_CAP_EMPLOYEE * 100).toFixed(2)}% · حد أدنى للدخل ${n(BANK_CONFIG.minEligibleIncome)} ر.س`,
        en: `salary-deduction cap ${(SAMA_CAP_EMPLOYEE * 100).toFixed(2)}% · income floor SAR ${n(BANK_CONFIG.minEligibleIncome)}`,
      },
    },
    {
      label: { ar: 'إصدار القرار', en: 'Decision generated' },
      state: 'done',
      detail: { ar: p.reasonAr, en: p.reasonEn },
    },
    step7,
    {
      label: { ar: 'تجهيز المستندات', en: 'Documents generated' },
      state: approved ? 'done' : 'blocked',
      detail: approved
        ? { ar: 'عقد التمويل + جدول السداد الكامل', en: 'Financing contract + full amortisation schedule' }
        : blocked,
    },
    {
      label: { ar: 'تأكيد رمز التحقق (OTP)', en: 'OTP confirmed' },
      state: approved ? 'done' : 'blocked',
      detail: approved
        ? { ar: 'توثيق إلكتروني مؤكَّد', en: 'E-signature confirmed' }
        : blocked,
    },
  ]
}

// ── Offer selected (§15) ─────────────────────────────────────────────────────

/**
 * The offer the customer journey lands on — the same pick FinanceFlow makes
 * (recommended-and-available, else the first available). offersFor() is bound to
 * Ahmed's room in financeMath, and Ahmed is the only applicant who ever reached
 * the offers screen, so this is only ever called for him. Sara and Khalid have no
 * selected offer, and the detail page says exactly that instead of inventing one.
 */
export function selectedOffer(p: Persona): BankOffer | null {
  if (p.decision !== 'approved') return null
  const offers = offersFor(grantableFor(p))
  return offers.find((o) => o.recommended && o.available) ?? offers.find((o) => o.available) ?? null
}

// ── The table row (§15) ──────────────────────────────────────────────────────

export interface AppRow {
  persona: Persona
  id: string
  product: string
  requested: number
  /** null when nothing was approved — declined, or still with a reviewer. */
  approved: number | null
  grade: string
  completionPct: number
  submitted: { date: string; time: string; raw: string }
  processingMs: number
  obligationLines: ObligationCheck[]
}

export function rowFor(p: Persona): AppRow {
  return {
    persona: p,
    id: applicationId(p),
    product: PRODUCT.nameAr,
    requested: REQUESTED_AMOUNT,
    approved: p.decision === 'approved' ? grantableFor(p) : null,
    grade: p.profile.grade,
    completionPct: completion(p).pct,
    submitted: submittedAt(p),
    processingMs: RETRIEVAL_MS,
    obligationLines: obligations(p.raw).lines,
  }
}

/** Stable order: approved → declined → review (PERSONA_LIST's order). */
export const APP_ROWS: AppRow[] = PERSONA_LIST.map(rowFor)
