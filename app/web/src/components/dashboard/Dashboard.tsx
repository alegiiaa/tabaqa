import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useTx } from '../../lib/tx'
import { IncomingOrders, OrderToast, fetchOrders, type TabaqaOrder } from './IncomingOrders'
import { api, type ScoreResult, type StatementInput } from '../../lib/api'
import { DashboardLayout, type NavSpec, type Section } from './DashboardLayout'
import { Connect, type Picks } from './Connect'
import { MyMoney } from './MyMoney'
import { Applicants } from './Applicants'
import { RevealScreen, ScoreScreen, LedgerScreen } from './Result'
import { Marketplace } from './Marketplace'
import { ModelCardPanel } from './ModelCardPanel'
import { ScaleExplorer } from './ScaleExplorer'
import { ErrorState } from './ErrorState'
import { JudgeTour, markTourSeen, tourSeen } from './Tour'

const MY_CONNECTION = 'con_8842' // the signed-in user's own accounts (demo protagonist)
const DEFAULT_PICKS: Picks = { bank: 'alinma', wallet: 'barq' }

/** Re-brand the demo accounts + transactions to the institutions the user picked. */
function rethemeResult(result: ScoreResult, picks: Picks): ScoreResult {
  const swap = (src: string) =>
    src.startsWith('bank:') ? `bank:${picks.bank}` : src.startsWith('wallet:') ? `wallet:${picks.wallet}` : src
  return {
    ...result,
    accounts: result.accounts?.map((a) => ({
      ...a,
      source: swap(a.source),
      provider: a.kind === 'wallet' ? picks.wallet : a.kind === 'bank' ? picks.bank : a.provider,
    })),
    transactions: result.transactions.map((t) => ({ ...t, source: swap(t.source) })),
  }
}

export function Dashboard() {
  const { user } = useAuth()
  const { tx } = useTx()
  const uid = user?.id ?? 'anon'
  const flag = `tabaqa.connected.${uid}`

  const initial = (() => {
    try {
      const raw = localStorage.getItem(flag)
      if (!raw) return { connected: false, picks: DEFAULT_PICKS, input: null as StatementInput | null }
      if (raw === '1') return { connected: true, picks: DEFAULT_PICKS, input: null } // legacy flag
      const parsed = JSON.parse(raw)
      // new format: { picks, input? }; legacy: bare picks { bank, wallet }.
      const picks: Picks = parsed.picks
        ? { ...DEFAULT_PICKS, ...parsed.picks }
        : { ...DEFAULT_PICKS, ...parsed }
      const input: StatementInput | null = parsed.input ?? null
      return { connected: true, picks, input }
    } catch {
      return { connected: false, picks: DEFAULT_PICKS, input: null }
    }
  })()

  const [connected, setConnected] = useState<boolean>(initial.connected)
  const [picks, setPicks] = useState<Picks>(initial.picks)
  const [input, setInput] = useState<StatementInput | null>(initial.input)
  // Offers-first: the marketplace is the product, so it is also the landing.
  // The score lives one level down, as an input into the pricing (see ScoreInput).
  const [section, setSection] = useState<Section>('financing')
  const [my, setMy] = useState<ScoreResult | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const [loadNonce, setLoadNonce] = useState(0) // bump to retry a failed load
  const [tour, setTour] = useState(false)

  // If we land already-connected (e.g. a page refresh), reload the profile fresh:
  // demo → re-score the canonical connection; own-data → re-score the saved
  // statement (fall back to Connect if it's missing, e.g. cleared storage).
  useEffect(() => {
    if (!connected || my) return
    let on = true
    setErr(null)
    if (picks.mode === 'own_data') {
      if (!input) { setConnected(false); return }
      api.scoreStatement(input)
        .then((r) => on && setMy(r))
        .catch((e) => on && setErr(e))
    } else {
      api.scoreConnection(MY_CONNECTION)
        .then((r) => on && setMy(r))
        .catch((e) => on && setErr(e))
    }
    return () => { on = false }
  }, [connected, my, picks.mode, input, loadNonce])

  const retryLoad = () => { setErr(null); setLoadNonce((n) => n + 1) }

  // Own-data sources are already correct (branded via bank_name/wallet_name on
  // ingest), so skip the demo retheme; only the demo profile needs re-branding.
  const themed = useMemo(
    () => (picks.mode === 'own_data' ? my : (my ? rethemeResult(my, picks) : null)),
    [my, picks],
  )

  // U4 · auto-open the judge tour on the first loaded visit (once per browser);
  // wait for the profile so step ① never lands on a skeleton.
  useEffect(() => {
    if (themed && !tourSeen()) setTour(true)
  }, [themed])

  const closeTour = () => {
    markTourSeen()
    setTour(false)
  }

  // ── incoming orders desk — طلبات تطبيق طبقة (TEAM SPEC stages 8–10) ─────────
  // Poll the sandbox desk; the first UNSEEN pending order after the initial
  // load raises the "طلب جديد — اقبله خلال 24 ساعة" toast. Stale orders present
  // at page load never toast (primed guard) — only live arrivals do.
  const [orders, setOrders] = useState<TabaqaOrder[] | null>(null)
  const [orderToast, setOrderToast] = useState<TabaqaOrder | null>(null)
  const seenOrders = useRef<Set<string>>(new Set())
  const ordersPrimed = useRef(false)

  async function pollOrders() {
    try {
      const list = await fetchOrders()
      setOrders(list)
      const fresh = list.find((o) => o.status === 'pending' && !seenOrders.current.has(o.order_id))
      list.forEach((o) => seenOrders.current.add(o.order_id))
      if (fresh && ordersPrimed.current) setOrderToast(fresh)
      ordersPrimed.current = true
    } catch { /* desk offline — keep whatever we last knew */ }
  }

  useEffect(() => {
    void pollOrders()
    const t = window.setInterval(() => { void pollOrders() }, 6000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!orderToast) return
    const t = window.setTimeout(() => setOrderToast(null), 12_000)
    return () => window.clearTimeout(t)
  }, [orderToast])

  const pendingOrders = orders?.filter((o) => o.status === 'pending').length ?? 0

  function onConnected(r: ScoreResult, p: Picks, inp?: StatementInput) {
    setMy(r)
    setPicks(p)
    setInput(inp ?? null)
    setConnected(true)
    setSection('financing') // connect → straight to the offers the connection just unlocked
    try {
      localStorage.setItem(flag, JSON.stringify({ picks: p, input: p.mode === 'own_data' ? inp : undefined }))
    } catch { /* ignore */ }
  }

  function reconnect() {
    try { localStorage.removeItem(flag) } catch { /* ignore */ }
    setMy(null)
    setInput(null)
    setConnected(false)
  }

  if (!connected) {
    return <Connect onConnected={onConnected} />
  }

  // The nav tells the story the pitch tells: the offers are the product, and
  // everything under "what prices your offers" is an input into them.
  const nav: NavSpec[] = [
    { id: 'financing', label: tx('Offers', 'العروض'), cap: tx('Financing marketplace', 'سوق التمويل') },
    { id: 'home', label: tx('My money', 'أموالي'), cap: tx('What prices your offers', 'ما يُسعّر عروضك') },
    { id: 'income', label: tx('Income & score', 'الدخل والدرجة') },
    { id: 'ledger', label: tx('Ledger', 'السجل') },
    { id: 'orders', label: tx('Incoming orders', 'الطلبات الواردة'), cap: tx('Lender tools', 'أدوات المموّل'), badge: pendingOrders ? String(pendingOrders) : undefined },
    { id: 'applicants', label: tx('Applicants', 'المتقدمون') },
    { id: 'model', label: tx('Model validation', 'التحقق من النموذج') },
  ]

  const META: Record<Section, { title: string; sub: string }> = {
    home: { title: tx('My money', 'أموالي'), sub: tx('The verified money picture your offers are priced from — bank + wallet.', 'الصورة المالية الموثّقة التي تُسعَّر منها عروضك — البنك + المحفظة.') },
    income: { title: tx('Income & score', 'الدخل والدرجة'), sub: tx('Bank-only vs. your true verified income — and the score, one input into your pricing.', 'دخل البنك مقابل دخلك الحقيقي الموثّق — والدرجة، أحد مدخلات تسعيرك.') },
    ledger: { title: tx('Ledger', 'السجل'), sub: tx('Unified bank + wallet activity, labelled.', 'نشاط موحّد للبنك والمحفظة، موسوم.') },
    financing: { title: tx('Financing marketplace', 'سوق التمويل'), sub: tx('Every offer your verified income unlocks — across lenders, ranked for you.', 'كل العروض التي يفتحها دخلك الموثّق — عبر الجهات التمويلية، مرتّبة لك.') },
    orders: { title: tx('Incoming orders', 'الطلبات الواردة'), sub: tx('Orders sent from the Tabaqa app — accept within 24 hours, the applicant’s verified report attached.', 'طلبات وصلت من تطبيق طبقة — على الجهة اعتمادها خلال 24 ساعة، ومع كل طلب تقرير المتقدم الموثّق.') },
    applicants: { title: tx('Applicants', 'المتقدمون'), sub: tx('Score other people for lending decisions.', 'قيّم أشخاصًا آخرين لاتخاذ قرارات الإقراض.') },
    model: { title: tx('Model validation', 'التحقق من النموذج'), sub: tx('How the Tabaqa score performs on real default outcomes.', 'كيف يؤدي نموذج طبقة على نتائج تعثّر حقيقية.') },
  }

  const meta = META[section]
  const needsMine = section !== 'applicants' && section !== 'model' && section !== 'orders'
  // Where the Financial-intelligence panel should source its Claude narrative from.
  const insightsConn = picks.mode === 'own_data' && input
    ? { statement: input }
    : { connectionId: MY_CONNECTION }

  return (
    <>
      <DashboardLayout
        active={section}
        onNavigate={setSection}
        nav={nav}
        title={meta.title}
        subtitle={meta.sub}
        onReconnect={reconnect}
        actions={
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setTour(true)}
            title={tx('Replay the 3-step guided tour', 'إعادة الجولة الإرشادية')}
          >
            ✦ {tx('Tour', 'جولة')}
          </button>
        }
      >
        {section === 'orders' ? (
          <IncomingOrders orders={orders} onChanged={() => { void pollOrders() }} />
        ) : section === 'applicants' ? (
          <Applicants />
        ) : section === 'model' ? (
          <>
            <ModelCardPanel />
            <ScaleExplorer />
          </>
        ) : needsMine && !themed ? (
          err ? <ErrorState error={err} onRetry={retryLoad} /> : <LoadingScreen />
        ) : themed ? (
          <SectionBody section={section} result={themed} onNavigate={setSection} conn={insightsConn} />
        ) : null}
      </DashboardLayout>
      {tour && <JudgeTour onNavigate={setSection} onClose={closeTour} />}
      {/* the "you have a new order" moment — raised live when the app sends one */}
      {orderToast && section !== 'orders' && (
        <OrderToast
          o={orderToast}
          onOpen={() => { setSection('orders'); setOrderToast(null) }}
          onClose={() => setOrderToast(null)}
        />
      )}
    </>
  )
}

function SectionBody({
  section, result, onNavigate, conn,
}: { section: Section; result: ScoreResult; onNavigate: (s: Section) => void; conn: { connectionId?: string; statement?: StatementInput } }) {
  if (section === 'home') return <MyMoney result={result} onNavigate={onNavigate} conn={conn} />
  if (section === 'income') return <IncomeScreen result={result} onOpenModel={() => onNavigate('model')} />
  if (section === 'ledger') return <LedgerScreen txns={result.transactions} />
  // The landing: offers are the product — the score rides above them as an input.
  return (
    <>
      <ScoreInput result={result} onNavigate={onNavigate} />
      <Marketplace result={result} onNavigate={onNavigate} />
    </>
  )
}

/**
 * The score, put in its place. We are not a scoring company — we are a pricing
 * engine, so on the marketplace the score is a supporting input (it sets each
 * lender's minimum bar and, through the risk band, the rate), while the offers
 * below are the product. It sits above the search so the framing is read before
 * the first number lands.
 */
function ScoreInput({ result, onNavigate }: { result: ScoreResult; onNavigate: (s: Section) => void }) {
  const { tx } = useTx()
  const risk =
    result.risk_flag === 'low' ? tx('Low risk', 'مخاطر منخفضة')
      : result.risk_flag === 'medium' ? tx('Medium risk', 'مخاطر متوسطة')
        : tx('High risk', 'مخاطر مرتفعة')

  return (
    <div className="mkt-input">
      <span className="mkt-input-score" dir="ltr">{result.tabaqa_score}<small>/99</small></span>
      <div className="mkt-input-txt">
        <b>{tx('One input into your pricing', 'أحد مدخلات تسعيرك')}</b>
        <span className="faint">
          {tx('Lenders read it for their minimum bar and your rate — your verified income sets the amount. The score is not the product; the offers below are.',
            'تقرأه الجهات التمويلية لحدّها الأدنى ولنسبتك — أما المبلغ فيحدّده دخلك الموثّق. الدرجة ليست المنتج؛ العروض بالأسفل هي المنتج.')}
        </span>
      </div>
      <span className={`tag ${result.risk_flag === 'low' ? 't-ok' : 't-inf'}`}>{risk}</span>
      <button className="mm-link" onClick={() => onNavigate('income')}>
        {tx('How it is computed', 'كيف تُحتسب')} <span className="fwd">→</span>
      </button>
    </div>
  )
}

// Holds the score section back until the reveal has played — no spoilers
// under the DECLINE chip.
function IncomeScreen({ result, onOpenModel }: { result: ScoreResult; onOpenModel?: () => void }) {
  const { tx } = useTx()
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="screen">
      <RevealScreen result={result} onRevealed={setRevealed} />
      {revealed && (
        <>
          <div style={{ height: 22 }} />
          <div className="section-head">
            <h1>{tx('The score', 'الدرجة')}</h1>
            <p>{tx('One input into your pricing — not the product. Every point is explainable, no black box.',
              'أحد مدخلات تسعيرك — وليس المنتج. كل نقطة قابلة للتفسير، دون صندوق أسود.')}</p>
          </div>
          <ScoreScreen result={result} onOpenModel={onOpenModel} />
        </>
      )}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="skel-wrap">
      <div className="skel" style={{ height: 150 }} />
      <div className="skel" style={{ height: 92 }} />
      <div className="skel" style={{ height: 240 }} />
    </div>
  )
}
