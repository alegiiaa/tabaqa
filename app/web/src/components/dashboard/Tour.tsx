/** U4 · judge guided tour — a skippable 3-step coach mark that walks a timed
 * reviewer through the demo's spine: ① the reveal → ② the score → ③ lend
 * against it.
 *
 * Deliberately NOT an anchored spotlight: the card itself navigates the app to
 * the right section on each step, so there is nothing to mis-measure on any
 * viewport, and the page stays fully interactive — step ① asks the judge to
 * press the reveal button with their own hand, which is the moment we sell.
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
    section: 'income',
    title: ['The reveal', 'الكشف'],
    body: [
      'The bank-only view is a decline. Press “Reveal the wallet layer” — the hidden income appears, every source stamped with how it was verified.',
      'رؤية البنك وحدها = رفض. اضغط «اكشف طبقة المحفظة» — يظهر الدخل المخفي، وكل مصدر موسوم بطريقة توثيقه.',
    ],
  },
  {
    section: 'income',
    title: ['The score — a glass box', 'الدرجة — صندوق زجاجي'],
    body: [
      'Below the reveal sits the score. Every point comes from a named reason — tap any ⓘ and it explains itself. No black box.',
      'أسفل الكشف تجد الدرجة. كل نقطة لها سبب مسمّى — المس أي ⓘ لتشرح نفسها. لا صندوق أسود.',
    ],
  },
  {
    section: 'financing',
    title: ['Lend against it', 'الإقراض بناءً عليها'],
    body: [
      'The SAMA affordability check turns the score into a decision a bank can file — with a printable, QR-verifiable receipt.',
      'فحص الملاءة وفق «ساما» يحوّل الدرجة إلى قرار يمكن للبنك اعتماده — مع إيصال مطبوع يُتحقّق منه عبر رمز QR.',
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
