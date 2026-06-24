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
        <div className="mock" id="product">
          <div className="mockbar">
            <i /><i /><i />
            <span className="t">tabaqa.app / score / applicant_8842 · Fahd A.</span>
          </div>
          <div className="mockbody">
            <div className="mcol left">
              <div className="gauge">
                <svg width="188" height="188" viewBox="0 0 188 188" aria-label="Tabaqa score 82">
                  <circle cx="94" cy="94" r="79" stroke="rgba(12,18,38,.08)" strokeWidth="12" fill="none" />
                  <circle
                    cx="94" cy="94" r="79" stroke="url(#g)" strokeWidth="12" fill="none"
                    strokeLinecap="round" strokeDasharray="496" strokeDashoffset="92"
                  />
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#3b82f6" />
                      <stop offset="1" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="ctr">
                  <div className="num">82</div>
                  <div className="lab">{t('mock.scorelab')}</div>
                </div>
              </div>
              <div className="verdict">{t('mock.verdict')}</div>
              <Rich k="mock.reveal" as="div" className="reveal" />
              <div className="faint" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 7 }}>
                {t('mock.revealcap')}
              </div>
            </div>
            <div className="mcol">
              <div className="rc">
                <div className="h">{t('mock.rh')}</div>
                <Rich k="mock.r1" as="div" className="row2" />
                <Rich k="mock.r2" as="div" className="row2" />
                <Rich k="mock.r3" as="div" className="row2" />
                <Rich k="mock.r4" as="div" className="row2" style={{ background: 'transparent', borderStyle: 'dashed' }} />
                <div className="h" style={{ marginTop: 10 }}>{t('mock.sh')}</div>
                <Rich k="mock.s1" as="div" className="row2" />
                <Rich k="mock.s2" as="div" className="row2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
