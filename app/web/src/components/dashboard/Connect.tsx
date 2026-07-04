import { useEffect, useMemo, useRef, useState } from 'react'
import { useTx } from '../../lib/tx'
import { TabaqaMark } from '../Logo'
import { api, type ScoreResult, type StatementInput } from '../../lib/api'
import { BANKS, WALLETS, logoUrl, type Institution } from '../../lib/institutions'
import { StatementUpload } from './StatementUpload'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

// The signed-in user's own accounts (the demo protagonist, Fahd / con_8842).
const MY_CONNECTION = 'con_8842'

export interface Picks { bank: string; wallet: string; mode?: 'demo' | 'own_data' }

type Stage = 'idle' | 'pulling' | 'reveal'
type Mode = 'demo' | 'own_data'

/** Count a value from 0 → target with an ease-out cubic, gated on `run`. */
function useCountUp(target: number, run: boolean, ms = 1200): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) return
    let raf = 0
    let start: number | null = null
    const tick = (t: number) => {
      if (start === null) start = t
      const p = Math.min(1, (t - start) / ms)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return v
}

export function Connect({
  onConnected,
}: {
  onConnected: (result: ScoreResult, picks: Picks, input?: StatementInput) => void
}) {
  const { tx } = useTx()
  const [stage, setStage] = useState<Stage>('idle')
  const [mode, setMode] = useState<Mode>('demo')
  // default to one bank + one wallet so the happy path is a single "Continue".
  const [selected, setSelected] = useState<Set<string>>(new Set(['alinma', 'barq']))
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [ownInput, setOwnInput] = useState<StatementInput | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const fetched = useRef(false)

  const SAR = tx('SAR', 'ر.س')
  const pickedBank = BANKS.find((b) => selected.has(b.id))
  const pickedWallet = WALLETS.find((w) => selected.has(w.id))
  const canContinue = !!pickedBank && !!pickedWallet

  const filter = (list: Institution[]) => {
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((i) => i.id.includes(q) || i.name[0].toLowerCase().includes(q) || i.name[1].includes(query.trim()))
  }
  const banks = useMemo(() => filter(BANKS), [query])
  const wallets = useMemo(() => filter(WALLETS), [query])

  const bankName = pickedBank ? tx(pickedBank.name[0], pickedBank.name[1]) : tx('your bank', 'بنكك')
  const walletName = pickedWallet ? tx(pickedWallet.name[0], pickedWallet.name[1]) : tx('your wallet', 'محفظتك')

  const STEPS: [string, string][] = [
    ['Verifying consent…', 'يتم التحقق من الموافقة…'],
    [`Pulling ${bankName} transactions…`, `يتم سحب عمليات ${bankName}…`],
    [`Pulling ${walletName} activity…`, `يتم سحب نشاط ${walletName}…`],
    ['Reconciling & verifying income…', 'مطابقة الدخل والتحقق منه…'],
  ]

  // Prefetch the demo profile in the background as soon as the user starts
  // connecting. In own-data mode the result comes from submitOwnData instead.
  useEffect(() => {
    if (mode !== 'demo' || stage !== 'pulling' || fetched.current) return
    fetched.current = true
    api.scoreConnection(MY_CONNECTION).then(setResult).catch((e) => setErr(e.message ?? String(e)))
  }, [stage, mode])

  useEffect(() => {
    if (stage !== 'pulling') return
    const ticker = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 650)
    return () => clearInterval(ticker)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  useEffect(() => {
    if (stage !== 'pulling' || !result) return
    const t = setTimeout(() => setStage('reveal'), 1500)
    return () => clearTimeout(t)
  }, [stage, result])

  const inc = result?.income
  const trueIncome = useCountUp(inc?.true_monthly_income ?? 0, stage === 'reveal')

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function start() {
    if (!canContinue) return
    setStepIdx(0)
    setStage('pulling')
  }

  // Own-data path: score the user's uploaded statement, then reuse the same
  // "pulling → reveal" animation (the result→reveal effect below fires for both).
  async function submitOwnData(statement: StatementInput) {
    setErr(null)
    setStepIdx(0)
    setStage('pulling')
    try {
      const r = await api.scoreStatement(statement)
      setOwnInput(statement)
      setResult(r)
    } catch (e: any) {
      setErr(e.message ?? String(e))
      setStage('idle')
    }
  }

  return (
    <div className="connect-wrap">
      <div className={`connect-card${stage === 'idle' && mode === 'own_data' ? ' wide' : ''}`}>
        <div className="connect-mark">
          <TabaqaMark variant="gradient" />
          <span>Tabaqa</span>
        </div>

        {stage === 'idle' && (
          <>
            <div className="connect-eyebrow">{tx('Open banking · consent', 'المصرفية المفتوحة · موافقة')}</div>
            <h1>{tx('Connect your accounts', 'اربط حساباتك')}</h1>
            <p className="lead2">
              {tx(
                'Pick the bank and wallet you use. Tabaqa reads them — with your consent, read-only — to reveal income the bank alone never sees.',
                'اختر البنك والمحفظة اللذين تستخدمهما. تقرأهما Tabaqa — بموافقتك وقراءة فقط — لكشف دخلٍ لا يراه البنك وحده.',
              )}
            </p>

            <div className="connect-modes" role="tablist">
              <button
                role="tab"
                aria-selected={mode === 'demo'}
                className={`connect-mode${mode === 'demo' ? ' on' : ''}`}
                onClick={() => { setMode('demo'); setErr(null) }}
              >
                {tx('Demo data', 'بيانات تجريبية')}
              </button>
              <button
                role="tab"
                aria-selected={mode === 'own_data'}
                className={`connect-mode${mode === 'own_data' ? ' on' : ''}`}
                onClick={() => { setMode('own_data'); setErr(null) }}
              >
                {tx('My data', 'بياناتي')}
              </button>
            </div>

            <input
              className="inst-search"
              placeholder={tx('Search banks & wallets…', 'ابحث عن البنوك والمحافظ…')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <InstGroup title={tx('Banks', 'البنوك')} items={banks} selected={selected} onToggle={toggle} />
            <InstGroup title={tx('Wallets', 'المحافظ')} items={wallets} selected={selected} onToggle={toggle} />

            {mode === 'demo' ? (
              <>
                <div className="connect-summary">
                  {tx('Connecting', 'يتم ربط')}: <b>{bankName}</b> · <b>{walletName}</b>
                </div>

                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
                  disabled={!canContinue} onClick={start}>
                  {canContinue
                    ? tx('Reveal my real income', 'اكشف دخلي الحقيقي')
                    : tx('Pick a bank and a wallet', 'اختر بنكًا ومحفظة')}
                </button>
              </>
            ) : canContinue ? (
              <div className="connect-own" style={{ marginTop: 16 }}>
                <div className="connect-summary" style={{ marginTop: 0 }}>
                  {tx('Branding as', 'العرض باسم')}: <b>{bankName}</b> · <b>{walletName}</b>
                </div>
                {err && <div className="connect-own-err">{err}</div>}
                <StatementUpload
                  busy={false}
                  submitLabel={tx('Reveal my real income', 'اكشف دخلي الحقيقي')}
                  contextOverrides={{ bank_name: pickedBank!.id, wallet_name: pickedWallet!.id }}
                  onSubmit={submitOwnData}
                />
              </div>
            ) : (
              <div className="connect-summary">
                {tx('Pick a bank and a wallet above, then upload your statement.', 'اختر بنكًا ومحفظة أعلاه، ثم ارفع كشف حسابك.')}
              </div>
            )}

            <div className="connect-consent">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z" /></svg>
              <span>{tx('SAMA open-banking consent · revocable anytime · read-only access. Your hidden income usually lives in the wallet.', 'موافقة المصرفية المفتوحة من البنك المركزي · قابلة للإلغاء في أي وقت · قراءة فقط. دخلك الخفي غالبًا في المحفظة.')}</span>
            </div>
          </>
        )}

        {stage === 'pulling' && (
          <div className="connect-pulling">
            <div className="connect-spinner" />
            <h1>{tx('Building your money picture', 'نُجهّز صورتك المالية')}</h1>
            <div className="connect-steps">{err ? err : tx(STEPS[stepIdx][0], STEPS[stepIdx][1])}</div>
          </div>
        )}

        {stage === 'reveal' && inc && (
          <div className="connect-reveal">
            <div className="connect-reveal-cap">{tx('What the bank saw  →  what you actually earn', 'ما رآه البنك ← ما تكسبه فعلًا')}</div>
            <div className="connect-reveal-flow">
              <span className="connect-reveal-num dim">{fmt(inc.bank_only_income)}</span>
              <span className="connect-reveal-arrow">→</span>
              <span className="connect-reveal-num hot">{fmt(trueIncome)}</span>
            </div>
            <div className="connect-reveal-delta">
              <span className="dot" />
              {tx('Revealed', 'مكشوف')} <b><span dir="ltr">+{fmt(inc.reveal_delta)}</span> {SAR}</b> {tx('/ month', '/ شهريًا')}
            </div>
            <p className="lead2" style={{ marginTop: 16 }}>
              {tx(
                `Your ${walletName} income is now verified and counted. Here is your full dashboard.`,
                `تم الآن التحقق من دخل ${walletName} واحتسابه. إليك لوحتك الكاملة.`,
              )}
            </p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}
              onClick={() => onConnected(
                result!,
                { bank: pickedBank!.id, wallet: pickedWallet!.id, mode },
                mode === 'own_data' ? ownInput! : undefined,
              )}>
              {tx('Go to my dashboard →', 'إلى لوحتي ←')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Real brand logo where verified; falls back to the colored monogram chip. */
function InstLogo({ inst }: { inst: Institution }) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : logoUrl(inst)
  if (src) {
    // Full-bleed app icons fill the tile; framed marks + favicons keep the white frame.
    const full = !!inst.logoFull
    return (
      <span className={`inst-logo${full ? ' full' : ' on-white'}`}>
        <img className={`inst-logo-img${full ? ' full' : ''}`} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      </span>
    )
  }
  return <span className="inst-logo" style={{ background: inst.bg }}>{inst.monogram}</span>
}

function InstGroup({
  title, items, selected, onToggle,
}: { title: string; items: Institution[]; selected: Set<string>; onToggle: (id: string) => void }) {
  const { tx } = useTx()
  if (items.length === 0) return null
  return (
    <div className="inst-group">
      <div className="inst-group-cap">{title}</div>
      <div className="inst-grid">
        {items.map((i) => {
          const on = selected.has(i.id)
          return (
            <button key={i.id} className={`inst-tile${on ? ' on' : ''}`} onClick={() => onToggle(i.id)} aria-pressed={on}>
              <InstLogo inst={i} />
              <span className="inst-name">{tx(i.name[0], i.name[1])}</span>
              {on && (
                <span className="inst-check">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
