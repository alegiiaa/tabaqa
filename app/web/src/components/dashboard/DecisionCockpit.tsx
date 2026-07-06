/** U2 · Decision Cockpit — the one screen a credit officer could paste into a
 * memo: reveal delta → gauge → decision → affordability → top reasons.
 *
 * Pure recomposition: the numbers come from the score result already on hand
 * plus one call to the same affordability engine that powers the ④ tab and
 * prints the compliance receipt — standard terms, SAMA employee cap. Nothing
 * here is computed a second way.
 */
import { useEffect, useState } from 'react'
import { useTx } from '../../lib/tx'
import { api, type ScoreResult, type AffordabilityResult } from '../../lib/api'
import { featureLabel, featureValue } from './ScoreWaterfall'
import { InfoTip } from '../ui/InfoTip'
import { dualDate } from '../../lib/dates'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

// The standard demo terms — the same defaults the ④ Affordability tab opens with.
export const MEMO_TERMS = { amount: 60000, tenor: 48, rate: 0.1 }

export function DecisionCockpit({
  result,
  name,
  onOpenAfford,
}: {
  result: ScoreResult
  name?: string
  onOpenAfford?: () => void
}) {
  const { tx, dir } = useTx()
  const SAR = tx('SAR', 'ر.س')
  const inc = result.income

  const [out, setOut] = useState<AffordabilityResult | null>(null)
  const [failed, setFailed] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let on = true
    setFailed(false)
    const obligations = result.features
      ? Math.round(result.features.recurring_obligation_load * inc.true_monthly_income)
      : 0
    api
      .affordability({
        verified_income: inc.true_monthly_income,
        bank_only_income: inc.bank_only_income,
        risk_flag: result.risk_flag,
        amount: MEMO_TERMS.amount,
        tenor_months: MEMO_TERMS.tenor,
        annual_rate: MEMO_TERMS.rate,
        existing_obligations: obligations,
        customer_type: 'employee',
      })
      .then((r) => { if (on) setOut(r) })
      .catch(() => { if (on) setFailed(true) })
    return () => { on = false }
  }, [result, inc.bank_only_income, inc.true_monthly_income, nonce])

  const decisionLabel = (d: string) =>
    d === 'APPROVE' ? tx('APPROVE', 'موافقة') : d === 'REVIEW' ? tx('REVIEW', 'مراجعة') : tx('DECLINE', 'رفض')
  const decisionCls = (d: string) =>
    d === 'APPROVE' ? 'ok' : d === 'REVIEW' ? 'warn' : 'bad'

  // Top reasons by absolute contribution — strongest supports, then the drags.
  const codes = (result.reason_codes ?? []).slice()
  const supports = codes.filter((c) => c.points > 0).sort((a, b) => b.points - a.points).slice(0, 3)
  const drags = codes.filter((c) => c.points < 0).sort((a, b) => a.points - b.points).slice(0, 2)
  const topReasons = [...supports, ...drags]

  const today = dualDate(new Date().toISOString(), dir === 'rtl')

  return (
    <div className="screen memo">
      {/* ── memo header: who, when, and the verdict ── */}
      <div className="memo-head">
        <div className="memo-id">
          <span className="ins-cap">{tx('Decision memo', 'مذكرة القرار')}</span>
          <strong className="memo-name" dir="auto">{name ?? (result.applicant?.name as string) ?? tx('Applicant', 'المتقدم')}</strong>
          <span className="faint small">
            <span dir="ltr">{today.greg}</span>
            {today.hijri && <span className="hijri-chip">{today.hijri}</span>}
          </span>
        </div>
        {out ? (
          <div className={`memo-verdict ${decisionCls(out.decision)}`}>
            <span className="memo-verdict-word">{decisionLabel(out.decision)}</span>
            <span className="memo-verdict-sub">
              {tx('max financing', 'أقصى تمويل')} <b dir="ltr">{fmt(out.max_financing)}</b> {SAR}
            </span>
          </div>
        ) : failed ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setNonce((n) => n + 1)}>
            {tx('Decision engine unreachable — retry', 'تعذّر الوصول لمحرك القرار — أعد المحاولة')}
          </button>
        ) : (
          <div className="skel" style={{ height: 58, width: 190 }} />
        )}
      </div>

      {/* ── the three memo panels: reveal → score → affordability ── */}
      <div className="memo-grid">
        <div className="memo-panel">
          <span className="ins-cap">{tx('Income · the reveal', 'الدخل · الكشف')}</span>
          <div className="memo-reveal">
            <span className="memo-rev-from" dir="ltr">{fmt(inc.bank_only_income)}</span>
            <span className="memo-rev-arr">{dir === 'rtl' ? '←' : '→'}</span>
            <span className="memo-rev-to accent-num" dir="ltr">{fmt(inc.true_monthly_income)}</span>
            <span className="faint small">{SAR}/{tx('mo', 'شهر')}</span>
          </div>
          <div className="memo-panel-foot">
            <span className="tag t-ok" dir="ltr">+{fmt(inc.reveal_delta)}</span>
            <span className="faint small">
              {tx('verified share', 'النسبة الموثّقة')} <b>{pct(inc.verified_share)}</b>
              <InfoTip k="verified_share" />
            </span>
          </div>
        </div>

        <div className="memo-panel">
          <span className="ins-cap">{tx('Tabaqa score', 'درجة Tabaqa')}</span>
          <div className="memo-score">
            <MiniGauge score={result.tabaqa_score} />
            <div className="memo-score-meta">
              <span className={`risk-pill ${result.risk_flag === 'low' ? 'ok' : result.risk_flag === 'medium' ? 'warn' : 'bad'}`}>
                {result.risk_flag === 'low' ? tx('low risk', 'مخاطر منخفضة') : result.risk_flag === 'medium' ? tx('medium risk', 'مخاطر متوسطة') : tx('high risk', 'مخاطر مرتفعة')}
              </span>
              <span className="faint small" dir="ltr">PD {pct(result.pd)}<InfoTip k="pd" /></span>
            </div>
          </div>
        </div>

        <div className="memo-panel">
          <span className="ins-cap">{tx('Affordability · SAMA', 'الملاءة · ساما')}</span>
          {out ? (
            <>
              <div className="memo-afford">
                <div className="memo-kv">
                  <span className="faint small">{tx('Installment', 'القسط')}</span>
                  <b dir="ltr">{fmt(out.installment)} <small>{SAR}</small></b>
                </div>
                <div className="memo-kv">
                  <span className="faint small">{tx('DBR after', 'نسبة الدين بعد')}<InfoTip k="dbr" /></span>
                  <b dir="ltr">{pct(out.dbr_after)} <small>/ {pct(out.dbr_cap)}</small></b>
                </div>
              </div>
              {out.dbr_policy && (
                <div className="memo-panel-foot faint small">{out.dbr_policy.label} · {out.dbr_policy.citation}</div>
              )}
            </>
          ) : (
            <div className="skel" style={{ height: 64 }} />
          )}
        </div>
      </div>

      {/* ── top reasons, signed — the memo's "because" ── */}
      {topReasons.length > 0 && (
        <div className="memo-panel memo-reasons">
          <span className="ins-cap">{tx('Top reasons · exact points', 'أهم الأسباب · نقاط دقيقة')}</span>
          <div className="memo-reason-rows">
            {topReasons.map((c) => {
              const val = featureValue(c.feature, result.features)
              return (
                <div className="memo-reason" key={c.code} title={c.label}>
                  <span className={`memo-pts ${c.points > 0 ? 'pos' : 'neg'}`} dir="ltr">
                    {c.points > 0 ? `+${c.points}` : c.points}
                  </span>
                  <span>
                    {featureLabel(c, tx)}
                    {val != null && <span className="faint" dir="ltr"> · {val}</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── provenance + terms: what a reviewer needs to trust the page ── */}
      <div className="memo-foot">
        <span>
          ✓ {tx('Scored by the validated engine — every point traceable in tab ②', 'مُقيَّم بالمحرك المُتحقَّق — كل نقطة قابلة للتتبع في تبويب ②')}
        </span>
        <span className="faint">
          {tx('Terms', 'الشروط')}: <span dir="ltr">{fmt(MEMO_TERMS.amount)}</span> {SAR} · <span dir="ltr">{MEMO_TERMS.tenor}</span> {tx('mo', 'شهرًا')} · <span dir="ltr">{(MEMO_TERMS.rate * 100).toFixed(0)}%</span>
          {onOpenAfford && (
            <>
              {' — '}
              <button className="mm-link" onClick={onOpenAfford}>
                {tx('adjust in ④ Affordability', 'عدّلها في ④ القدرة على السداد')}
              </button>
            </>
          )}
        </span>
      </div>
    </div>
  )
}

// Compact score dial — same visual language as the ② tab's gauge, memo-sized.
function MiniGauge({ score }: { score: number }) {
  const { tx } = useTx()
  const R = 42
  const C = 2 * Math.PI * R
  const offset = C * (1 - Math.max(1, Math.min(99, score)) / 99)
  return (
    <div className="gauge gauge-mini">
      <svg width="104" height="104" viewBox="0 0 104 104" aria-label={`Tabaqa score ${score}`}>
        <circle cx="52" cy="52" r={R} stroke="rgba(12,18,38,.08)" strokeWidth="9" fill="none" />
        <circle
          cx="52" cy="52" r={R} stroke="url(#sg-mini)" strokeWidth="9" fill="none"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="sg-mini" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ctr">
        <div className="num">{score}</div>
        <div className="lab">{tx('of 99', 'من ٩٩')}</div>
      </div>
    </div>
  )
}
