import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useTx } from '../../lib/tx'
import { LangSwitcher } from '../LangSwitcher'
import { TabaqaMark } from '../Logo'

export type Section = 'home' | 'income' | 'ledger' | 'financing' | 'applicants' | 'model'

// ── inline stroke icons (currentColor) ──────────────────────────────────────
const I = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
const ICON: Record<Section, ReactNode> = {
  home: I(<><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></>),
  income: I(<><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7h-5M21 7v5" /></>),
  ledger: I(<><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>),
  financing: I(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2" /></>),
  applicants: I(<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" /><path d="M16 11a3 3 0 0 0 0-6M21 20c0-2.4-1.5-4.2-4-4.8" /></>),
  model: I(<><path d="M12 3l7 3v5c0 4.6-3.1 7.6-7 9-3.9-1.4-7-4.4-7-9V6z" /><path d="M9 12l2 2 4-4" /></>),
}

export interface NavSpec {
  id: Section
  label: string
  cap?: string        // section caption shown above this item (group header)
  badge?: string
}

export function DashboardLayout({
  active, onNavigate, nav, title, subtitle, actions, onReconnect, children,
}: {
  active: Section
  onNavigate: (s: Section) => void
  nav: NavSpec[]
  title: string
  subtitle?: string
  actions?: ReactNode
  onReconnect?: () => void
  children: ReactNode
}) {
  const { tx, dir } = useTx()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const email = user?.email ?? user?.id ?? ''
  const initial = (email[0] ?? 'U').toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function go(s: Section) {
    onNavigate(s)
    setOpen(false)
  }

  return (
    <div className="dash ds" dir={dir}>
      <div className={`ds-scrim${open ? ' show' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`ds-side${open ? ' open' : ''}`}>
        <div className="ds-brand">
          <TabaqaMark variant="gradient" />
          <span>Tabaqa</span>
        </div>

        <nav className="ds-nav">
          {nav.map((n) => (
            <div key={n.id}>
              {n.cap && <div className="ds-navcap">{n.cap}</div>}
              <button
                className={`ds-navitem${active === n.id ? ' active' : ''}`}
                onClick={() => go(n.id)}
                aria-current={active === n.id}
              >
                {ICON[n.id]}
                <span>{n.label}</span>
                {n.badge && <span className="ds-badge">{n.badge}</span>}
              </button>
            </div>
          ))}
        </nav>

        <div className="ds-foot">
          <div className="ds-user">
            <span className="ds-avatar">{initial}</span>
            <div className="ds-user-meta">
              <span className="ds-user-name">{tx('My account', 'حسابي')}</span>
              <span className="ds-user-mail">{email}</span>
            </div>
          </div>
          <div className="ds-foot-row">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
              {tx('Site', 'الموقع')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              {tx('Sign out', 'خروج')}
            </button>
          </div>
        </div>
      </aside>

      <div className="ds-body">
        <header className="ds-top">
          <div className="ds-top-l">
            <button className="ds-burger" aria-label="menu" onClick={() => setOpen((v) => !v)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div>
              <div className="ds-top-title">{title}</div>
              {subtitle && <div className="ds-top-sub">{subtitle}</div>}
            </div>
          </div>
          <div className="ds-top-r">
            {actions}
            {onReconnect && (
              <button className="btn btn-ghost btn-sm" onClick={onReconnect} title={tx('Replay the connect flow', 'إعادة تشغيل الربط')}>
                ↻ {tx('Reconnect', 'إعادة الربط')}
              </button>
            )}
            <LangSwitcher />
          </div>
        </header>

        <main className="ds-content">{children}</main>
      </div>
    </div>
  )
}
