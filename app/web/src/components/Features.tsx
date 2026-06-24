import { useI18n } from '../i18n/I18nContext'
import { Rich } from './Rich'

const FEATURES = [
  { ic: '◳', t: 'f1.t', d: 'f1.d' },
  { ic: '⌥', t: 'f2.t', d: 'f2.d' },
  { ic: '✓', t: 'f3.t', d: 'f3.d' },
  { ic: 'ا', t: 'f4.t', d: 'f4.d' },
  { ic: '⚇', t: 'f5.t', d: 'f5.d' },
  { ic: '◷', t: 'f6.t', d: 'f6.d' },
]

export function Features() {
  const { t } = useI18n()
  return (
    <section>
      <div className="wrap center">
        <div className="eyebrow">{t('feat.eyebrow')}</div>
        <Rich k="feat.h2" as="div" className="h2" />
        <Rich k="feat.lead" as="p" className="lead" />
      </div>
      <div className="wrap">
        <div className="grid g3">
          {FEATURES.map((f) => (
            <div className="feat" key={f.t}>
              <div className="ic">{f.ic}</div>
              <h3>{t(f.t)}</h3>
              <p>{t(f.d)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
