import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import { Rich } from './Rich'
import { TabaqaMark } from './Logo'
import { LangSwitcher } from './LangSwitcher'
import GlowHorizon from './ui/glow-horizon'

const NAV_LINKS = [
  { href: '#product', key: 'nav.product' },
  { href: '#how', key: 'nav.how' },
  { href: '#security', key: 'nav.security' },
  { href: '#pricing', key: 'nav.pricing' },
  { href: '#faq', key: 'nav.faq' },
]

export function Hero() {
  const { t } = useI18n()
  return (
    <header className="hero-shell" id="top">
      <div className="hero-card">
        <GlowHorizon variant="top" className="hero-glowfx" />

        <div className="hero-topbar">
          <a className="logo" href="#top">
            <TabaqaMark variant="gradient" />
            Tabaqa
          </a>
          <div className="navlinks">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {t(l.key)}
              </a>
            ))}
          </div>
          <div className="navright">
            <LangSwitcher />
            <Link to="/login" className="btn btn-ghost btn-sm">
              {t('nav.login')}
            </Link>
            <Link to="/signup" className="btn btn-primary btn-sm">
              {t('nav.signup')}
            </Link>
          </div>
        </div>

        <div className="hero-overlay">
          <div className="ho-inner">
            <Rich k="heroimg.h1" as="h1" className="ho-h1" />
            <Rich k="heroimg.sub" as="p" className="ho-sub" />
            <div className="ho-cta">
              <Link className="btn hero-cta-white" to="/signup">
                {t('heroimg.cta1')}
              </Link>
              <a className="btn btn-ghost" href="#how">
                {t('heroimg.cta2')}
              </a>
            </div>
            <div className="powered">
              <span className="pb-label">{t('powered.by')}</span>
              <span className="humain-card">
                <img className="humain" src="/humain-logo.png" alt="HUMAIN" />
              </span>
            </div>
          </div>
        </div>

        <a className="scrolldown" href="#intro" aria-label={t('heroimg.scroll')}>
          <span>{t('heroimg.scroll')}</span>
          <svg className="scroll-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </a>
      </div>
    </header>
  )
}
