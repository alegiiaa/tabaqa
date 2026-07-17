import { useEffect, useState } from 'react'
import { useTx } from '../../lib/tx'
import type { ScoreResult } from '../../lib/api'

/**
 * The engine, made visible.
 *
 * Every stage below is a real stage of pipeline/pipeline.py (clean → enrich →
 * reconcile → verify → pfc → resolve_income → features → score) and every value
 * it prints is computed by the engine — nothing here is invented.
 *
 * HONESTY BOUNDARY: /v1/score is one POST, so the *ordering* of the ticks while
 * the request is in flight is presentational — the steps light up on a timer to
 * show the work is under way. No step ever prints a number before the response
 * lands (details render only once `facts` exist), and the display never
 * fast-completes ahead of the request: with `facts === null` the last step holds
 * on "running" for as long as the API takes, cold start included.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (x: number) => `${Math.round(x * 100)}%`

/** Advance one tick every STEP_MS while the request is in flight. */
const STEP_MS = 420

/** Arabic number–noun agreement: 1 singular, 2 dual, 3–10 plural, 11+ singular
 *  accusative. "9 معاملة" and "2 حسابات" are both wrong, and this is an
 *  Arabic-first product being read by Arabic-speaking bankers. */
interface ArForms { one: string; two: string; few: string; many: string }
function arCount(n: number, f: ArForms): string {
  if (n === 1) return f.one
  if (n === 2) return f.two
  if (n >= 3 && n <= 10) return `${fmt(n)} ${f.few}`
  return `${fmt(n)} ${f.many}`
}
const AR_TXN: ArForms = { one: 'معاملة واحدة', two: 'معاملتان', few: 'معاملات', many: 'معاملة' }
const AR_MONTH: ArForms = { one: 'شهر واحد', two: 'شهران', few: 'أشهر', many: 'شهرًا' }
const AR_ACCT: ArForms = { one: 'حساب واحد', two: 'حسابان', few: 'حسابات', many: 'حسابًا' }
const AR_REASON: ArForms = { one: 'سبب موقّع', two: 'سببان موقّعان', few: 'أسباب موقّعة', many: 'سببًا موقّعًا' }
const AR_PAIR: ArForms = { one: 'زوج واحد', two: 'زوجان', few: 'أزواج', many: 'زوجًا' }
const enPlural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`

export interface PipelineFacts {
  institutions: string[]
  accounts: number
  integrity: { passed: boolean; pairs: number } | null
  transactions: number
  months: number
  verifiedShare: number
  bankOnly: number
  /** The fused figure: bank + wallet. NOT verified_income — that one counts only
   *  Masdr-attested inflow and is 0 for an uploaded file, which would render the
   *  fusion step as "4,000 → 0" and read as the income collapsing to nothing. */
  fused: number
  revealDelta: number
  score: number
  reasons: number
  auc: number | null
  dataset: string | null
}

/** Pull the real numbers off the score result — the only source of the detail lines. */
export function factsFromResult(r: ScoreResult): PipelineFacts {
  const accounts = r.accounts ?? []
  const integ = (r.applicant as any)?.statement_integrity ?? null
  return {
    institutions: accounts.map((a) => a.provider).filter(Boolean),
    accounts: accounts.length,
    integrity:
      integ && integ.checked
        ? { passed: !!integ.passed, pairs: Number(integ.pairs ?? 0) }
        : null,
    transactions: r.transactions?.length ?? 0,
    months: r.features?.months_observed ?? 0,
    verifiedShare: r.income?.verified_share ?? 0,
    bankOnly: r.income?.bank_only_income ?? 0,
    fused: r.income?.true_monthly_income ?? r.verified_income ?? 0,
    revealDelta: r.income?.reveal_delta ?? 0,
    score: r.tabaqa_score,
    reasons: r.reason_codes?.length ?? 0,
    // NB: validation.accounts is the Berka fit (682) — the smallest of the three
    // replications, not the 963,811-application AlfaBattle scale that lives in
    // model_card.json. Printing it here would undersell the work, so the footer
    // carries the discriminating power (AUC) and the corpus name instead, and
    // the scale story stays where it is sourced: ModelCardPanel.
    auc: r.validation?.auc ?? null,
    dataset: r.validation?.dataset ?? null,
  }
}

type Step = { label: string; detail: (f: PipelineFacts) => string | null }

function steps(tx: (en: string, ar: string) => string): Step[] {
  return [
    {
      label: tx('Reading the sources', 'قراءة المصادر'),
      detail: (f) =>
        f.institutions.length
          ? f.institutions.join(' · ')
          : f.accounts
            ? tx(`${f.accounts} accounts`, `${f.accounts} حسابات`)
            : null,
    },
    {
      label: tx('Normalizing & categorizing transactions', 'توحيد المعاملات وتصنيفها'),
      detail: (f) =>
        f.transactions
          ? tx(
              `${enPlural(f.transactions, 'transaction')} · ${enPlural(f.months, 'month')}`,
              `${arCount(f.transactions, AR_TXN)} · ${arCount(f.months, AR_MONTH)}`,
            )
          : null,
    },
    {
      label: tx('Reconciling transfers between accounts', 'مطابقة التحويلات بين الحسابات'),
      detail: (f) =>
        f.accounts > 1
          ? tx(
              `${enPlural(f.accounts, 'account')} · no double-count`,
              `${arCount(f.accounts, AR_ACCT)} · بدون ازدواج`,
            )
          : tx('no double-count', 'بدون ازدواج'),
    },
    {
      // Uploaded file → the running-balance chain. Connected source → Masdr provenance.
      label: tx('Verifying the source', 'التحقق من المصدر'),
      detail: (f) =>
        f.integrity
          ? f.integrity.passed
            ? tx(
                `balance chain intact · ${enPlural(f.integrity.pairs, 'pair')}`,
                `سلسلة الرصيد مطابقة · ${arCount(f.integrity.pairs, AR_PAIR)}`,
              )
            : tx('balance chain broken — possible edit', 'سلسلة الرصيد غير مطابقة — احتمال تعديل')
          : tx(`${pct(f.verifiedShare)} verified at source`, `${pct(f.verifiedShare)} موثّق من المصدر`),
    },
    {
      label: tx('Fusing the wallet with the bank', 'دمج المحفظة مع البنك'),
      // With a wallet in the mix this line IS the reveal (Mansour: 0 → 6,200).
      // With bank data alone there is nothing to fuse — say so rather than draw
      // an arrow from a number to itself.
      detail: (f) =>
        f.revealDelta > 0
          ? tx(
              `${fmt(f.bankOnly)} → ${fmt(f.fused)} SAR`,
              `${fmt(f.bankOnly)} → ${fmt(f.fused)} ريال`,
            )
          : tx(`${fmt(f.fused)} SAR · bank only, no wallet`, `${fmt(f.fused)} ريال · بنك فقط، بلا محفظة`),
    },
    {
      label: tx('Scoring — validated model', 'التقييم — نموذج مدقَّق'),
      detail: (f) =>
        tx(
          `score ${f.score} · ${enPlural(f.reasons, 'signed reason')}`,
          `الدرجة ${f.score} · ${arCount(f.reasons, AR_REASON)}`,
        ),
    },
  ]
}

export function ScorePipeline({ facts }: { facts: PipelineFacts | null }) {
  const { tx } = useTx()
  const list = steps(tx)
  const done = facts !== null
  // While in flight, tick forward but hold on the last step — never show the
  // pipeline finished before the engine actually finished.
  const [reached, setReached] = useState(0)

  useEffect(() => {
    if (done) return
    const id = setInterval(
      () => setReached((r) => Math.min(r + 1, list.length - 1)),
      STEP_MS,
    )
    return () => clearInterval(id)
  }, [done, list.length])

  const footer = facts?.auc
    ? tx(
        `Validated on real default data — AUC ${facts.auc}${facts.dataset ? ` · ${facts.dataset}` : ''}`,
        `مدقَّق على بيانات تعثّر حقيقية — AUC ${facts.auc}${facts.dataset ? ` · ${facts.dataset}` : ''}`,
      )
    : tx('Running the Tabaqa engine…', 'يعمل محرّك طبقة…')

  return (
    <div className="pipe" aria-busy={!done} aria-live="polite">
      <div className="pipe-head">{tx('Tabaqa engine', 'محرّك طبقة')}</div>

      <ol className="pipe-steps">
        {list.map((s, i) => {
          const state = done ? 'done' : i < reached ? 'done' : i === reached ? 'run' : 'wait'
          const detail = facts ? s.detail(facts) : null
          const broken = facts?.integrity && !facts.integrity.passed && i === 3
          return (
            <li key={i} className={`pipe-step is-${state}${broken ? ' is-bad' : ''}`}>
              <span className="pipe-dot" aria-hidden="true">
                {state === 'done' ? (broken ? '✗' : '✓') : ''}
              </span>
              <span className="pipe-body">
                <span className="pipe-label">{s.label}</span>
                {detail && <span className="pipe-detail">{detail}</span>}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="pipe-foot faint small">{footer}</div>
    </div>
  )
}
