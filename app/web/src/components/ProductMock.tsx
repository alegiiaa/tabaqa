import { Rich } from './Rich'
import { useI18n } from '../i18n/I18nContext'

export function ProductMock() {
  const { t } = useI18n()
  return (
    <section className="hero" id="intro" style={{ paddingTop: 60 }}>
      <div className="hero-glow" />
      <div className="wrap">
        <div className="rails" style={{ marginTop: 0 }}>
          <span className="cap">{t('rails.cap')}</span>
          <Rich k="rails.row" as="div" className="row" />
        </div>
      </div>

      <div className="wrap">
        <div className="mockvid-head">
          <h3>{t('mock.vidcap')}</h3>
          <p>{t('mock.vidsub')}</p>
        </div>
        <div className="mockvid" id="product">
          <video
            className="mockvid-el"
            src="/video/tabaqa-demo.mp4"
            poster="/video/tabaqa-demo-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />
        </div>
      </div>
    </section>
  )
}
