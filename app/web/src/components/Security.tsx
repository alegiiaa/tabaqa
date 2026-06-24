import { useI18n } from '../i18n/I18nContext'
import { Rich } from './Rich'

const ROWS = [
  { l: 'sec.l1', v: 'sec.v1', b: false },
  { l: 'sec.l2', v: 'sec.v2', b: false },
  { l: 'sec.l3', v: 'sec.v3', b: true },
  { l: 'sec.l4', v: 'sec.v4', b: true },
  { l: 'sec.l5', v: 'sec.v5', b: true },
]

export function Security() {
  const { t } = useI18n()
  return (
    <section id="security">
      <div className="wrap split">
        <div>
          <div className="eyebrow">{t('sec.eyebrow')}</div>
          <Rich k="sec.h2" as="div" className="h2" />
          <Rich k="sec.lead" as="p" className="lead" style={{ marginTop: 18 }} />
        </div>
        <div className="seclist">
          {ROWS.map((r) => (
            <div className="li" key={r.l}>
              <span>{t(r.l)}</span>
              <span className={r.b ? 'ok b' : 'ok'}>{t(r.v)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
