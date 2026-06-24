import { useI18n } from '../i18n/I18nContext'

const QA = [
  { q: 'q1.q', a: 'q1.a', open: true },
  { q: 'q2.q', a: 'q2.a', open: false },
  { q: 'q3.q', a: 'q3.a', open: false },
  { q: 'q4.q', a: 'q4.a', open: false },
  { q: 'q5.q', a: 'q5.a', open: false },
]

export function Faq() {
  const { t } = useI18n()
  return (
    <section id="faq" className="alt">
      <div className="wrap center">
        <div className="eyebrow">{t('faq.eyebrow')}</div>
        <div className="h2">{t('faq.h2')}</div>
      </div>
      <div className="wrap">
        <div className="faq">
          {QA.map((item) => (
            <details key={item.q} open={item.open}>
              <summary>
                <span>{t(item.q)}</span>
                <span className="pm" />
              </summary>
              <p>{t(item.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
