// تطبيق طبقة — the Tabaqa consumer app (TEAM SPEC 2026-07-17).
// The user's own app this time (not a bank's): search financing offers across
// lender engines over one consented, unified financial file. Dashboard theme
// (royal blue / white), the animated Tabaqa mark in the home hero rectangle,
// bottom tabs like the apps Saudi users know.
//
// The front door is a Nafath (محاكاة) login: any of the 500,000 test identities
// signs in, the app knows who they are, and the journey inside never re-asks.

import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { Ic } from '../bank/icons'
import { JourneyFlow } from './JourneyFlow'
import { NafathLogin } from './Nafath'
import {
  CAST, fetchOrderStatus, loadTrackedOrder, markOrderNotified,
  type NafathSession,
} from './engines'
import './tapp.css'

type Tab = 'home' | 'finance' | 'me'

interface Auth { nin: string; nameAr: string; at: number }
const AUTH_KEY = 'tabaqa.tapp.auth'

// sessionStorage so an accidental mid-demo reload doesn't force a re-login,
// while a fresh launch still opens on the Nafath gate.
function loadAuth(): Auth | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const a = JSON.parse(raw) as Auth
    return /^[12]\d{9}$/.test(a?.nin ?? '') && a?.nameAr ? a : null
  } catch {
    return null
  }
}

export function TabaqaApp() {
  // Arabic-first shell — assert the app language like the bank shell does, so
  // any shared panel rendered inside stays Arabic inside an RTL screen.
  const { setLang } = useI18n()
  useEffect(() => { setLang('ar') }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const startOnFinance = new URLSearchParams(window.location.search).has('fin')
  const [tab, setTab] = useState<Tab>(startOnFinance ? 'finance' : 'home')
  // Remount the journey on re-entry so it always restarts cleanly.
  const [finKey, setFinKey] = useState(0)
  // ?as=<nin> — rehearsal shortcut: skip the Nafath gate as this test identity
  // (browser styling/demo runs; the phone launch still opens on the gate).
  const [auth, setAuth] = useState<Auth | null>(() => {
    const saved = loadAuth()
    if (saved) return saved
    const asNin = new URLSearchParams(window.location.search).get('as')
    if (asNin && /^[12]\d{9}$/.test(asNin)) {
      const cast = CAST.find((c) => c.nin === asNin)
      return { nin: asNin, nameAr: cast?.nameAr ?? 'عضو العينة الاختبارية', at: Date.now() }
    }
    return null
  })

  function login(nin: string, s: NafathSession) {
    const a: Auth = { nin, nameAr: s.nameAr, at: Date.now() }
    try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(a)) } catch { /* private mode */ }
    setAuth(a)
  }

  function logout() {
    try { sessionStorage.removeItem(AUTH_KEY) } catch { /* private mode */ }
    setAuth(null)
    setTab('home')
  }

  function goFinance() {
    setFinKey((k) => k + 1)
    setTab('finance')
  }

  // ── the desk's answer, delivered to the phone ──────────────────────────────
  // While a submitted order awaits the bank worker, poll its status; the moment
  // the desk decides, raise the notice — once, wherever the user is in the app.
  const [deskNotice, setDeskNotice] = useState<{
    kind: 'accepted' | 'declined'; lenderAr: string; orderId: string
  } | null>(null)

  useEffect(() => {
    const t = window.setInterval(async () => {
      const tracked = loadTrackedOrder()
      if (!tracked || tracked.notified) return
      const st = await fetchOrderStatus(tracked.id)
      if (!st) return
      if (st.status === 'accepted' || st.status === 'declined') {
        markOrderNotified()
        setDeskNotice({ kind: st.status, lenderAr: st.lenderAr || tracked.lenderAr, orderId: tracked.id })
      }
    }, 5000)
    return () => window.clearInterval(t)
  }, [])

  if (!auth) {
    return (
      <div className="tp-shell" dir="rtl">
        <div className="tp-body">
          <NafathLogin onDone={login} />
        </div>
      </div>
    )
  }

  return (
    <div className="tp-shell" dir="rtl">
      <div className="tp-body">
        {tab === 'home' && <Home nameAr={auth.nameAr} onStart={goFinance} />}
        {tab === 'finance' && (
          <JourneyFlow key={finKey} nin={auth.nin} nameAr={auth.nameAr} onExit={() => setTab('home')} />
        )}
        {tab === 'me' && <Me auth={auth} onLogout={logout} />}
      </div>

      <nav className="tp-tabs three">
        <TabBtn on={tab === 'home'} click={() => setTab('home')} ic="home" label="الرئيسية" />
        <TabBtn on={tab === 'finance'} click={goFinance} ic="cash" label="التمويل" />
        <TabBtn on={tab === 'me'} click={() => setTab('me')} ic="user" label="حسابي" />
      </nav>

      {deskNotice && (
        <DeskNotice n={deskNotice} onClose={() => setDeskNotice(null)} />
      )}
    </div>
  )
}

/** The bank's decision, landed on the phone — the demo's closing beat. */
function DeskNotice({ n, onClose }: {
  n: { kind: 'accepted' | 'declined'; lenderAr: string; orderId: string }
  onClose: () => void
}) {
  const ok = n.kind === 'accepted'
  return (
    <div className="tp-decide-back">
      <div className={`tp-decide${ok ? '' : ' bad'}`}>
        <div className={`tp-done-badge${ok ? '' : ' bad'}`}>
          {ok
            ? <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.7 4.6 4.6L19 7.7" /></svg>
            : <span style={{ fontSize: 26, fontWeight: 800 }}>✕</span>}
        </div>
        <b>{ok ? 'تمت الموافقة على طلب التمويل' : 'اعتذرت الجهة عن طلب التمويل'}</b>
        <p>
          {ok
            ? 'الرجاء مراجعة الجهة التمويلية خلال 3 أيام عمل أو سيتم فقدان الفرصة التمويلية.'
            : 'يمكنك العودة إلى تبويب التمويل واختيار عرض جهة أخرى — ملفك الموحد جاهز.'}
        </p>
        <small>{n.lenderAr} · رقم الطلب <span dir="ltr">{n.orderId}</span></small>
        <button className="tp-cta" onClick={onClose}>حسنًا</button>
      </div>
    </div>
  )
}

function Home({ nameAr, onStart }: { nameAr: string; onStart: () => void }) {
  return (
    <div className="tp-home">
      <header className="tp-head">
        <div>
          <small>حياك الله، {nameAr.split(' ')[0]} 👋</small>
          <b>ابحث عن تمويلك الأنسب</b>
        </div>
        <div className="tp-head-mark">
          <img src="/tabaqa-mark-blue.png" alt="" />
          <span>Tabaqa</span>
        </div>
      </header>

      {/* the hero rectangle — the animated Tabaqa burst as the background,
          the words in white above it */}
      <section className="tp-hero" onClick={onStart} role="button">
        <div className="tp-hero-txt">
          <h1>كل عروض التمويل — بملفٍ واحدٍ صادق</h1>
          <p>
            نبني ملفك المالي الموحد بموافقتك، ونشغّل محركات جهات التمويل عليه —
            فلا يظهر لك إلا ما يتوافق معك فعلًا.
          </p>
          <button className="tp-hero-cta" onClick={(e) => { e.stopPropagation(); onStart() }}>
            ابحث عن عروض التمويل
          </button>
        </div>
      </section>

      <h3 className="tp-h3">الخدمات</h3>
      <button className="tp-svc hot has3d" onClick={onStart}>
        {/* the real 3D Tabaqa symbol — floats gently inside the card, never past its edges */}
        <img className="tp-svc-3d" src="/tabaqa-3d.png" alt="" aria-hidden="true" />
        <span>
          <b>البحث عن عروض التمويل</b>
          <small>عدة جهات تمويل، بطلب واحد وموافقة واحدة — هويتك موثّقة عبر نفاذ (محاكاة)</small>
        </span>
        <span className="tp-chev">‹</span>
      </button>

      <h3 className="tp-h3">لماذا طبقة؟</h3>
      <div className="tp-trust">
        <div><b>6 مصادر</b>بموافقة موثّقة بختم زمني — قراءة فقط</div>
        <div><b>صفر بيانات خام</b>لا يصل الجهات إلا نتيجة التحليل</div>
        <div><b>قابل للتحقق</b>كل قرار بوثيقة و QR يفحصه أي أحد</div>
      </div>

      <div className="tp-powered">
        نسخة تجريبية — جميع الجهات والبيانات محاكاة عبر <b>Tabaqa Sandbox API</b>
      </div>
    </div>
  )
}

function Me({ auth, onLogout }: { auth: Auth; onLogout: () => void }) {
  const masked = `${auth.nin.slice(0, 1)}•••••${auth.nin.slice(6)}`
  return (
    <div className="tp-me">
      <div className="tp-profile">
        <span className="tp-ava big">{auth.nameAr.charAt(0)}</span>
        <b>{auth.nameAr}</b>
        <small>الهوية {masked}</small>
        <span className="tp-verified">✓ الهوية موثّقة عبر نفاذ (محاكاة)</span>
      </div>
      <button className="tp-ghost logout" onClick={onLogout}>
        تسجيل الخروج — الدخول بهوية أخرى
      </button>
      <p className="tp-hint" style={{ textAlign: 'center' }}>
        تبديل الهوية يعيدك لشاشة الدخول عبر نفاذ — جرّب أي عضو من عينة الـ500,000.
      </p>
    </div>
  )
}

function TabBtn({ on, click, ic, label }: { on: boolean; click: () => void; ic: Parameters<typeof Ic>[0]['name']; label: string }) {
  return (
    <button className={`tp-tab${on ? ' on' : ''}`} onClick={click}>
      <Ic name={ic} size={22} stroke={on ? 2.1 : 1.7} />
      {label}
    </button>
  )
}
