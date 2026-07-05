import { useEffect, useRef, useState } from 'react'
import { useTx } from '../../lib/tx'
import { api, type ScoreResult, type AffordabilityResult, type Transaction, type Validation } from '../../lib/api'
import { resolveMerchant, CATEGORY_LABELS } from '../../lib/merchants'
import { sourceLabel } from '../../lib/institutions'
import { MerchantLogo } from './MerchantLogo'
import { AccountCard } from './AccountCard'
import { ScoreWaterfall } from './ScoreWaterfall'
import { RecoursePanel } from './RecoursePanel'
import { ComplianceReceipt } from './ComplianceReceipt'
import { ConfidenceBadge, BenchmarkPanel } from './ScoreExtras'
import modelCard from '../../data/model_card.json'
import { dualDate } from '../../lib/dates'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

type Tab = 'reveal' | 'score' | 'ledger' | 'afford'

export function Result({
  result,
  name,
  source,
  onBack,
}: {
  result: ScoreResult
  name: string
  source: string
  onBack: () => void
}) {
  const { tx, dir } = useTx()
  const [tab, setTab] = useState<Tab>('reveal')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'reveal', label: tx('① The reveal', '① الكشف') },
    { id: 'score', label: tx('② The score', '② الدرجة') },
    { id: 'ledger', label: tx('③ The ledger', '③ السجل') },
    { id: 'afford', label: tx('④ Affordability', '④ القدرة على السداد') },
  ]
  const back = dir === 'rtl' ? '→' : '←'

  return (
    <div className="res">
      <div className="res-head">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          {back} {tx('All applicants', 'كل المتقدمين')}
        </button>
        <div className="res-title">
          <strong>{name}</strong>
          <span className="faint">· {source}</span>
        </div>
      </div>

      <div className="res-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`res-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="res-body">
        {tab === 'reveal' && <RevealScreen result={result} />}
        {tab === 'score' && <ScoreScreen result={result} />}
        {tab === 'ledger' && <LedgerScreen txns={result.transactions} />}
        {tab === 'afford' && <AffordScreen result={result} />}
      </div>
    </div>
  )
}

// ── tier tag helper ─────────────────────────────────────────────────────────
export function useTierTag() {
  const { tx } = useTx()
  return (v: string) => {
    if (v === 'amount_verified') return { cls: 't-ok', label: tx('✓ amount verified', '✓ مبلغ موثّق') }
    if (v === 'source_verified') return { cls: 't-src', label: tx('✓ source verified', '✓ مصدر موثّق') }
    return { cls: 't-inf', label: tx('inferred', 'مُستنتج') }
  }
}

// ── ① the reveal ────────────────────────────────────────────────────────────
// Remembers which results already played the reveal theatre, so tab-switching
// doesn't replay it — only the explicit replay button does.
const playedReveals = new WeakSet<object>()

// rAF count-up with ease-out; when not running it just pins to the target.
function useCountUp(target: number, from: number, run: boolean, ms = 1400) {
  const [v, setV] = useState(run ? from : target)
  useEffect(() => {
    if (!run) { setV(target); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      setV(from + (target - from) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, from, run, ms])
  return v
}

export function RevealScreen({
  result,
  onRevealed,
}: {
  result: ScoreResult
  /** Fires with true at the verdict-flip moment (and false on replay) — lets
   *  the parent hold back spoilers (e.g. the score section) until the reveal. */
  onRevealed?: (revealed: boolean) => void
}) {
  const { tx } = useTx()
  const tierTag = useTierTag()
  const inc = result.income
  const SAR = tx('SAR', 'ر.س')
  const reconciled = result.transactions.some((t) => t.txn_type === 'internal_movement')
  const accounts = result.accounts ?? []
  const holder = (result.applicant?.name as string) || tx('Card holder', 'حامل البطاقة')

  // The theatre only makes sense when there IS a hidden layer to reveal.
  const hasHiddenLayer = inc.reveal_delta > 0
  const reduced =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const skipTheatre = !hasHiddenLayer || reduced

  const [stage, setStage] = useState<'bank' | 'revealed'>(() =>
    skipTheatre || playedReveals.has(result) ? 'revealed' : 'bank',
  )
  const [animating, setAnimating] = useState(false)
  const [flipped, setFlipped] = useState(stage === 'revealed')
  const flipTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(flipTimer.current), [])
  useEffect(() => { onRevealed?.(flipped) }, [flipped, onRevealed])

  // Real decision contrast for the verdict flip — same engine as the ④ tab.
  const [verdict, setVerdict] = useState<AffordabilityResult | null>(null)
  useEffect(() => {
    if (!hasHiddenLayer) return
    let on = true
    const obligations = result.features
      ? Math.round(result.features.recurring_obligation_load * inc.true_monthly_income)
      : 0
    api
      .affordability({
        verified_income: inc.true_monthly_income,
        bank_only_income: inc.bank_only_income,
        risk_flag: result.risk_flag,
        amount: 60000,
        tenor_months: 48,
        annual_rate: 0.1,
        existing_obligations: obligations,
        customer_type: 'employee',
      })
      .then((r) => { if (on) setVerdict(r) })
      .catch(() => { /* chip falls back to score copy */ })
    return () => { on = false }
  }, [result, hasHiddenLayer, inc.bank_only_income, inc.true_monthly_income])

  const revealed = stage === 'revealed'
  const shown = useCountUp(inc.true_monthly_income, inc.bank_only_income, animating)

  const reveal = () => {
    playedReveals.add(result)
    setAnimating(true)
    setStage('revealed')
    flipTimer.current = window.setTimeout(() => setFlipped(true), 1500)
  }
  const replay = () => {
    window.clearTimeout(flipTimer.current)
    setAnimating(false)
    setFlipped(false)
    setStage('bank')
  }

  const decisionLabel = (d: string) =>
    d === 'APPROVE' ? tx('APPROVE', 'موافقة') : d === 'REVIEW' ? tx('REVIEW', 'مراجعة') : tx('DECLINE', 'رفض')
  const decisionCls = (d: string) =>
    d === 'APPROVE' ? 'ok' : d === 'REVIEW' ? 'warn' : 'bad'

  const bankChip = verdict?.bank_only
    ? `${decisionLabel(verdict.bank_only.decision)} · ${tx('max financing', 'أقصى تمويل')} ${fmt(verdict.bank_only.max_financing)} ${SAR}`
    : tx('Thin file — income invisible', 'ملف رقيق — دخل غير مرئي')
  const tabaqaChip = verdict
    ? `${decisionLabel(verdict.decision)} · ${tx('max financing', 'أقصى تمويل')} ${fmt(verdict.max_financing)} ${SAR}`
    : `${tx('Tabaqa score', 'درجة Tabaqa')} ${result.tabaqa_score}`
  const tabaqaChipCls = verdict ? decisionCls(verdict.decision) : 'ok'

  const bankAccounts = accounts.filter((a) => a.kind !== 'wallet')
  const walletAccounts = accounts.filter((a) => a.kind === 'wallet')

  return (
    <div className="screen">
      {hasHiddenLayer && (
        <div className="reveal-verdict-row">
          <span className={`reveal-verdict ${flipped ? tabaqaChipCls : 'bad'}`}>
            <span className="dot" />
            {flipped ? tabaqaChip : bankChip}
          </span>
          {revealed && !skipTheatre && (
            <button className="btn btn-ghost btn-sm reveal-replay" onClick={replay}>
              {tx('↻ Replay the reveal', '↻ إعادة الكشف')}
            </button>
          )}
        </div>
      )}

      {accounts.length > 0 && (
        <div className="acct-strip">
          {bankAccounts.map((a) => (
            <AccountCard key={a.source} account={a} holder={holder} />
          ))}
          {revealed &&
            walletAccounts.map((a, i) => (
              <div
                key={a.source}
                className={`reveal-wallet-slot${animating ? ' reveal-pop' : ''}`}
                style={animating ? { animationDelay: `${0.15 + i * 0.12}s` } : undefined}
              >
                <AccountCard account={a} holder={holder} />
              </div>
            ))}
        </div>
      )}

      <div className="reveal-cards">
        <div className="reveal-card muted-card">
          <div className="reveal-cap">{tx('Bank-only view', 'رؤية البنك فقط')}</div>
          <div className="reveal-big faint">{fmt(inc.bank_only_income)}</div>
          <div className="reveal-unit">{SAR} / {tx('mo', 'شهر')}</div>
        </div>
        <div className="reveal-arrow">→</div>
        {revealed ? (
          <div
            className={`reveal-card hot-card${animating ? ' reveal-pop' : ''}`}
          >
            <div className="reveal-cap">{tx('Tabaqa — true income', 'Tabaqa — الدخل الحقيقي')}</div>
            <div className="reveal-big accent-num">{fmt(shown)}</div>
            <div className="reveal-unit">{SAR} / {tx('mo', 'شهر')}</div>
          </div>
        ) : (
          <div className="reveal-card ghost-card">
            <div className="reveal-cap">{tx('The hidden layer', 'الطبقة المخفية')}</div>
            <div className="reveal-big faint">؟</div>
            <button className="btn btn-primary reveal-cta" onClick={reveal}>
              {tx('Reveal the wallet layer', 'اكشف طبقة المحفظة')}
            </button>
          </div>
        )}
      </div>

      {revealed && (
        <>
          <div
            className={`reveal-delta${animating ? ' reveal-pop' : ''}`}
            style={animating ? { animationDelay: '1.05s' } : undefined}
          >
            <span className="dot" />
            {tx('Revealed', 'مكشوف')}: <b><span dir="ltr">+{fmt(inc.reveal_delta)}</span> {SAR}</b> ·{' '}
            {tx('verified share', 'النسبة الموثّقة')} <b>{pct(inc.verified_share)}</b>
          </div>

          <div
            className={`rc${animating ? ' reveal-pop' : ''}`}
            style={{ marginTop: 18, ...(animating ? { animationDelay: '.45s' } : {}) }}
          >
            <div className="h">{tx('Income breakdown · 3-tier verification', 'تفصيل الدخل · تحقّق ثلاثي')}</div>
            {inc.components.map((c, i) => {
              const tag = tierTag(c.verification)
              return (
                <div
                  className={`row2${animating ? ' reveal-pop' : ''}`}
                  style={animating ? { animationDelay: `${0.6 + i * 0.14}s` } : undefined}
                  key={i}
                >
                  <span>{c.label}</span>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <b>{fmt(c.monthly_amount)}</b>
                    <span className={`tag ${tag.cls}`}>{tag.label}</span>
                  </span>
                </div>
              )
            })}
          </div>

          {reconciled && (
            <div
              className={`note-line${animating ? ' reveal-pop' : ''}`}
              style={animating ? { animationDelay: '1.25s' } : undefined}
            >
              {tx(
                'Bank ↔ wallet transfer detected and marked internal — not double-counted.',
                'تم رصد تحويل بين البنك والمحفظة ووسمه داخليًا — دون احتساب مزدوج.',
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── ② the score ─────────────────────────────────────────────────────────────
export function ScoreScreen({ result, onOpenModel }: { result: ScoreResult; onOpenModel?: () => void }) {
  const { tx } = useTx()
  const R = 79
  const C = 2 * Math.PI * R
  const offset = C * (1 - Math.max(1, Math.min(99, result.tabaqa_score)) / 99)
  const riskLabel =
    result.risk_flag === 'low'
      ? tx('low risk', 'مخاطر منخفضة')
      : result.risk_flag === 'medium'
        ? tx('medium risk', 'مخاطر متوسطة')
        : tx('high risk', 'مخاطر مرتفعة')
  const riskCls =
    result.risk_flag === 'low' ? 'ok' : result.risk_flag === 'medium' ? 'warn' : 'bad'

  return (
    <div className="screen score-screen">
      <div className="score-left">
        <div className="gauge">
          <svg width="188" height="188" viewBox="0 0 188 188" aria-label={`Tabaqa score ${result.tabaqa_score}`}>
            <circle cx="94" cy="94" r={R} stroke="rgba(12,18,38,.08)" strokeWidth="12" fill="none" />
            <circle
              cx="94" cy="94" r={R} stroke="url(#sg)" strokeWidth="12" fill="none"
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
            />
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3b82f6" />
                <stop offset="1" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
          </svg>
          <div className="ctr">
            <div className="num">{result.tabaqa_score}</div>
            <div className="lab">{tx('Tabaqa Score', 'درجة Tabaqa')}</div>
          </div>
        </div>
        <div className={`risk-pill ${riskCls}`}>
          {riskLabel} · <span dir="ltr">PD {pct(result.pd)}</span>
        </div>
        <ConfidenceBadge confidence={result.confidence} />
      </div>

      <div className="score-right">
        <ScoreWaterfall result={result} />
        <RecoursePanel recourse={result.recourse} />
        <BenchmarkPanel benchmark={result.benchmark} />
      </div>
      <ValidationStrip validation={result.validation} onOpenModel={onOpenModel} />
    </div>
  )
}

// ── score provenance → the judge's road INTO the Model-validation page ───────
// Numbers follow the performance-ledger discipline: the headline is the full-model
// CV AUC + lift from model_card.json (never the loose 6-feature holdout figure).
function ValidationStrip({ validation, onOpenModel }: { validation?: Validation | null; onOpenModel?: () => void }) {
  const { tx } = useTx()
  if (!validation?.validated) return null
  const accts = validation.accounts?.toLocaleString('en-US')
  return (
    <div className="score-validation" title={validation.note ?? undefined}>
      <span className="sv-badge">✓ {tx('Proven on real defaults', 'مُثبَت على تعثّرات حقيقية')}</span>
      <span className="sv-metrics">
        <b dir="ltr">+{modelCard.lift.auc.toFixed(2)} AUC</b>
        {' '}{tx('over bureau-only', 'فوق رؤية المكتب')} ·{' '}
        {tx('replicated on a 2nd country', 'مُكرَّر في بلد ثانٍ')}
        {accts ? <> · <span dir="ltr">{accts}</span> {tx('real accounts', 'حساب حقيقي')}</> : null}
      </span>
      {onOpenModel && (
        <button className="mm-link" onClick={onOpenModel}>
          {tx('See the evidence', 'اطّلع على الدليل')} <span className="fwd">→</span>
        </button>
      )}
      <span className="sv-note faint small">
        {tx('Weights direction-locked to the fit; magnitudes re-calibrated on the lender’s book at go-live.',
            'الأوزان مقيّدة باتجاه النموذج المُتحقَّق؛ وتُعاير قيمها على بيانات المموِّل عند الإطلاق.')}
      </span>
    </div>
  )
}

// ── ③ the ledger ────────────────────────────────────────────────────────────
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Humanize a Plaid PFC primary code, e.g. FOOD_AND_DRINK → "Food & Drink". */
const pfcLabel = (p: string) =>
  p.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ').replace(/\bAnd\b/g, '&')

export function LedgerScreen({ txns }: { txns: Transaction[] }) {
  const { tx, dir } = useTx()
  const arabic = dir === 'rtl'
  const tierTag = useTierTag()
  const sorted = txns.slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))

  // group into month buckets (newest first), preserving sort order within each
  const groups: { key: string; label: string; items: Transaction[] }[] = []
  for (const t of sorted) {
    const key = t.timestamp.slice(0, 7)
    const [y, m] = key.split('-')
    const label = `${tx(MONTHS_EN[+m - 1], MONTHS_AR[+m - 1])} ${y}`
    const g = groups.find((x) => x.key === key)
    if (g) g.items.push(t)
    else groups.push({ key, label, items: [t] })
  }

  return (
    <div className="screen">
      <div className="feed-head">
        <div className="h">{tx('Unified ledger · bank + wallet', 'السجل الموحّد · البنك + المحفظة')}</div>
        <span className="faint small">{txns.length} {tx('transactions', 'عملية')}</span>
      </div>

      <div className="feed">
        {groups.map((g) => (
          <div className="feed-group" key={g.key}>
            <div className="feed-month">{g.label}</div>
            {g.items.map((t, i) => {
              const r = resolveMerchant(t)
              const isWallet = t.source.startsWith('wallet:')
              const inflow = t.direction === 'inflow'
              const incomeRow = ['salary', 'gig_income', 'p2p'].includes(t.txn_type)
              const tag = incomeRow ? tierTag(t.verification) : null
              const cat = CATEGORY_LABELS[r.category]
              return (
                <div className="feed-row" key={i}>
                  <MerchantLogo r={r} />
                  <div className="feed-main">
                    <div className="feed-title">
                      {r.title}
                      <span className={`feed-src ${isWallet ? 'w' : 'b'}`}>
                        {sourceLabel(t.source, tx)}
                      </span>
                    </div>
                    <div className="feed-sub faint">
                      {cat ? tx(cat[0], cat[1]) : t.txn_type} · <FeedDate iso={t.timestamp} arabic={arabic} />
                      {t.pfc_primary && <span className="pfc-chip" title={t.pfc_detailed ?? ''}>{pfcLabel(t.pfc_primary)}</span>}
                    </div>
                  </div>
                  <div className="feed-right">
                    <div className={`feed-amt ${inflow ? 'pos' : 'neg'}`}>
                      <span dir="ltr">{inflow ? '+' : '−'}{fmt(t.amount)}</span> <small>{tx('SAR', 'ر.س')}</small>
                    </div>
                    {tag && <span className={`tag ${tag.cls}`}>{tag.label}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// Gregorian + Hijri (Umm al-Qura) — the way a real Saudi statement reads.
export function FeedDate({ iso, arabic }: { iso: string; arabic: boolean }) {
  const d = dualDate(iso, arabic)
  return (
    <>
      <span dir="ltr">{d.greg}</span>
      {d.hijri && <span className="hijri-chip">{d.hijri}</span>}
    </>
  )
}

// ── ④ affordability ─────────────────────────────────────────────────────────
export function AffordScreen({ result }: { result: ScoreResult }) {
  const { tx } = useTx()
  const SAR = tx('SAR', 'ر.س')
  const defaultObl = result.features
    ? Math.round(result.features.recurring_obligation_load * result.income.true_monthly_income)
    : 0

  const [amount, setAmount] = useState(60000)
  const [tenor, setTenor] = useState(48)
  const [rate, setRate] = useState(10) // percent
  const [obligations, setObligations] = useState(defaultObl)
  // SAMA preset drives the cap; "custom" lets a lender set its own policy.
  const [capMode, setCapMode] = useState<'employee' | 'retiree' | 'custom'>('employee')
  const [customCap, setCustomCap] = useState(33) // percent
  const [out, setOut] = useState<AffordabilityResult | null>(null)
  // Inputs snapshotted at calc time, so the receipt documents the decision that was
  // actually computed even if the form fields are edited afterwards.
  const [snap, setSnap] = useState<{ amount: number; tenor: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function calc() {
    setLoading(true); setErr(null)
    try {
      const r = await api.affordability({
        verified_income: result.income.true_monthly_income,
        bank_only_income: result.income.bank_only_income,
        risk_flag: result.risk_flag,
        amount,
        tenor_months: tenor,
        annual_rate: rate / 100,
        existing_obligations: obligations,
        ...(capMode === 'custom'
          ? { dbr_cap: customCap / 100 }
          : { customer_type: capMode }),
      })
      setOut(r)
      setSnap({ amount, tenor })
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const decisionCls = (d: string) =>
    d === 'APPROVE' ? 'ok' : d === 'REVIEW' ? 'warn' : 'bad'
  const decisionLabel = (d: string) =>
    d === 'APPROVE' ? tx('APPROVE', 'موافقة') : d === 'REVIEW' ? tx('REVIEW', 'مراجعة') : tx('DECLINE', 'رفض')

  return (
    <div className="screen afford">
      <div className="afford-form">
        <Field label={tx('Financing amount', 'مبلغ التمويل')} v={amount} set={setAmount} suffix={SAR} />
        <Field label={tx('Tenor (months)', 'المدة (أشهر)')} v={tenor} set={setTenor} />
        <Field label={tx('Annual rate %', 'النسبة السنوية %')} v={rate} set={setRate} step={0.1} />
        <Field label={tx('Existing obligations / mo', 'الالتزامات الحالية / شهر')} v={obligations} set={setObligations} suffix={SAR} />
        <div className="field">
          <label>{tx('SAMA cap policy', 'سياسة سقف ساما')}</label>
          <div className="afford-seg">
            {([['employee', tx('Employee 33%', 'موظف ٣٣٪')], ['retiree', tx('Retiree 25%', 'متقاعد ٢٥٪')], ['custom', tx('Custom', 'مخصص')]] as const).map(([m, label]) => (
              <button key={m} type="button" className={`afford-seg-btn${capMode === m ? ' on' : ''}`} onClick={() => setCapMode(m)}>{label}</button>
            ))}
          </div>
        </div>
        {capMode === 'custom' && <Field label={tx('Custom DBR cap %', 'سقف نسبة الدين المخصص %')} v={customCap} set={setCustomCap} />}
        <button className="btn btn-primary" onClick={calc} disabled={loading}>
          {loading ? tx('Calculating…', 'جارٍ الحساب…') : tx('Calculate', 'احسب')}
        </button>
        {err && <div className="afford-err">{err}</div>}
      </div>

      {out && (
        <div className="afford-out">
          <div className={`decision-banner ${decisionCls(out.decision)}`}>
            {decisionLabel(out.decision)}
          </div>
          <div className="afford-grid">
            <Stat label={tx('Monthly installment', 'القسط الشهري')} value={`${fmt(out.installment)} ${SAR}`} />
            <Stat label={tx('DBR before', 'نسبة الدين قبل')} value={pct(out.dbr_before)} />
            <Stat label={tx('DBR after', 'نسبة الدين بعد')} value={pct(out.dbr_after)} />
            <Stat label={tx('Max financing', 'أقصى تمويل')} value={`${fmt(out.max_financing)} ${SAR}`} />
          </div>
          {out.dbr_policy && (
            <div className="afford-policy">
              <span className="afford-policy-cap">{tx('Cap applied', 'السقف المطبّق')}: {pct(out.dbr_policy.cap)}</span>
              <span className="afford-policy-cite">{out.dbr_policy.label} · {tx('total-DBR ceiling', 'سقف إجمالي الالتزامات')} {pct(out.dbr_policy.total_obligations_ceiling)} · {out.dbr_policy.citation}</span>
            </div>
          )}
          {out.reasons.length > 0 && (
            <ul className="afford-reasons">
              {out.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {out.bank_only && (
            <div className="afford-contrast">
              <div className="h">{tx('The Tabaqa difference', 'الفرق الذي تصنعه Tabaqa')}</div>
              <div className="contrast-row">
                <span>{tx('On bank-only income', 'على دخل البنك فقط')} ({fmt(out.bank_only.verified_income)} {SAR})</span>
                <span className={`tag ${out.bank_only.decision === 'APPROVE' ? 't-ok' : 't-inf'}`}>
                  {decisionLabel(out.bank_only.decision)} · {fmt(out.bank_only.max_financing)} {SAR}
                </span>
              </div>
              <div className="contrast-row">
                <span>{tx('On Tabaqa verified income', 'على دخل Tabaqa الموثّق')} ({fmt(out.verified_income)} {SAR})</span>
                <span className={`tag ${out.decision === 'APPROVE' ? 't-ok' : 't-inf'}`}>
                  {decisionLabel(out.decision)} · {fmt(out.max_financing)} {SAR}
                </span>
              </div>
            </div>
          )}
          {snap && (
            <ComplianceReceipt result={result} out={out} amount={snap.amount} tenor={snap.tenor} />
          )}
        </div>
      )}
    </div>
  )
}

function Field({
  label, v, set, suffix, step,
}: { label: string; v: number; set: (n: number) => void; suffix?: string; step?: number }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-wrap">
        <input
          type="number"
          value={Number.isFinite(v) ? v : ''}
          step={step ?? 1}
          onChange={(e) => set(parseFloat(e.target.value))}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}
