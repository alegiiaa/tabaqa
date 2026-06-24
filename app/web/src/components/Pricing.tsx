import { useI18n } from '../i18n/I18nContext'
import { Rich } from './Rich'

const PLANS = [
  { featured: false, h: 'p1.h', price: 'p1.price', d: 'p1.d', ul: 'p1.ul', a: 'p1.a', tag: null },
  { featured: false, h: 'p2.h', price: 'p2.price', d: 'p2.d', ul: 'p2.ul', a: 'p2.a', tag: null },
  { featured: true, h: 'p3.h', price: 'p3.price', d: 'p3.d', ul: 'p3.ul', a: 'p3.a', tag: 'p3.tag' },
]

export function Pricing() {
  const { t } = useI18n()
  return (
    <section id="pricing">
      <div className="wrap center">
        <div className="eyebrow">{t('price.eyebrow')}</div>
        <div className="h2">{t('price.h2')}</div>
        <Rich k="price.lead" as="p" className="lead" />
      </div>
      <div className="wrap">
        <div className="plans">
          {PLANS.map((p) => (
            <div className={p.featured ? 'plan fp' : 'plan'} key={p.h}>
              {p.tag && <span className="tagline">{t(p.tag)}</span>}
              <h3>{t(p.h)}</h3>
              <Rich k={p.price} as="div" className="price" />
              <p className="desc">{t(p.d)}</p>
              <Rich k={p.ul} as="ul" />
              <Rich k={p.a} as="p" className="analog" />
            </div>
          ))}
        </div>
        <Rich
          k="price.foot"
          as="p"
          className="faint center"
          style={{ fontSize: 13.5, marginTop: 28, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}
        />
      </div>
    </section>
  )
}
