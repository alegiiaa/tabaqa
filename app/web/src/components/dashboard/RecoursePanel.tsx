import { useTx } from '../../lib/tx'
import type { Recourse, RecourseStep } from '../../lib/api'

/**
 * D2 · Path to approval — the actionable counterfactual. Because we know each
 * feature's bins, points, and the band cutoffs, we can compute the *fewest*
 * changes that lift the score into the next risk band (→ REVIEW or → APPROVE)
 * and show them as recourse. A decline becomes a coaching tool, not a black-box no.
 * verified_income_share (connect another account) is Tabaqa's own lever, so it
 * leads whenever it helps.
 *
 * P7 guardrail (scoring/scorecard.py RECOURSE_ELIGIBLE): the API only ever coaches
 * levers that lower TRUE risk — spoofable ones (income timing, balance smoothing)
 * are never recommended, projections are labelled indicative, and the served
 * `note` disclaimer is rendered below the steps.
 */

type Tx = (en: string, ar: string) => string

const ACTION: Record<string, [string, string]> = {
  verified_income_share: ['Verify more income — connect another account', 'وثّق المزيد من الدخل — اربط حسابًا آخر'],
  nsf_count: ['Avoid overdrafts', 'تجنّب السحب على المكشوف'],
  min_balance: ['Keep a positive balance buffer', 'احتفظ برصيد احتياطي موجب'],
  balance_volatility: ['Steady your account balance', 'ثبّت رصيد حسابك'],
  income_expense_ratio: ['Spend under your income', 'أنفق أقل من دخلك'],
  recurring_obligation_load: ['Reduce recurring debt', 'قلّل الديون المتكررة'],
  income_regularity: ['Receive income on a regular schedule', 'استلم الدخل بجدول منتظم'],
}

const cmp = (c: string) => (c === '>=' ? '≥' : c === '<=' ? '≤' : c)

function fmtValue(feature: string, v: number, tx: Tx): string {
  if (feature === 'verified_income_share' || feature === 'recurring_obligation_load') return `${Math.round(v * 100)}%`
  if (feature === 'min_balance') return `${tx('SAR', 'ر.س')} ${Math.round(v).toLocaleString('en-US')}`
  if (feature === 'nsf_count') return String(Math.round(v))
  if (feature === 'income_expense_ratio') return `${v.toFixed(1)}×`
  return v.toFixed(2)
}

const action = (feature: string, tx: Tx) => {
  const a = ACTION[feature]
  return a ? tx(a[0], a[1]) : feature
}
const decisionLabel = (d: string, tx: Tx) =>
  d === 'APPROVE' ? tx('APPROVE', 'موافقة') : d === 'REVIEW' ? tx('REVIEW', 'مراجعة') : d

export function RecoursePanel({ recourse }: { recourse?: Recourse | null }) {
  const { tx } = useTx()
  if (!recourse) return null

  if (recourse.already_prime) {
    return (
      <div className="rec rec-prime" role="status">
        <span className="rec-prime-badge">✓ {tx('Prime', 'ممتاز')}</span>
        <span className="rec-prime-msg">
          {tx('This profile already qualifies for approval — no action needed.',
            'هذا الملف مؤهّل للموافقة بالفعل — لا يلزم أي إجراء.')}
        </span>
      </div>
    )
  }

  const { current_score, target_score, projected_score, target_decision, reachable, steps } = recourse
  const AX = 99
  const dWord = decisionLabel(target_decision, tx)
  const title = target_decision === 'APPROVE'
    ? tx('Path to approval', 'الطريق إلى الموافقة')
    : tx('Path out of decline', 'الطريق للخروج من الرفض')

  return (
    <div className="rec">
      <div className="rec-head">
        <span className="ins-cap">{title}</span>
        <span className="faint val-note">{tx('the smallest change that moves the decision', 'أصغر تغيير يُحرّك القرار')}</span>
      </div>

      <div className="rec-prog" aria-hidden>
        <span className="rec-prog-now" style={{ width: `${(current_score / AX) * 100}%` }} />
        {reachable && (
          <span
            className="rec-prog-gain"
            style={{ insetInlineStart: `${(current_score / AX) * 100}%`, width: `${(Math.max(0, projected_score - current_score) / AX) * 100}%` }}
          />
        )}
        <span className="rec-prog-target" style={{ insetInlineStart: `${(target_score / AX) * 100}%` }} />
      </div>
      <div className="rec-prog-cap">
        <span dir="ltr" className="rec-now-v">{current_score}</span>
        <span className="faint">
          {tx('reach', 'اوصل إلى')} <b dir="ltr">{target_score}</b> {tx('for', 'من أجل')} <b>{dWord}</b>
        </span>
      </div>

      <div className="rec-steps">
        {steps.map((s: RecourseStep) => (
          <div className="rec-step" key={s.feature}>
            <span className="rec-step-ic" aria-hidden>↗</span>
            <span className="rec-step-body">
              <span className="rec-step-action">{action(s.feature, tx)}</span>
              <span className="rec-step-meta faint">
                {s.current_value != null && (
                  <>{tx('now', 'الآن')} <span dir="ltr">{fmtValue(s.feature, s.current_value, tx)}</span> · </>
                )}
                {tx('target', 'الهدف')} <span dir="ltr">{cmp(s.comparator)} {fmtValue(s.feature, s.target_value, tx)}</span>
              </span>
            </span>
            <span className="rec-step-gain" dir="ltr">+{s.gain}</span>
          </div>
        ))}
      </div>

      <p className={`rec-foot${reachable ? '' : ' rec-foot-warn'}`}>
        {reachable
          ? tx(`Do the above → indicative score ≈ ${projected_score} · clears ${dWord}.`,
              `بتطبيق ما سبق → درجة استرشادية ≈ ${projected_score} · تتجاوز حدّ ${dWord}.`)
          : tx(`Even at best practice on all of these, this profile reaches only ≈ ${projected_score} — still short of the ${target_score} needed. It needs more than incremental change.`,
              `حتى بأفضل الممارسات في كل ما سبق، يصل هذا الملف إلى ≈ ${projected_score} فقط — دون ${target_score} المطلوبة. يحتاج أكثر من تحسين تدريجي.`)}
      </p>

      <p className="faint val-note">
        {tx('Indicative, not a promise — every suggestion is a real risk-lowering behaviour (never a cosmetic tweak), and the decision is re-scored on verified data.',
          'استرشادي وليس وعدًا — كل اقتراح سلوك حقيقي يخفّض المخاطر (لا تجميل للأرقام)، ويُعاد احتساب القرار على بيانات موثّقة.')}
      </p>
    </div>
  )
}
