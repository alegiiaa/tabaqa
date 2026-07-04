import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useTx } from '../../lib/tx'
import { api, type ScoreResult, type StatementInput } from '../../lib/api'
import { DashboardLayout, type NavSpec, type Section } from './DashboardLayout'
import { Connect, type Picks } from './Connect'
import { MyMoney } from './MyMoney'
import { Applicants } from './Applicants'
import { RevealScreen, ScoreScreen, LedgerScreen, AffordScreen } from './Result'
import { ModelCardPanel } from './ModelCardPanel'

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
  const [section, setSection] = useState<Section>('home')
  const [my, setMy] = useState<ScoreResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // If we land already-connected (e.g. a page refresh), reload the profile fresh:
  // demo → re-score the canonical connection; own-data → re-score the saved
  // statement (fall back to Connect if it's missing, e.g. cleared storage).
  useEffect(() => {
    if (!connected || my) return
    let on = true
    if (picks.mode === 'own_data') {
      if (!input) { setConnected(false); return }
      api.scoreStatement(input)
        .then((r) => on && setMy(r))
        .catch((e) => on && setErr(e.message ?? String(e)))
    } else {
      api.scoreConnection(MY_CONNECTION)
        .then((r) => on && setMy(r))
        .catch((e) => on && setErr(e.message ?? String(e)))
    }
    return () => { on = false }
  }, [connected, my, picks.mode, input])

  // Own-data sources are already correct (branded via bank_name/wallet_name on
  // ingest), so skip the demo retheme; only the demo profile needs re-branding.
  const themed = useMemo(
    () => (picks.mode === 'own_data' ? my : (my ? rethemeResult(my, picks) : null)),
    [my, picks],
  )

  function onConnected(r: ScoreResult, p: Picks, inp?: StatementInput) {
    setMy(r)
    setPicks(p)
    setInput(inp ?? null)
    setConnected(true)
    setSection('home')
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

  if (!connected) return <Connect onConnected={onConnected} />

  const nav: NavSpec[] = [
    { id: 'home', label: tx('Dashboard', 'الرئيسية'), cap: tx('My money', 'أموالي') },
    { id: 'income', label: tx('Income & score', 'الدخل والدرجة') },
    { id: 'ledger', label: tx('Ledger', 'السجل') },
    { id: 'financing', label: tx('Financing', 'التمويل') },
    { id: 'applicants', label: tx('Applicants', 'المتقدمون'), cap: tx('Lender tools', 'أدوات المموّل') },
    { id: 'model', label: tx('Model validation', 'التحقق من النموذج') },
  ]

  const META: Record<Section, { title: string; sub: string }> = {
    home: { title: tx('Dashboard', 'الرئيسية'), sub: tx('Your verified money picture — bank + wallet.', 'صورتك المالية الموثّقة — البنك + المحفظة.') },
    income: { title: tx('Income & score', 'الدخل والدرجة'), sub: tx('Bank-only vs. your true verified income, and why.', 'دخل البنك مقابل دخلك الحقيقي الموثّق، ولماذا.') },
    ledger: { title: tx('Ledger', 'السجل'), sub: tx('Unified bank + wallet activity, labelled.', 'نشاط موحّد للبنك والمحفظة، موسوم.') },
    financing: { title: tx('Financing', 'التمويل'), sub: tx('How much you can safely borrow on your real income.', 'كم يمكنك أن تقترض بأمان بناءً على دخلك الحقيقي.') },
    applicants: { title: tx('Applicants', 'المتقدمون'), sub: tx('Score other people for lending decisions.', 'قيّم أشخاصًا آخرين لاتخاذ قرارات الإقراض.') },
    model: { title: tx('Model validation', 'التحقق من النموذج'), sub: tx('How the Tabaqa score performs on real default outcomes.', 'كيف يؤدي نموذج طبقة على نتائج تعثّر حقيقية.') },
  }

  const meta = META[section]
  const needsMine = section !== 'applicants' && section !== 'model'
  // Where the Financial-intelligence panel should source its Claude narrative from.
  const insightsConn = picks.mode === 'own_data' && input
    ? { statement: input }
    : { connectionId: MY_CONNECTION }

  return (
    <DashboardLayout
      active={section}
      onNavigate={setSection}
      nav={nav}
      title={meta.title}
      subtitle={meta.sub}
      onReconnect={reconnect}
    >
      {section === 'applicants' ? (
        <Applicants />
      ) : section === 'model' ? (
        <ModelCardPanel />
      ) : needsMine && !themed ? (
        err ? <div className="afford-err">{err}</div> : <LoadingScreen />
      ) : themed ? (
        <SectionBody section={section} result={themed} onNavigate={setSection} conn={insightsConn} />
      ) : null}
    </DashboardLayout>
  )
}

function SectionBody({
  section, result, onNavigate, conn,
}: { section: Section; result: ScoreResult; onNavigate: (s: Section) => void; conn: { connectionId?: string; statement?: StatementInput } }) {
  const { tx } = useTx()
  if (section === 'home') return <MyMoney result={result} onNavigate={onNavigate} conn={conn} />
  if (section === 'income') return <IncomeScreen result={result} />
  if (section === 'ledger') return <LedgerScreen txns={result.transactions} />
  return <AffordScreen result={result} />
}

// Holds the score section back until the reveal has played — no spoilers
// under the DECLINE chip.
function IncomeScreen({ result }: { result: ScoreResult }) {
  const { tx } = useTx()
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="screen">
      <RevealScreen result={result} onRevealed={setRevealed} />
      {revealed && (
        <>
          <div style={{ height: 22 }} />
          <div className="section-head"><h1>{tx('The score', 'الدرجة')}</h1><p>{tx('Every point is explainable — no black box.', 'كل نقطة قابلة للتفسير — دون صندوق أسود.')}</p></div>
          <ScoreScreen result={result} />
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
