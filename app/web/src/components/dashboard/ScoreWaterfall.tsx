import { useTx } from '../../lib/tx'
import type { ScoreResult, ReasonCode, Features } from '../../lib/api'

/**
 * The exact score decomposition. Our scorecard is *genuinely* additive —
 * `score = base_points + Σ reason_codes.points`, then clamped to 1..99 — so this
 * waterfall isn't a SHAP-style approximation over a black box: it **is** the model.
 * base → each signal's signed contribution → the final score, every bar tied to
 * the real feature value and its validated Information Value (Berka fit).
 */

const FEATURE_LABEL: Record<string, [string, string]> = {
  income_regularity: ['Income regularity', 'انتظام الدخل'],
  verified_income_share: ['Verified income', 'الدخل الموثّق'],
  nsf_count: ['Overdraft events', 'السحب على المكشوف'],
  income_expense_ratio: ['Income ÷ expense', 'الدخل ÷ المصروف'],
  min_balance: ['Minimum balance', 'أدنى رصيد'],
  balance_volatility: ['Balance volatility', 'تقلّب الرصيد'],
  recurring_obligation_load: ['Obligation load', 'عبء الالتزامات'],
  avg_balance: ['Average balance', 'متوسط الرصيد'],
}

const SAR_FEATURES = new Set(['min_balance', 'avg_balance'])
const INT_FEATURES = new Set(['nsf_count', 'months_observed'])
const PCT_FEATURES = new Set(['verified_income_share'])

function featureValue(feature: string | undefined, features?: Features | null): string | null {
  if (!feature || !features) return null
  const v = (features as unknown as Record<string, unknown>)[feature]
  if (typeof v !== 'number' || !isFinite(v)) return null
  if (SAR_FEATURES.has(feature)) return Math.round(v).toLocaleString('en-US')
  if (INT_FEATURES.has(feature)) return String(Math.round(v))
  if (PCT_FEATURES.has(feature)) return `${Math.round(v * 100)}%`
  return v.toFixed(2)
}

type Row =
  | { kind: 'base' | 'final'; from: number; to: number }
  | { kind: 'pos' | 'neg' | 'clamp'; from: number; to: number; code?: ReasonCode; delta: number }

export function ScoreWaterfall({ result }: { result: ScoreResult }) {
  const { tx } = useTx()
  const base = result.base_points ?? 20
  const codes = result.reason_codes ?? []

  // positives first (running total climbs), then negatives (it dips) → a readable cascade
  const positives = codes.filter((c) => c.points > 0).sort((a, b) => b.points - a.points)
  const negatives = codes.filter((c) => c.points < 0).sort((a, b) => a.points - b.points)
  const ordered = [...positives, ...negatives]

  const rawTotal = base + codes.reduce((s, c) => s + c.points, 0)
  const score = result.tabaqa_score
  const didClamp = rawTotal !== score // score = clamp(rawTotal, 1, 99)

  const rows: Row[] = [{ kind: 'base', from: 0, to: base }]
  let running = base
  for (const c of ordered) {
    const from = running
    running += c.points
    rows.push({ kind: c.points > 0 ? 'pos' : 'neg', from, to: running, code: c, delta: c.points })
  }
  if (didClamp) rows.push({ kind: 'clamp', from: running, to: score, delta: score - running })
  rows.push({ kind: 'final', from: 0, to: score })

  const axisMax = Math.max(99, rawTotal, base)
  const pctOf = (v: number) => `${(v / axisMax) * 100}%`

  return (
    <div className="wf">
      <div className="wf-head">
        <span className="ins-cap">{tx('How the score is built · exact decomposition', 'كيف تُبنى الدرجة · تفكيك دقيق')}</span>
        <span className="faint val-note">
          {tx(
            `base ${base} + each signal = ${score} · additive by design — no black box`,
            `الأساس ${base} + كل إشارة = ${score} · جمعية بالتصميم — دون صندوق أسود`,
          )}
        </span>
      </div>

      <div className="wf-rows">
        {rows.map((r, i) => {
          // narrow to the step variant (has code?/delta) so TS is happy
          const step = r.kind === 'pos' || r.kind === 'neg' || r.kind === 'clamp' ? r : null
          const isValued = r.kind === 'pos' || r.kind === 'neg'
          const lo = Math.min(r.from, r.to)
          const w = Math.max(0.8, Math.abs(r.to - r.from)) // never invisible
          const label =
            r.kind === 'base'
              ? tx('Base', 'الأساس')
              : r.kind === 'final'
                ? tx('Tabaqa Score', 'درجة Tabaqa')
                : r.kind === 'clamp'
                  ? tx('Capped at 1–99', 'محدود ضمن ١–٩٩')
                  : featureLabel(step?.code, tx)
          const val = isValued ? featureValue(step?.code?.feature, result.features) : null
          const iv = isValued ? step?.code?.iv : null
          const delta = step ? step.delta : null

          return (
            <div
              className={`wf-row wf-${r.kind}`}
              key={i}
              style={{ animationDelay: `${i * 0.07}s` }}
              title={isValued ? step?.code?.label : undefined}
            >
              <span className="wf-label">
                {label}
                {val != null && <span className="wf-val faint" dir="ltr"> {val}</span>}
                {iv != null && iv > 0 && <span className="wf-iv" title="Information Value (Berka fit)">IV {iv.toFixed(2)}</span>}
              </span>
              <span className="wf-track">
                <span
                  className="wf-bar"
                  style={{ insetInlineStart: pctOf(lo), width: pctOf(w) }}
                />
                {step && (
                  <span className="wf-tick" style={{ insetInlineStart: pctOf(r.to) }} aria-hidden />
                )}
              </span>
              <span className="wf-num" dir="ltr">
                {delta != null ? (delta >= 0 ? `+${delta}` : `${delta}`) : r.to}
              </span>
            </div>
          )
        })}
      </div>

      <p className="wf-foot faint">
        {tx(
          'Every point traces to one validated cash-flow feature (IV = its predictive strength on the Berka fit). The score is the sum — nothing hidden.',
          'كل نقطة تعود إلى خاصية تدفق نقدي مُتحقَّقة (IV = قوتها التنبؤية على بيانات Berka). الدرجة هي المجموع — لا شيء مخفي.',
        )}
      </p>
    </div>
  )
}

function featureLabel(code: ReasonCode | undefined, tx: (en: string, ar: string) => string): string {
  if (!code) return ''
  const m = code.feature ? FEATURE_LABEL[code.feature] : undefined
  return m ? tx(m[0], m[1]) : code.label
}
