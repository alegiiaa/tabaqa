// تطبيق طبقة — the Tabaqa consumer app (TEAM SPEC 2026-07-17).
// The user's own app this time (not a bank's): search financing offers across
// lender engines over one consented, unified financial file. Dashboard theme
// (royal blue / white), the animated Tabaqa mark in the home hero rectangle,
// bottom tabs like the apps Saudi users know.
//
// The front door is a Nafath (محاكاة) login: any of the 500,000 test identities
// signs in, the app knows who they are, and the journey inside never re-asks.
//
// After a journey submits an order, the app TRACKS it: a live "طلب التمويل
// الحالي" card on the home screen (per identity, relaunch-proof), a tracking
// sheet with the order's timeline, and instant notices when the bank worker
// accepts, declines or extends the loan on the dashboard — pushed over
// Supabase Realtime with a quiet poll as fallback.

import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { subscribeDeskOrder, type OrderEvent } from '../../lib/ordersDesk'
import { fmt } from '../bank/financeMath'
import { Ic } from '../bank/icons'
import { JourneyFlow } from './JourneyFlow'
import { NafathLogin } from './Nafath'
import {
  CAST, ORDER_STATUS_AR, fetchOrderState, loadTrackedOrder, orderSig, rememberOrderSig,
  type NafathSession, type OrderState, type TrackedOrder,
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

interface DeskNoticeData {
  kind: 'accepted' | 'declined' | 'extended'
  lenderAr: string
  orderId: string
  tenor: number
  installment: number
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

  // ── the tracked order — the desk's answers, delivered to the phone ─────────
  const [tracked, setTracked] = useState<TrackedOrder | null>(null)
  const [orderState, setOrderState] = useState<OrderState | null>(null)
  const [sheet, setSheet] = useState(false)
  const [deskNotice, setDeskNotice] = useState<DeskNoticeData | null>(null)

  // (re)load this identity's tracked order — localStorage, so it survives relaunch
  useEffect(() => {
    setOrderState(null)
    setSheet(false)
    setTracked(auth ? loadTrackedOrder(auth.nin) : null)
  }, [auth])

  // Watch it live: Supabase Realtime pushes the desk's UPDATE the moment قبول /
  // رفض / تمديد happens; the 5s poll self-heals when the socket can't. Every
  // state signature (status:tenor) notifies exactly once.
  useEffect(() => {
    if (!auth || !tracked) return
    let on = true
    const check = async () => {
      const st = await fetchOrderState(tracked.id)
      if (!on || !st) return
      setOrderState(st)
      const sig = orderSig(st)
      if (sig === tracked.sig) return
      const statusChanged = !tracked.sig.startsWith(`${st.status}:`)
      const kind: DeskNoticeData['kind'] | null = statusChanged
        ? (st.status === 'accepted' ? 'accepted' : st.status === 'declined' ? 'declined' : null)
        : (st.tenor !== tracked.tenor ? 'extended' : null)
      if (!kind) return
      const upd = rememberOrderSig(auth.nin, sig)
      if (upd) setTracked(upd)
      setDeskNotice({
        kind,
        lenderAr: st.lenderAr || tracked.lenderAr,
        orderId: tracked.id,
        tenor: st.tenor,
        installment: st.installment,
      })
    }
    void check()
    const t = window.setInterval(() => { void check() }, 5000)
    const unsub = subscribeDeskOrder(tracked.id, () => { void check() })
    return () => { on = false; window.clearInterval(t); unsub() }
  }, [auth, tracked])

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
        {tab === 'home' && (
          <Home
            nameAr={auth.nameAr}
            onStart={goFinance}
            tracked={tracked}
            orderState={orderState}
            onTrack={() => setSheet(true)}
          />
        )}
        {tab === 'finance' && (
          <JourneyFlow
            key={finKey}
            nin={auth.nin}
            nameAr={auth.nameAr}
            onExit={() => setTab('home')}
            onOrder={() => {
              setTracked(loadTrackedOrder(auth.nin))
              setOrderState(null)
            }}
          />
        )}
        {tab === 'me' && <Me auth={auth} onLogout={logout} />}
      </div>

      <nav className="tp-tabs three">
        <TabBtn on={tab === 'home'} click={() => setTab('home')} ic="home" label="الرئيسية" />
        <TabBtn on={tab === 'finance'} click={goFinance} ic="cash" label="التمويل" />
        <TabBtn on={tab === 'me'} click={() => setTab('me')} ic="user" label="حسابي" />
      </nav>

      {sheet && tracked && (
        <OrderSheet tracked={tracked} st={orderState} onClose={() => setSheet(false)} />
      )}

      {deskNotice && (
        <DeskNotice n={deskNotice} onClose={() => setDeskNotice(null)} />
      )}
    </div>
  )
}

/** The bank's answer, landed on the phone — approval, decline, or extension. */
function DeskNotice({ n, onClose }: {
  n: DeskNoticeData
  onClose: () => void
}) {
  const tone = n.kind === 'accepted' ? '' : n.kind === 'extended' ? ' info' : ' bad'
  return (
    <div className="tp-decide-back">
      <div className={`tp-decide${tone}`}>
        <div className={`tp-done-badge${tone}`}>
          {n.kind === 'accepted'
            ? <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.7 4.6 4.6L19 7.7" /></svg>
            : n.kind === 'extended'
              ? <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.6" /><path d="M12 7.4V12l3.2 2.1" /></svg>
              : <span style={{ fontSize: 26, fontWeight: 800 }}>✕</span>}
        </div>
        <b>
          {n.kind === 'accepted' ? 'تمت الموافقة على طلب التمويل'
            : n.kind === 'extended' ? 'تم تمديد مدة التمويل'
              : 'اعتذرت الجهة عن طلب التمويل'}
        </b>
        <p>
          {n.kind === 'accepted'
            ? 'الرجاء مراجعة الجهة التمويلية خلال 3 أيام عمل أو سيتم فقدان الفرصة التمويلية.'
            : n.kind === 'extended'
              ? `حدّثت الجهة مدة السداد إلى ${n.tenor} شهرًا — القسط الجديد ${fmt(n.installment)} ر.س شهريًا. لا يلزمك أي إجراء.`
              : 'يمكنك العودة إلى تبويب التمويل واختيار عرض جهة أخرى — ملفك الموحد جاهز.'}
        </p>
        <small>{n.lenderAr} · رقم الطلب <span dir="ltr">{n.orderId}</span></small>
        <button className="tp-cta" onClick={onClose}>حسنًا</button>
      </div>
    </div>
  )
}

/** The home-screen order label — the applicant's live tracker for the order
 *  they sent: ref, status, and a pulse that keeps proving it's connected. */
function OrderCard({ tracked, st, onTrack }: {
  tracked: TrackedOrder
  st: OrderState | null
  onTrack: () => void
}) {
  const status = st?.status ?? 'pending'
  const tenor = st?.tenor ?? tracked.tenor
  const installment = st?.installment ?? tracked.installment
  const extended = (st?.originalTenor ?? null) != null
  return (
    <button className="tp-order-card" onClick={onTrack}>
      <span className={`tp-order-dot ${status}`} aria-hidden="true" />
      <span className="tp-order-main">
        <b>طلب التمويل الحالي — {tracked.productAr}</b>
        <small>
          {tracked.lenderAr} · {fmt(tracked.amount)} ر.س · {fmt(installment)} ر.س × {tenor}
          {extended && <i className="tp-order-ext"> (ممدد)</i>}
        </small>
        <em className={`tp-order-st ${status}`}>{ORDER_STATUS_AR[status]}</em>
      </span>
      <span className="tp-order-side">
        <i className="tp-order-ref" dir="ltr">#{tracked.id.slice(-6).toUpperCase()}</i>
        <span className="tp-chev">‹</span>
      </span>
    </button>
  )
}

const EVENT_AR: Record<OrderEvent['type'], string> = {
  submitted: 'تم إرسال الطلب عبر تطبيق طبقة',
  accepted: 'وافقت الجهة على الطلب',
  declined: 'اعتذرت الجهة عن الطلب',
  extended: 'مدّدت الجهة مدة التمويل',
}

function eventTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** تتبع الطلب — the bottom sheet: live status, figures, and the timeline the
 *  desk writes (every قبول/رفض/تمديد lands here the moment it happens). */
function OrderSheet({ tracked, st, onClose }: {
  tracked: TrackedOrder
  st: OrderState | null
  onClose: () => void
}) {
  const status = st?.status ?? 'pending'
  const tenor = st?.tenor ?? tracked.tenor
  const installment = st?.installment ?? tracked.installment
  const originalTenor = st?.originalTenor ?? null
  const events: OrderEvent[] = st?.events?.length
    ? st.events
    : [{ at: new Date(tracked.at).toISOString(), type: 'submitted' }]
  return (
    <div className="tp-sheet-back" onClick={onClose}>
      <div className="tp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tp-sheet-grab" aria-hidden="true" />
        <div className="tp-sheet-head">
          <b>تتبع طلب التمويل</b>
          <span className="tp-order-ref big" dir="ltr">{tracked.id}</span>
        </div>
        <span className={`tp-order-st big ${status}`}>{ORDER_STATUS_AR[status]}</span>

        <div className="tp-receipt">
          <div className="tp-row"><span>الجهة الممولة</span><b>{st?.lenderAr || tracked.lenderAr}</b></div>
          <div className="tp-row"><span>المنتج</span><b>{tracked.productAr}</b></div>
          <div className="tp-row"><span>المبلغ</span><b>{fmt(st?.amount ?? tracked.amount)} ر.س</b></div>
          <div className="tp-row">
            <span>القسط الشهري</span>
            <b>
              {fmt(installment)} ر.س × {tenor}
              {originalTenor != null && <i className="tp-order-ext"> (كانت × {originalTenor})</i>}
            </b>
          </div>
        </div>

        <div className="tp-tl">
          {events.map((e, i) => (
            <div key={i} className={`tp-tl-item ${e.type}`}>
              <span className="tp-tl-dot" aria-hidden="true" />
              <div className="tp-tl-txt">
                <b>{EVENT_AR[e.type] ?? e.type}</b>
                {e.type === 'extended' && e.tenor_months != null && (
                  <small>المدة الجديدة {e.tenor_months} شهرًا — القسط {fmt(e.installment ?? 0)} ر.س</small>
                )}
                <time dir="ltr">{eventTime(e.at)}</time>
              </div>
            </div>
          ))}
          {status === 'pending' && (
            <div className="tp-tl-item next">
              <span className="tp-tl-dot" aria-hidden="true" />
              <div className="tp-tl-txt">
                <b>قرار الجهة التمويلية</b>
                <small>خلال 24 ساعة من الإرسال — يصلك إشعار فوري</small>
              </div>
            </div>
          )}
        </div>

        <p className="tp-hint" style={{ textAlign: 'center', marginTop: 10 }}>
          يُحدَّث مباشرةً — أي إجراء من الجهة (قبول، رفض، تمديد) يظهر هنا لحظة حدوثه.
        </p>
        <button className="tp-cta" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  )
}

function Home({ nameAr, onStart, tracked, orderState, onTrack }: {
  nameAr: string
  onStart: () => void
  tracked: TrackedOrder | null
  orderState: OrderState | null
  onTrack: () => void
}) {
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

      {tracked && (
        <>
          <h3 className="tp-h3">طلباتي</h3>
          <OrderCard tracked={tracked} st={orderState} onTrack={onTrack} />
        </>
      )}

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
