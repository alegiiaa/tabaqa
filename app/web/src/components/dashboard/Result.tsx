import { useState } from 'react'
import { useTx } from '../../lib/tx'
import { api, type ScoreResult, type AffordabilityResult, type Transaction } from '../../lib/api'

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
function useTierTag() {
  const { tx } = useTx()
  return (v: string) => {
    if (v === 'amount_verified') return { cls: 't-ok', label: tx('✓ amount verified', '✓ مبلغ موثّق') }
    if (v === 'source_verified') return { cls: 't-src', label: tx('✓ source verified', '✓ مصدر موثّق') }
    return { cls: 't-inf', label: tx('inferred', 'مُستنتج') }
  }
}

// ── ① the reveal ────────────────────────────────────────────────────────────
function RevealScreen({ result }: { result: ScoreResult }) {
  const { tx } = useTx()
  const tierTag = useTierTag()
  const inc = result.income
  const SAR = tx('SAR', 'ر.س')
  const reconciled = result.transactions.some((t) => t.txn_type === 'internal_movement')

  return (
    <div className="screen">
      <div className="reveal-cards">
        <div className="reveal-card muted-card">
          <div className="reveal-cap">{tx('Bank-only view', 'رؤية البنك فقط')}</div>
          <div className="reveal-big faint">{fmt(inc.bank_only_income)}</div>
          <div className="reveal-unit">{SAR} / {tx('mo', 'شهر')}</div>
        </div>
        <div className="reveal-arrow">→</div>
        <div className="reveal-card hot-card">
          <div className="reveal-cap">{tx('Tabaqa — true income', 'Tabaqa — الدخل الحقيقي')}</div>
          <div className="reveal-big accent-num">{fmt(inc.true_monthly_income)}</div>
          <div className="reveal-unit">{SAR} / {tx('mo', 'شهر')}</div>
        </div>
      </div>

      <div className="reveal-delta">
        <span className="dot" />
        {tx('Revealed', 'مكشوف')}: <b>+{fmt(inc.reveal_delta)} {SAR}</b> ·{' '}
        {tx('verified share', 'النسبة الموثّقة')} <b>{pct(inc.verified_share)}</b>
      </div>

      <div className="rc" style={{ marginTop: 18 }}>
        <div className="h">{tx('Income breakdown · 3-tier verification', 'تفصيل الدخل · تحقّق ثلاثي')}</div>
        {inc.components.map((c, i) => {
          const tag = tierTag(c.verification)
          return (
            <div className="row2" key={i}>
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
        <div className="note-line">
          {tx(
            'Bank ↔ Barq transfer detected and marked internal — not double-counted.',
            'تم رصد تحويل بين البنك ومحفظة برق ووسمه داخليًا — دون احتساب مزدوج.',
          )}
        </div>
      )}
    </div>
  )
}

// ── ② the score ─────────────────────────────────────────────────────────────
function ScoreScreen({ result }: { result: ScoreResult }) {
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

  const pos = result.reason_codes.filter((r) => r.polarity === 'positive')
  const neg = result.reason_codes.filter((r) => r.polarity === 'negative')

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
          {riskLabel} · PD {pct(result.pd)}
        </div>
      </div>

      <div className="score-right">
        <div className="rc">
          <div className="h">{tx('Why — positive', 'الأسباب — إيجابية')}</div>
          {pos.length === 0 && <div className="faint small">{tx('none', 'لا يوجد')}</div>}
          {pos.map((r, i) => (
            <div className="row2" key={i}>
              <span>{r.label}</span>
              <b className="pts-pos">+{r.points}</b>
            </div>
          ))}
          <div className="h" style={{ marginTop: 12 }}>{tx('Why — negative', 'الأسباب — سلبية')}</div>
          {neg.length === 0 && <div className="faint small">{tx('none', 'لا يوجد')}</div>}
          {neg.map((r, i) => (
            <div className="row2" key={i}>
              <span>{r.label}</span>
              <b className="pts-neg">{r.points}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── ③ the ledger ────────────────────────────────────────────────────────────
function LedgerScreen({ txns }: { txns: Transaction[] }) {
  const { tx } = useTx()
  const tierTag = useTierTag()
  const sorted = txns.slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))

  return (
    <div className="screen">
      <div className="rc">
        <div className="h">
          {tx('Unified ledger · bank + wallet', 'السجل الموحّد · البنك + المحفظة')} ({txns.length})
        </div>
        <div className="ledger-scroll">
          <table className="ledger">
            <thead>
              <tr>
                <th>{tx('Source', 'المصدر')}</th>
                <th>{tx('Date', 'التاريخ')}</th>
                <th>{tx('Description', 'الوصف')}</th>
                <th className="num-col">{tx('Amount', 'المبلغ')}</th>
                <th>{tx('Type', 'النوع')}</th>
                <th>{tx('Provenance', 'التوثيق')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => {
                const isWallet = t.source.startsWith('wallet:')
                const inflow = t.direction === 'inflow'
                const incomeRow = ['salary', 'gig_income', 'p2p'].includes(t.txn_type)
                const tag = incomeRow ? tierTag(t.verification) : null
                return (
                  <tr key={i}>
                    <td>
                      <span className={`src-badge ${isWallet ? 'w' : 'b'}`}>
                        {isWallet ? tx('Wallet', 'محفظة') : tx('Bank', 'بنك')}
                      </span>
                    </td>
                    <td className="faint">{t.timestamp.slice(0, 10)}</td>
                    <td>
                      <div>{t.raw_desc}</div>
                      {t.merchant && <div className="faint small">→ {t.merchant}</div>}
                    </td>
                    <td className={`num-col ${inflow ? 'pos' : 'neg'}`}>
                      {inflow ? '+' : '−'}{fmt(t.amount)}
                    </td>
                    <td className="faint small">{t.txn_type}</td>
                    <td>{tag && <span className={`tag ${tag.cls}`}>{tag.label}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── ④ affordability ─────────────────────────────────────────────────────────
function AffordScreen({ result }: { result: ScoreResult }) {
  const { tx } = useTx()
  const SAR = tx('SAR', 'ر.س')
  const defaultObl = result.features
    ? Math.round(result.features.recurring_obligation_load * result.income.true_monthly_income)
    : 0

  const [amount, setAmount] = useState(60000)
  const [tenor, setTenor] = useState(48)
  const [rate, setRate] = useState(10) // percent
  const [obligations, setObligations] = useState(defaultObl)
  const [cap, setCap] = useState(33) // percent
  const [out, setOut] = useState<AffordabilityResult | null>(null)
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
        dbr_cap: cap / 100,
      })
      setOut(r)
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
        <Field label={tx('DBR cap %', 'سقف نسبة الدين %')} v={cap} set={setCap} />
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
