import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useTx } from '../../lib/tx'
import { api, type AssistantAction, type ScoreResult, type StatementInput } from '../../lib/api'
import { DashboardLayout, type NavSpec, type Section } from './DashboardLayout'
import { Connect, type Picks } from './Connect'
import { CommandBar } from './CommandBar'
import { MyMoney } from './MyMoney'
import { Applicants } from './Applicants'
import { RevealScreen, ScoreScreen, LedgerScreen, AffordScreen } from './Result'
import { ModelCardPanel } from './ModelCardPanel'
import { ErrorState } from './ErrorState'
import { JudgeTour, markTourSeen, tourSeen } from './Tour'

const MY_CONNECTION = 'con_8842' // the signed-in user's own accounts (demo protagonist)
const DEFAULT_PICKS: Picks = { bank: 'alinma', wallet: 'barq' }

/** The Ask-Tabaqa fact set for one scored person — see copilotFacts below. */
function buildCopilotFacts(r: ScoreResult) {
  return {
    score: r.tabaqa_score,
    score_scale: 'score is 1-99, higher is better',
    risk_flag: r.risk_flag,
    bank_only_income_sar: r.income.bank_only_income,
    true_verified_income_sar: r.income.true_monthly_income,
    hidden_income_revealed_sar: r.income.reveal_delta,
    verified_income_share: r.income.verified_share,
    months_observed: r.confidence?.months_observed,
    top_reasons: r.reason_codes.slice(0, 5).map((c) => ({ label: c.label, points: c.points, polarity: c.polarity })),
    recourse: r.recourse ?? undefined,
    sama_dbr_cap_pct: { employee: 33.33, retiree: 25 },
  }
}

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

  // Ask-Tabaqa grounded facts: the on-screen person's REAL numbers, and the ONLY
  // numbers the copilot's LLM may use — enforced server-side by the grounding
  // firewall. In the Applicants section the copilot grounds on whoever the
  // lender is looking at (the committee show's Yousef beat); elsewhere, on the
  // signed-in profile.
  const [applicantResult, setApplicantResult] = useState<ScoreResult | null>(null)
  const copilotFacts = useMemo(() => {
    const src = section === 'applicants' ? applicantResult : themed
    return src ? buildCopilotFacts(src) : null
  }, [section, applicantResult, themed])

  // The copilot acts inside the app only: navigate sections / open the docs.
  function handleAction(a: AssistantAction) {
    if (a.type === 'navigate' && a.section) setSection(a.section as Section)
    else if (a.type === 'open' && a.target === 'developers') window.open('/developers', '_blank')
  }

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

  if (!connected) {
    return (
      <>
        <Connect onConnected={onConnected} />
        <CommandBar section="connect" connected={false} onAction={handleAction} />
      </>
    )
  }

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
        {section === 'applicants' ? (
          <Applicants onActiveResult={setApplicantResult} />
        ) : section === 'model' ? (
          <ModelCardPanel />
        ) : needsMine && !themed ? (
          err ? <ErrorState error={err} onRetry={retryLoad} /> : <LoadingScreen />
        ) : themed ? (
          <SectionBody section={section} result={themed} onNavigate={setSection} conn={insightsConn} />
        ) : null}
      </DashboardLayout>
      {/* Both are bottom-docked — while the tour coaches, the copilot yields the stage. */}
      {!tour && <CommandBar section={section} connected onAction={handleAction} facts={copilotFacts} />}
      {tour && <JudgeTour onNavigate={setSection} onClose={closeTour} />}
    </>
  )
}

function SectionBody({
  section, result, onNavigate, conn,
}: { section: Section; result: ScoreResult; onNavigate: (s: Section) => void; conn: { connectionId?: string; statement?: StatementInput } }) {
  if (section === 'home') return <MyMoney result={result} onNavigate={onNavigate} conn={conn} />
  if (section === 'income') return <IncomeScreen result={result} onOpenModel={() => onNavigate('model')} />
  if (section === 'ledger') return <LedgerScreen txns={result.transactions} />
  return <AffordScreen result={result} />
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
          <div className="section-head"><h1>{tx('The score', 'الدرجة')}</h1><p>{tx('Every point is explainable — no black box.', 'كل نقطة قابلة للتفسير — دون صندوق أسود.')}</p></div>
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
