import { useTx } from '../../lib/tx'
import type { ScoreConfidence, Benchmark, FeaturePercentile } from '../../lib/api'

/**
 * D3 · Score confidence — an honest data-sufficiency band. A score built on 6 months
 * of mostly-verified income is far more reliable than one on 30 days of inferred income;
 * we widen the ± band as history shortens and verification drops. Labelled as a
 * data-sufficiency signal, NOT a statistical confidence interval.
 *
 * D5 · Benchmark — places the applicant in the 1M-account synthetic corpus, turning the
 * corpus from a static stat into a live ruler ("steadier balance than 69% of the book").
 */

type Tx = (en: string, ar: string) => string

const FEATURE_LABEL: Record<string, [string, string]> = {
  income_regularity: ['Income regularity', 'انتظام الدخل'],
  income_expense_ratio: ['Income ÷ expense', 'الدخل ÷ المصروف'],
  min_balance: ['Minimum balance', 'أدنى رصيد'],
  nsf_count: ['Overdraft events', 'السحب على المكشوف'],
  recurring_obligation_load: ['Obligation load', 'عبء الالتزامات'],
  balance_volatility: ['Balance volatility', 'تقلّب الرصيد'],
}

function fmtValue(feature: string, v: number, tx: Tx): string {
  if (feature === 'recurring_obligation_load') return `${Math.round(v * 100)}%`
  if (feature === 'min_balance') return `${tx('SAR', 'ر.س')} ${Math.round(v).toLocaleString('en-US')}`
  if (feature === 'nsf_count') return String(Math.round(v))
  if (feature === 'income_expense_ratio') return `${v.toFixed(1)}×`
  return v.toFixed(2)
}

const label = (f: string, tx: Tx) => {
  const m = FEATURE_LABEL[f]
  return m ? tx(m[0], m[1]) : f
}

// ── D3 ───────────────────────────────────────────────────────────────────────
export function ConfidenceBadge({ confidence }: { confidence?: ScoreConfidence | null }) {
  const { tx } = useTx()
  if (!confidence) return null
  const { level, low, high, band, months_observed, verified_income_share } = confidence
  const levelLabel =
    level === 'high' ? tx('High confidence', 'ثقة عالية')
    : level === 'medium' ? tx('Medium confidence', 'ثقة متوسطة')
    : tx('Low confidence', 'ثقة منخفضة')
  return (
    <div className={`conf conf-${level}`} title={tx(
      'Reflects how much history and verification back this score — a data-sufficiency signal, not a statistical confidence interval.',
      'يعكس مقدار السجل والتحقّق الداعمين لهذه الدرجة — إشارة كفاية بيانات، لا فاصل ثقة إحصائي.',
    )}>
      <div className="conf-top">
        <span className="conf-dot" />
        <span className="conf-level">{levelLabel}</span>
        <span className="conf-range" dir="ltr">{low}–{high} <span className="faint">(±{band})</span></span>
      </div>
      <div className="conf-drivers faint">
        <span dir="ltr">{months_observed}</span> {tx('mo history', 'شهر سجل')} ·{' '}
        <span dir="ltr">{Math.round(verified_income_share * 100)}%</span> {tx('verified', 'موثّق')}
      </div>
    </div>
  )
}

// ── D5 ───────────────────────────────────────────────────────────────────────
export function BenchmarkPanel({ benchmark }: { benchmark?: Benchmark | null }) {
  const { tx } = useTx()
  if (!benchmark?.available || benchmark.features.length === 0) return null
  return (
    <div className="bench">
      <div className="bench-head">
        <span className="ins-cap">{tx('Versus the book', 'مقارنةً بالسوق')}</span>
        <span className="faint val-note">
          {tx(`percentile across ${(benchmark.n / 1_000_000).toFixed(0)}M real-behaviour accounts`,
            `المئين عبر ${(benchmark.n / 1_000_000).toFixed(0)} مليون حساب حقيقي السلوك`)}
        </span>
      </div>
      <div className="bench-rows">
        {benchmark.features.map((f: FeaturePercentile) => (
          <div className="bench-row" key={f.feature}>
            <span className="bench-label">
              {label(f.feature, tx)}
              <span className="bench-val faint" dir="ltr"> {fmtValue(f.feature, f.value, tx)}</span>
            </span>
            <span className="bench-track">
              <span className="bench-fill" style={{ width: `${f.better_than}%` }} />
              <span className="bench-dot" style={{ insetInlineStart: `${f.better_than}%` }} />
            </span>
            <span className="bench-pct" dir="ltr">{tx('beats', 'يتفوّق على')} {f.better_than}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
