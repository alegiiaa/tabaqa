/** U4 · judge guided tour — a skippable 3-step coach mark that walks a timed
 * reviewer through the demo's spine: ① the offers → ② the reveal behind them →
 * ③ apply, with proof. Offers-first, like the app and the pitch: the product is
 * the financing, and the score is one input into it.
 *
 * Deliberately NOT an anchored spotlight: the card itself navigates the app to
 * the right section on each step, so there is nothing to mis-measure on any
 * viewport, and the page stays fully interactive — the judge presses the search
 * and reveal buttons with their own hand, which is the moment we sell.
 */
import { useEffect, useState } from 'react'
import { useTx } from '../../lib/tx'
import type { Section } from './DashboardLayout'

const SEEN_KEY = 'tabaqa.tour.v1'

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === 'done'
  } catch {
    return true // storage unavailable → never auto-open, replay button still works
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, 'done')
  } catch {
    /* ignore */
  }
}

interface Step {
  section: Section
  title: [en: string, ar: string]
  body: [en: string, ar: string]
}

const STEPS: Step[] = [
  {
    section: 'financing',
    title: ['Offers, not a score', 'عروض، لا درجة'],
    body: [
      'This is the marketplace — press “Search offers”. Every lender’s published policy runs against your verified income, and the offers come back ranked. On bank-only income, the same search returns zero full offers.',
      'هذا سوق التمويل — اضغط «ابحث عن العروض». تُطبَّق سياسة كل جهة تمويلية على دخلك الموثّق، وتعود العروض مرتّبة. وبدخل البنك وحده، البحث نفسه لا يعيد أي عرض كامل.',
    ],
  },
  {
    section: 'income',
    title: ['Why those offers exist', 'لماذا وُجدت هذه العروض'],
    body: [
      'Press “Reveal the wallet layer” — the hidden income appears, every source stamped with how it was verified. Below it sits the score: one input into your pricing, every point from a named reason. No black box.',
      'اضغط «اكشف طبقة المحفظة» — يظهر الدخل المخفي، وكل مصدر موسوم بطريقة توثيقه. وأسفله الدرجة: أحد مدخلات تسعيرك، وكل نقطة لها سبب مسمّى. لا صندوق أسود.',
    ],
  },
  {
    section: 'financing',
    title: ['Apply — the lender gets proof', 'قدّم الطلب — والجهة تستلم الدليل'],
    body: [
      'Pick an offer and apply: the lender receives a SAMA-checked package with a printable, QR-verifiable compliance receipt. The final credit decision always stays with the licensed lender.',
      'اختر عرضًا وقدّم: تستلم الجهة التمويلية حزمة مفحوصة وفق «ساما» مع إيصال امتثال مطبوع يُتحقّق منه عبر رمز QR. ويبقى القرار الائتماني النهائي دائمًا للجهة المرخّصة.',
    ],
  },
]

export function JudgeTour({
  onNavigate,
  onClose,
}: {
  onNavigate: (s: Section) => void
  onClose: () => void
}) {
  const { tx, dir } = useTx()
  const [step, setStep] = useState(0)

  // The card drives the app: entering a step lands the judge on its section,
  // scrolled to the top so the thing the copy points at is in view.
  useEffect(() => {
    onNavigate(STEPS[step].section)
    window.scrollTo({ top: 0 })
  }, [step, onNavigate])

  const s = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <div className="tour-card" role="dialog" aria-label={tx('Guided tour', 'جولة إرشادية')} dir={dir}>
      <div className="tour-cap">
        <span>{tx('Guided tour', 'جولة إرشادية')}</span>
        <span dir="ltr">{step + 1} / {STEPS.length}</span>
      </div>
      <div className="tour-title">{tx(s.title[0], s.title[1])}</div>
      <div className="tour-body">{tx(s.body[0], s.body[1])}</div>
      <div className="tour-row">
        <span className="tour-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={`tour-dot${i === step ? ' on' : ''}`} />
          ))}
        </span>
        <button className="tour-btn ghost" onClick={onClose}>
          {tx('Skip', 'تخطٍّ')}
        </button>
        {step > 0 && (
          <button className="tour-btn ghost" onClick={() => setStep(step - 1)}>
            {tx('Back', 'رجوع')}
          </button>
        )}
        <button
          className="tour-btn pri"
          onClick={() => (last ? onClose() : setStep(step + 1))}
        >
          {last ? tx('Done', 'تم') : tx('Next', 'التالي')}
        </button>
      </div>
    </div>
  )
}
