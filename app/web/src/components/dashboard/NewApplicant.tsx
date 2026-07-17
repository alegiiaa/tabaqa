import { useEffect, useState } from 'react'
import { useTx } from '../../lib/tx'
import {
  api,
  type ScoreResult,
  type ApplicantFormInput,
  type Persona,
} from '../../lib/api'
import type { InputKind } from '../../lib/db'
import { num } from '../../lib/csv'
import { StatementUpload } from './StatementUpload'
import { ScorePipeline, factsFromResult, type PipelineFacts } from './ScorePipeline'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const GIG_PLATFORMS = ['Jahez', 'HungerStation', 'Mrsool', 'Careem', 'Uber']

/** Once the engine answers, hold the completed pipeline on screen just long
 *  enough to read the six lines it filled in — then hand over to the reveal. */
const SETTLE_MS = 900
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface ScoredPayload {
  result: ScoreResult
  name: string
  input_kind: InputKind
  input: any
  connection_id?: string | null
}

type Mode = 'upload' | 'form' | 'persona'

export function NewApplicant({
  onScored,
  onCancel,
}: {
  onScored: (p: ScoredPayload) => void
  onCancel: () => void
}) {
  const { tx, dir } = useTx()
  const [mode, setMode] = useState<Mode>('upload')
  const [busy, setBusy] = useState(false)
  const [facts, setFacts] = useState<PipelineFacts | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const back = dir === 'rtl' ? '→' : '←'

  /** Score, then let the pipeline settle with the real values before the reveal.
   *  The API is the only thing gating the result — the settle hold runs after it. */
  async function run(fn: () => Promise<ScoredPayload>) {
    setBusy(true); setErr(null); setFacts(null)
    try {
      const payload = await fn()
      setFacts(factsFromResult(payload.result))
      await sleep(SETTLE_MS)
      onScored(payload)
    } catch {
      setErr(tx(
        'Scoring didn’t go through. Check your connection and try again.',
        'لم يكتمل التقييم. تحقق من اتصالك وحاول مرة أخرى.',
      ))
      setBusy(false)
      setFacts(null)
    }
  }

  return (
    <div className="newapp">
      <div className="res-head">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          {back} {tx('All applicants', 'كل المتقدمين')}
        </button>
        <div className="res-title">
          <strong>{tx('New applicant', 'متقدم جديد')}</strong>
        </div>
      </div>

      {!busy && (
        <div className="res-tabs" role="tablist">
          {(['upload', 'form', 'persona'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={`res-tab${mode === m ? ' active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'upload' && tx('Upload statement', 'رفع كشف حساب')}
              {m === 'form' && tx('Guided form', 'نموذج موجّه')}
              {m === 'persona' && tx('Sample persona', 'نموذج جاهز')}
            </button>
          ))}
        </div>
      )}

      {err && <div className="afford-err" style={{ marginTop: 14 }}>{err}</div>}

      <div className="newapp-body">
        {busy ? (
          <ScorePipeline facts={facts} />
        ) : (
          <>
            {mode === 'upload' && <UploadMode run={run} />}
            {mode === 'form' && <FormMode run={run} />}
            {mode === 'persona' && <PersonaMode run={run} />}
          </>
        )}
      </div>
    </div>
  )
}

type Run = (fn: () => Promise<ScoredPayload>) => void

// ── upload mode ──────────────────────────────────────────────────────────────
function UploadMode({ run }: { run: Run }) {
  return (
    <StatementUpload
      busy={false}
      onSubmit={(statement) =>
        run(async () => {
          const result = await api.scoreStatement(statement)
          return { result, name: statement.name ?? 'Uploaded applicant', input_kind: 'statement', input: statement }
        })
      }
    />
  )
}

// ── guided form mode ─────────────────────────────────────────────────────────
function FormMode({ run }: { run: Run }) {
  const { tx } = useTx()
  const [name, setName] = useState('Form applicant')
  const [months, setMonths] = useState('3')
  const [bankOpening, setBankOpening] = useState('8000')
  const [salaryMonthly, setSalaryMonthly] = useState('4000')
  const [employer, setEmployer] = useState('شركة الأفق')
  const [gig1P, setGig1P] = useState('Jahez')
  const [gig1M, setGig1M] = useState('2600')
  const [gig2P, setGig2P] = useState('HungerStation')
  const [gig2M, setGig2M] = useState('2600')
  const [p2pFrom, setP2pFrom] = useState('عبدالله')
  const [p2pMonthly, setP2pMonthly] = useState('800')
  const [oblLabel, setOblLabel] = useState('قسط عقاري')
  const [oblMonthly, setOblMonthly] = useState('800')
  const [spending, setSpending] = useState('600')

  function submit() {
    run(async () => {
      const gigs = [
        { platform: gig1P, monthly: num(gig1M) ?? 0 },
        { platform: gig2P, monthly: num(gig2M) ?? 0 },
      ].filter((g) => g.monthly > 0)
      const p2p = num(p2pMonthly) ? [{ from: p2pFrom || 'فرد', monthly: num(p2pMonthly)! }] : []
      const obligations = num(oblMonthly) ? [{ label: oblLabel || 'تمويل', monthly: num(oblMonthly)! }] : []
      const form: ApplicantFormInput = {
        name,
        months: num(months) ?? 3,
        bank: { name: 'alinma', opening_balance: num(bankOpening) ?? 0 },
        salary: num(salaryMonthly) ? { monthly: num(salaryMonthly)!, employer } : null,
        gigs,
        p2p,
        obligations,
        monthly_spending: num(spending) ?? 0,
      }
      const result = await api.scoreForm(form)
      return { result, name, input_kind: 'form' as const, input: form }
    })
  }

  return (
    <div className="form-grid">
      <Group title={tx('Applicant', 'المتقدم')}>
        <L label={tx('Name', 'الاسم')}><input className="ti" value={name} onChange={(e) => setName(e.target.value)} /></L>
        <L label={tx('Months of history', 'عدد أشهر السجل')}><input className="ti" value={months} onChange={(e) => setMonths(e.target.value)} /></L>
        <L label={tx('Bank opening balance', 'رصيد البنك الافتتاحي')}><input className="ti" value={bankOpening} onChange={(e) => setBankOpening(e.target.value)} /></L>
      </Group>
      <Group title={tx('Salary (bank)', 'الراتب (البنك)')}>
        <L label={tx('Monthly', 'شهري')}><input className="ti" value={salaryMonthly} onChange={(e) => setSalaryMonthly(e.target.value)} /></L>
        <L label={tx('Employer', 'جهة العمل')}><input className="ti" value={employer} onChange={(e) => setEmployer(e.target.value)} /></L>
      </Group>
      <Group title={tx('Gig income (wallet)', 'دخل العمل الحر (المحفظة)')}>
        <L label={tx('Platform', 'المنصة')}>
          <select className="ti" value={gig1P} onChange={(e) => setGig1P(e.target.value)}>
            {GIG_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </L>
        <L label={tx('Monthly', 'شهري')}><input className="ti" value={gig1M} onChange={(e) => setGig1M(e.target.value)} /></L>
        <L label={tx('Platform 2', 'المنصة 2')}>
          <select className="ti" value={gig2P} onChange={(e) => setGig2P(e.target.value)}>
            {GIG_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </L>
        <L label={tx('Monthly', 'شهري')}><input className="ti" value={gig2M} onChange={(e) => setGig2M(e.target.value)} /></L>
      </Group>
      <Group title={tx('P2P / wallet inflow', 'تحويلات فردية / المحفظة')}>
        <L label={tx('From', 'من')}><input className="ti" value={p2pFrom} onChange={(e) => setP2pFrom(e.target.value)} /></L>
        <L label={tx('Monthly', 'شهري')}><input className="ti" value={p2pMonthly} onChange={(e) => setP2pMonthly(e.target.value)} /></L>
      </Group>
      <Group title={tx('Obligations & spending', 'الالتزامات والإنفاق')}>
        <L label={tx('Obligation label', 'وصف الالتزام')}><input className="ti" value={oblLabel} onChange={(e) => setOblLabel(e.target.value)} /></L>
        <L label={tx('Obligation / mo', 'الالتزام / شهر')}><input className="ti" value={oblMonthly} onChange={(e) => setOblMonthly(e.target.value)} /></L>
        <L label={tx('Card spending / mo', 'إنفاق البطاقة / شهر')}><input className="ti" value={spending} onChange={(e) => setSpending(e.target.value)} /></L>
      </Group>
      <div className="form-submit">
        <button className="btn btn-primary full" onClick={submit}>
          {tx('Reveal & score', 'اكشف وقيّم')}
        </button>
      </div>
    </div>
  )
}

// ── persona mode ─────────────────────────────────────────────────────────────
function PersonaMode({ run }: { run: Run }) {
  const { tx } = useTx()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [pickErr, setPickErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    api.personas()
      .then((p) => on && setPersonas(p))
      .catch(() => on && setPickErr(tx(
        'Couldn’t load the sample personas. Check your connection and reopen this tab — or use Upload / Guided form instead.',
        'تعذّر تحميل النماذج الجاهزة. تحقق من اتصالك وأعد فتح هذا التبويب — أو استخدم رفع الكشف / النموذج الموجّه.',
      )))
      .finally(() => on && setLoading(false))
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function pick(p: Persona) {
    run(async () => {
      const result = await api.scoreConnection(p.connection_id)
      return {
        result,
        name: p.name,
        input_kind: 'persona' as const,
        input: { connection_id: p.connection_id },
        connection_id: p.connection_id,
      }
    })
  }

  if (loading) return (
    <div className="skel-wrap" aria-busy="true" style={{ marginTop: 14 }}>
      <div className="skel" style={{ height: 110 }} />
      <div className="skel" style={{ height: 110 }} />
    </div>
  )
  if (pickErr) return <div className="afford-err" style={{ marginTop: 14 }}>{pickErr}</div>
  if (personas.length === 0) return (
    <div className="empty" style={{ marginTop: 14 }}>
      <div className="empty-icon">⬡</div>
      <div className="empty-title">{tx('No sample personas available', 'لا توجد نماذج جاهزة متاحة')}</div>
      <p className="faint">{tx('Use Upload statement or the Guided form to score an applicant.', 'استخدم رفع الكشف أو النموذج الموجّه لتقييم متقدم.')}</p>
    </div>
  )

  return (
    <div className="persona-grid">
      {personas.map((p) => (
        <button key={p.id} className="persona-card" onClick={() => pick(p)}>
          <div className="persona-role">{p.role}</div>
          <div className="persona-name">{p.name}</div>
          <div className="persona-reveal">
            <span className="faint">{fmt(p.bank_only_income)}</span>
            <span className="arr">→</span>
            <span className="accent-num">{fmt(p.true_monthly_income)}</span>
          </div>
          <div className="persona-foot">
            <span className="tag t-src">{tx('Score', 'الدرجة')} {p.tabaqa_score}</span>
            <span className={`tag ${p.risk_flag === 'low' ? 't-ok' : 't-inf'}`}>{p.risk_flag}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── small layout helpers ─────────────────────────────────────────────────────
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <div className="side-title">{title}</div>
      <div className="form-fields">{children}</div>
    </div>
  )
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ti-field">
      <span>{label}</span>
      {children}
    </label>
  )
}
