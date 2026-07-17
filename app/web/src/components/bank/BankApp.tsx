// The (fictional) bank's mobile app — مصرف الواحة. Tabaqa is invisible inside it
// (PRODUCT_SPEC §1, §24): the customer sees their bank; the تمويل section is powered
// by the engine. Structured like the bank apps Saudi users know: greeting, accounts,
// quick actions, bottom tabs.

import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { AHMED, fmt } from './financeMath'
import { FinanceFlow } from './FinanceFlow'
import { EngineView } from './EngineView'
import { Ic, IconName } from './icons'
import './bank.css'

type Tab = 'home' | 'finance' | 'cards' | 'me'
type View = { kind: 'tabs' } | { kind: 'engine' }

export function BankApp() {
  // This shell is Arabic-only (every string here is hardcoded عربي, dir=rtl), but the
  // app-wide language defaults to English — so shared panels rendered inside it (the
  // engine view's Scale Explorer) would come out English inside an RTL Arabic screen.
  // The bank app owns its language: assert it.
  const { setLang } = useI18n()
  useEffect(() => { setLang('ar') }, [])

  const startOnFinance = new URLSearchParams(window.location.search).has('fin')
  const [tab, setTab] = useState<Tab>(startOnFinance ? 'finance' : 'home')
  // ?engine — rehearsal shortcut straight to the engine view.
  const [view, setView] = useState<View>(
    new URLSearchParams(window.location.search).has('engine') ? { kind: 'engine' } : { kind: 'tabs' },
  )
  // Remount FinanceFlow on re-entry so the journey restarts cleanly.
  const [finKey, setFinKey] = useState(0)

  function goFinance() {
    setFinKey((k) => k + 1)
    setTab('finance')
  }

  // The engine's own surface — deliberately NOT a tab. Ahmed is a customer; a
  // customer's bank app must never browse other applicants (§24: the customer
  // sees their bank). Entered only through the Tabaqa mark, and it announces
  // that you have left the bank's view.
  if (view.kind === 'engine') {
    return (
      <div className="bk-shell" dir="rtl">
        <EngineView onBack={() => setView({ kind: 'tabs' })} />
      </div>
    )
  }

  return (
    <div className="bk-shell" dir="rtl">
      <div className="bk-body">
        {tab === 'home' && <Home onFinance={goFinance} onEngine={() => setView({ kind: 'engine' })} />}
        {tab === 'finance' && <FinanceFlow key={finKey} onExit={() => setTab('home')} />}
        {tab === 'cards' && <Soon label="البطاقات" />}
        {tab === 'me' && <Soon label="حسابي" />}
      </div>

      <nav className="bk-tabs">
        <TabBtn on={tab === 'home'} click={() => setTab('home')} ic="home" label="الرئيسية" />
        <TabBtn on={tab === 'finance'} click={goFinance} ic="cash" label="التمويل" />
        <TabBtn on={tab === 'cards'} click={() => setTab('cards')} ic="card" label="البطاقات" />
        <TabBtn on={tab === 'me'} click={() => setTab('me')} ic="user" label="حسابي" />
      </nav>
    </div>
  )
}

function Home({ onFinance, onEngine }: { onFinance: () => void; onEngine: () => void }) {
  return (
    <div className="bk-home">
      <header className="bk-head">
        <div>
          <small>مساء الخير</small>
          <b>{AHMED.name}</b>
        </div>
        <div className="bk-mark">مصرف الواحة</div>
      </header>

      <div className="bk-acct">
        <small>الحساب الجاري · •••• 4821</small>
        <div className="bk-acct-bal">{fmt(8_540)}<span>٫75 ر.س</span></div>
        <div className="bk-acct-foot">
          <span>IBAN SA•• ••20</span>
          <span>متاح للسحب</span>
        </div>
      </div>

      <div className="bk-actions">
        <Action ic="transfer" label="تحويل" />
        <Action ic="bill" label="سداد" />
        <Action ic="phone" label="شحن" />
        <Action ic="cash" label="تمويل" onClick={onFinance} hot />
      </div>

      <button className="bk-promo" onClick={onFinance}>
        <div>
          <b>تمويل المركبات الجديد</b>
          <small>قرارك خلال ثوانٍ — دون زيارة الفرع ولا رفع مستندات</small>
        </div>
        <span className="bk-chev">‹</span>
      </button>

      <div className="bk-txns">
        <h3>آخر العمليات</h3>
        <Txn t="راتب — مؤسسة حكومية" d="أمس" v="+18,000.00" plus />
        <Txn t="تموينات العائلة" d="أمس" v="-412.50" />
        <Txn t="محطة وقود" d="الاثنين" v="-160.00" />
        <Txn t="قسط تمويل شخصي" d="الأحد" v="-1,800.00" />
      </div>

      {/* The door to the engine. In a real deployment this mark wouldn't be here —
          it exists so a judge holding the phone can step behind the bank's app. */}
      <button className="bk-engine-entry" onClick={onEngine}>
        <span>قرارات التمويل عبر محرك <b>Tabaqa</b></span>
        <small>اضغط لترى المحرك نفسه — على مليون طلب ‹</small>
      </button>
    </div>
  )
}

function Action({ ic, label, onClick, hot }: { ic: IconName; label: string; onClick?: () => void; hot?: boolean }) {
  return (
    <button className={`bk-action${hot ? ' hot' : ''}`} onClick={onClick} disabled={!onClick}>
      <span className="bk-ic-chip"><Ic name={ic} size={20} /></span>
      {label}
    </button>
  )
}

function Txn({ t, d, v, plus }: { t: string; d: string; v: string; plus?: boolean }) {
  return (
    <div className="bk-txn">
      <span><b>{t}</b><small>{d}</small></span>
      <b className={plus ? 'plus' : ''} dir="ltr">{v}</b>
    </div>
  )
}

function TabBtn({ on, click, ic, label }: { on: boolean; click: () => void; ic: IconName; label: string }) {
  return (
    <button className={`bk-tab${on ? ' on' : ''}`} onClick={click}>
      <Ic name={ic} size={22} stroke={on ? 2.1 : 1.7} />
      {label}
    </button>
  )
}

function Soon({ label }: { label: string }) {
  return (
    <div className="bk-soon">
      <span><Ic name="clock" size={32} /></span>
      <b>{label}</b>
      <small>قريبًا في هذه النسخة التجريبية</small>
    </div>
  )
}
