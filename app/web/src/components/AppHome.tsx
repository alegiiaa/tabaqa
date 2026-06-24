import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { LangSwitcher } from './LangSwitcher'
import { TabaqaMark } from './Logo'

/**
 * Minimal authenticated landing — the redirect target after login. The real demo
 * dashboard (the 4 screens in UI.md) replaces this body; for now it proves the
 * auth loop end-to-end and offers sign-out.
 */
export function AppHome() {
  const { user, signOut } = useAuth()
  const { t, dir } = useI18n()
  const navigate = useNavigate()
  const arrow = dir === 'rtl' ? '←' : '→'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="apphome">
      <header className="apphome-bar">
        <div className="logo">
          <TabaqaMark variant="gradient" />
          <span>Tabaqa</span>
        </div>
        <div className="apphome-bar-right">
          <LangSwitcher />
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            {t('auth.signout')}
          </button>
        </div>
      </header>

      <main className="apphome-body">
        <div className="apphome-card">
          <div className="apphome-badge">
            <span className="dot" /> {t('app.signedin')}
          </div>
          <h1>{t('app.welcome')}</h1>
          <p className="apphome-email">{user?.email ?? user?.id}</p>
          <p className="apphome-note">{t('app.note')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            {t('app.tolanding')} {arrow}
          </button>
        </div>
      </main>
    </div>
  )
}
