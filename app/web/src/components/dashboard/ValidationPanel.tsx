import type { ReactNode } from 'react'
import { useTx } from '../../lib/tx'
import { VALIDATION } from '../../lib/validation'

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`

// friendly bilingual labels for the six cash-flow features
const FEATURE_LABEL: Record<string, [string, string]> = {
  balance_volatility: ['Balance volatility', 'تقلّب الرصيد'],
  income_regularity: ['Income regularity', 'انتظام الدخل'],
  recurring_obligation_load: ['Obligation load', 'عبء الالتزامات'],
  min_balance: ['Minimum balance', 'أدنى رصيد'],
  income_expense_ratio: ['Income ÷ expense', 'الدخل ÷ المصروف'],
  avg_balance: ['Average balance', 'متوسط الرصيد'],
  nsf_count: ['Overdraft events', 'السحب على المكشوف'],
}

function Metric({ big, cap, sub, hot }: { big: string; cap: string; sub: string; hot?: boolean }) {
  return (
    <div className={`val-metric${hot ? ' hot' : ''}`}>
      <div className="val-m-big">{big}</div>
      <span className="val-m-cap">{cap}</span>
      <span className="val-m-sub">{sub}</span>
    </div>
  )
}

function Foot({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="val-f">
      <span className="val-f-h">{icon} {title}</span>
      <span className="val-f-b">{body}</span>
    </div>
  )
}

/**
 * Model-validation panel — surfaces the real out-of-sample performance of the
 * Tabaqa cash-flow PD model (Berka / PKDD'99) inside the product, so the proof
 * is on screen instead of buried in eval/DATA_REPORT.md. All numbers are the
 * fixed validation results from eval/berka_train.py (see lib/validation.ts).
 */
export function ValidationPanel() {
  const { tx } = useTx()
  const v = VALIDATION
  const maxIv = Math.max(...v.features.map((f) => f.iv))
  const maxRate = Math.max(...v.bands.map((b) => b.rate))

  return (
    <div className="screen">
      <div className="ins-panel val-panel">
        <div className="ins-head">
          <div className="ins-title">
            <span className="ins-spark" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 3v5c0 4.6-3.1 7.6-7 9-3.9-1.4-7-4.4-7-9V6z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            <div>
              <h3>{tx('Model validation', 'التحقق من النموذج')}</h3>
              <span className="ins-sub faint">{tx('Out-of-sample performance on real default outcomes', 'الأداء خارج العينة على نتائج تعثّر حقيقية')}</span>
            </div>
          </div>
          <span className="ins-badge ai">{tx('Real data', 'بيانات حقيقية')} · {v.dataset}</span>
        </div>

        {/* headline metrics */}
        <div className="val-metrics">
          <Metric hot big={v.holdout.auc.toFixed(3)} cap={tx('AUC · out-of-sample', 'AUC · خارج العينة')} sub={tx(`5-fold CV ${v.cv.auc.toFixed(3)}`, `تحقق تقاطعي ${v.cv.auc.toFixed(3)}`)} />
          <Metric big={v.holdout.ks.toFixed(3)} cap={tx('KS separation', 'فصل KS')} sub={tx(`5-fold CV ${v.cv.ks.toFixed(3)}`, `تحقق تقاطعي ${v.cv.ks.toFixed(3)}`)} />
          <Metric big={v.accounts.toLocaleString('en-US')} cap={tx('Accounts tested', 'حسابات مُختبَرة')} sub={tx('real pre-loan history', 'سجل حقيقي قبل القرض')} />
          <Metric big={pct1(v.badRate)} cap={tx('Base default rate', 'معدل التعثر الأساسي')} sub={`${v.defaults} ${tx('real defaults', 'حالة تعثّر')}`} />
        </div>

        {/* monotonicity — default rate by score band */}
        <div className="val-block">
          <div className="val-block-h">
            <span className="ins-cap">{tx('Default rate by score band', 'معدل التعثر حسب شريحة الدرجة')}</span>
            <span className="faint val-note">{tx('default falls as the score rises — monotonic', 'التعثّر ينخفض كلما ارتفعت الدرجة — متناقص بانتظام')}</span>
          </div>
          <div className="val-bands">
            {v.bands.map((b) => (
              <div className="val-band" key={b.band}>
                <span className="val-band-v">{pct1(b.rate)}</span>
                <span className="val-bar-wrap">
                  <span
                    className={`val-bar${b.band === 5 ? ' good' : b.band === 1 ? ' bad' : ''}`}
                    style={{ height: `${Math.max(2, (b.rate / maxRate) * 100)}%` }}
                  />
                </span>
                <span className="val-band-l">
                  {b.band === 1 ? tx('1 · worst', '١ · الأسوأ') : b.band === 5 ? tx('5 · best', '٥ · الأفضل') : b.band}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* feature predictive power */}
        <div className="val-block">
          <div className="val-block-h">
            <span className="ins-cap">{tx('Feature predictive power · Information Value', 'القوة التنبؤية للميزات · قيمة المعلومات')}</span>
            <span className="faint val-note">{tx('IV > 0.1 = useful predictor', 'IV > 0.1 = متنبئ مفيد')}</span>
          </div>
          <div className="ins-rows">
            {v.features.map((f) => {
              const [en, ar] = FEATURE_LABEL[f.key] ?? [f.key, f.key]
              return (
                <div className="ins-row" key={f.key}>
                  <span className="ins-row-l val-feat">{tx(en, ar)}</span>
                  <span className="ins-row-bar">
                    <span style={{ width: `${Math.max(1.5, (f.iv / maxIv) * 100)}%` }} />
                  </span>
                  <span className="ins-row-v">{f.iv.toFixed(3)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* trust footnotes */}
        <div className="val-foot">
          <Foot icon="✓" title={tx('No black box', 'دون صندوق أسود')} body={tx('Transparent additive scorecard — every point traces to a feature and a reason code.', 'بطاقة تسجيل جمعية شفافة — كل نقطة تعود إلى ميزة وسبب واضح.')} />
          <Foot icon="🔬" title={tx('Proven mechanism', 'آلية مُثبتة')} body={tx('FinRegLab found cash-flow data predicts default as well as a bureau score — and adds signal on top.', 'وجدت FinRegLab أن بيانات التدفق النقدي تتنبأ بالتعثر كدرجة المكتب الائتماني — وتضيف إشارة فوقها.')} />
          <Foot icon="↻" title={tx('Reproducible', 'قابل للتكرار')} body={tx('Generated by eval/berka_train.py on public open data — no login, no private data.', 'مُولّد عبر eval/berka_train.py على بيانات عامة — دون تسجيل أو بيانات خاصة.')} />
        </div>

        <p className="val-caveat faint">
          {tx(
            'Trained on the public Berka / PKDD’99 dataset as a real-outcome proxy (no Saudi open dataset has real defaults). Production swaps in a WOE-binned scorecard on the lender’s own AIS history — same six features, same I/O contract. nsf_count shows zero IV here only because these accounts never overdraft.',
            'دُرّب على بيانات Berka / PKDD’99 العامة كبديل بنتائج حقيقية (لا تتوفر بيانات سعودية مفتوحة بنتائج تعثّر حقيقية). في الإنتاج تُستبدل ببطاقة تسجيل WOE على سجل البنك نفسه — نفس الميزات الست ونفس المدخلات والمخرجات. تظهر nsf_count بقيمة صفرية هنا فقط لأن هذه الحسابات لا تُسحب على المكشوف.',
          )}
        </p>
      </div>
    </div>
  )
}
