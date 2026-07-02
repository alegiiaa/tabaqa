import { useI18n } from '../i18n/I18nContext'
import { TabaqaMark } from './Logo'

export function Footer() {
  const { t } = useI18n()
  return (
    <footer>
      <div className="wrap">
        <div className="fgrid">
          <div>
            <a className="logo" href="#top" style={{ marginBottom: 14 }}>
              <TabaqaMark variant="gradient" />
              Tabaqa
            </a>
            <p className="faint" style={{ fontSize: 13.5, maxWidth: 260 }}>
              {t('foot.tag')}
            </p>
          </div>
          <div>
            <h4>{t('foot.product')}</h4>
            <a href="#product">{t('foot.overview')}</a>
            <a href="#how">{t('foot.how')}</a>
            <a href="#">{t('foot.api')}</a>
          </div>
          <div>
            <h4>{t('foot.company')}</h4>
            <a href="#security">{t('foot.security')}</a>
            <a href="#faq">{t('foot.faq')}</a>
            <a href="mailto:hello@tabaqa.app">{t('foot.contact')}</a>
          </div>
          <div>
            <h4>{t('foot.legal')}</h4>
            <a href="#">{t('foot.privacy')}</a>
            <a href="#">{t('foot.terms')}</a>
            <a href="#">{t('foot.consent')}</a>
          </div>
        </div>
        <div className="fbottom">
          <span>{t('foot.copy')}</span>
          <span className="status">
            <span className="dot" /> <span>{t('foot.status')}</span>
          </span>
        </div>
      </div>
    </footer>
  )
}
