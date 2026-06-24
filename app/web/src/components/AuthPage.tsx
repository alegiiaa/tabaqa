import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { LangSwitcher } from './LangSwitcher'
import { TabaqaMark } from './Logo'
import { Checkbox } from './Checkbox'

type Mode = 'signin' | 'signup'

/* ── inline icons ─────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="m3 3 18 18" />}
    </svg>
  )
}

export function AuthPage({ mode }: { mode: Mode }) {
  const isSignup = mode === 'signup'
  const { t, dir } = useI18n()
  const { signInWithPassword, signUpWithPassword, signInWithOAuth, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/app'
  const arrow = dir === 'rtl' ? '←' : '→'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    const res = isSignup
      ? await signUpWithPassword(email, password)
      : await signInWithPassword(email, password)
    setBusy(false)

    if (res.error) {
      setError(res.error)
      return
    }
    if (res.needsConfirmation) {
      setNotice(t('auth.note.confirm'))
      return
    }
    navigate(from, { replace: true })
  }

  async function handleOAuth(provider: 'google' | 'twitter') {
    setError(null)
    setNotice(null)
    setBusy(true)
    const res = await signInWithOAuth(provider)
    // On success the browser redirects away; we only land here on error.
    if (res.error) setError(res.error)
    setBusy(false)
  }

  async function handleForgot() {
    setError(null)
    setNotice(null)
    if (!email) {
      setNotice(t('auth.note.needemail'))
      return
    }
    const res = await resetPassword(email)
    if (res.error) setError(res.error)
    else setNotice(t('auth.note.reset'))
  }

  return (
    <div className="auth">
      {/* ── form side ── */}
      <div className="auth-pane">
        <header className="auth-top">
          <Link to="/" className="logo" aria-label="Tabaqa — home">
            <TabaqaMark variant="gradient" />
            <span>Tabaqa</span>
          </Link>
          <div className="auth-top-right">
            <LangSwitcher />
            <Link to={isSignup ? '/login' : '/signup'} className="auth-toplink">
              {isSignup ? t('auth.top.signin') : t('auth.top.signup')}
            </Link>
          </div>
        </header>

        <main className="auth-body">
          <div className="auth-card">
            <h1 className="auth-h1">{isSignup ? t('auth.create') : t('auth.welcome')}</h1>

            <button type="button" className="auth-social" onClick={() => handleOAuth('google')} disabled={busy}>
              <GoogleIcon />
              <span>{isSignup ? t('auth.google.up') : t('auth.google.in')}</span>
            </button>
            <button type="button" className="auth-social" onClick={() => handleOAuth('twitter')} disabled={busy}>
              <XIcon />
              <span>{isSignup ? t('auth.x.up') : t('auth.x.in')}</span>
            </button>

            <div className="auth-or">{t('auth.or')}</div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="auth-field">
                <input
                  className="auth-input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder={t('auth.email')}
                  aria-label={t('auth.email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="auth-field has-eye">
                <input
                  className="auth-input"
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder={t('auth.password')}
                  aria-label={t('auth.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? t('auth.pw.hide') : t('auth.pw.show')}
                >
                  <EyeIcon off={showPw} />
                </button>
              </div>

              <div className="auth-meta">
                <label className="auth-remember">
                  <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  {t('auth.remember')}
                </label>
                {!isSignup && (
                  <button type="button" className="auth-forgot" onClick={handleForgot}>
                    {t('auth.forgot')}
                  </button>
                )}
              </div>

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? t('auth.working') : `${isSignup ? t('auth.submit.up') : t('auth.submit.in')}  ${arrow}`}
              </button>
            </form>

            {error && <div className="auth-note err" role="alert">{error}</div>}
            {notice && <div className="auth-note ok" role="status">{notice}</div>}

            <p className="auth-alt">
              {isSignup ? t('auth.alt.up') : t('auth.alt.in')}{' '}
              <Link to={isSignup ? '/login' : '/signup'}>
                {isSignup ? t('auth.alt.up.link') : t('auth.alt.in.link')}
              </Link>
            </p>
          </div>
        </main>
      </div>

      {/* ── art side ── */}
      <aside className="auth-art" aria-hidden="true">
        <img className="auth-art-img" src="/tabaqa.gif" alt="" />
      </aside>
    </div>
  )
}
