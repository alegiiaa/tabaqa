import { useI18n } from '../i18n/I18nContext'

const STEPS = [
  { n: '01', t: 's1.t', d: 's1.d' },
  { n: '02', t: 's2.t', d: 's2.d' },
  { n: '03', t: 's3.t', d: 's3.d' },
]

export function HowItWorks() {
  const { t } = useI18n()
  return (
    <section id="how" className="alt">
      <div className="wrap center">
        <div className="eyebrow">{t('how.eyebrow')}</div>
        <div className="h2">{t('how.h2')}</div>
        <p className="lead">{t('how.lead')}</p>
      </div>
      <div className="wrap">
        <div className="steps">
          {STEPS.map((s) => (
            <div className="stepcard" key={s.n}>
              <div className="n">{s.n}</div>
              <h3>{t(s.t)}</h3>
              <p>{t(s.d)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
