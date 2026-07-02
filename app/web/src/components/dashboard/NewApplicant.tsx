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

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const GIG_PLATFORMS = ['Jahez', 'HungerStation', 'Mrsool', 'Careem', 'Uber']

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
  const [err, setErr] = useState<string | null>(null)
  const back = dir === 'rtl' ? '→' : '←'

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try {
      await fn()
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally {
      setBusy(false)
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

      {err && <div className="afford-err" style={{ marginTop: 14 }}>{err}</div>}

      <div className="newapp-body">
        {mode === 'upload' && <UploadMode busy={busy} run={run} onScored={onScored} />}
        {mode === 'form' && <FormMode busy={busy} run={run} onScored={onScored} />}
        {mode === 'persona' && <PersonaMode run={run} onScored={onScored} />}
      </div>
    </div>
  )
}

// ── upload mode ──────────────────────────────────────────────────────────────
function UploadMode({
  busy, run, onScored,
}: { busy: boolean; run: (fn: () => Promise<void>) => void; onScored: (p: ScoredPayload) => void }) {
  return (
    <StatementUpload
      busy={busy}
      onSubmit={(statement) =>
        run(async () => {
          const result = await api.scoreStatement(statement)
          onScored({ result, name: statement.name ?? 'Uploaded applicant', input_kind: 'statement', input: statement })
        })
      }
    />
  )
}

// ── guided form mode ─────────────────────────────────────────────────────────
function FormMode({
  busy, run, onScored,
}: { busy: boolean; run: (fn: () => Promise<void>) => void; onScored: (p: ScoredPayload) => void }) {
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
      onScored({ result, name, input_kind: 'form', input: form })
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
        <button className="btn btn-primary full" onClick={submit} disabled={busy}>
          {busy ? tx('Scoring…', 'جارٍ التقييم…') : tx('Reveal & score', 'اكشف وقيّم')}
        </button>
      </div>
    </div>
  )
}

// ── persona mode ─────────────────────────────────────────────────────────────
function PersonaMode({
  run, onScored,
}: { run: (fn: () => Promise<void>) => void; onScored: (p: ScoredPayload) => void }) {
  const { tx } = useTx()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [pickErr, setPickErr] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    api.personas()
      .then((p) => on && setPersonas(p))
      .catch((e) => on && setPickErr(e.message))
      .finally(() => on && setLoading(false))
    return () => { on = false }
  }, [])

  function pick(p: Persona) {
    setPicking(p.connection_id)
    run(async () => {
      try {
        const result = await api.scoreConnection(p.connection_id)
        onScored({ result, name: p.name, input_kind: 'persona', input: { connection_id: p.connection_id }, connection_id: p.connection_id })
      } finally {
        setPicking(null)
      }
    })
  }

  if (loading) return <div className="faint" style={{ padding: 24 }}>{tx('Loading personas…', 'جارٍ تحميل النماذج…')}</div>
  if (pickErr) return <div className="afford-err" style={{ marginTop: 14 }}>{pickErr}</div>

  return (
    <div className="persona-grid">
      {personas.map((p) => (
        <button key={p.id} className="persona-card" onClick={() => pick(p)} disabled={!!picking}>
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
          {picking === p.connection_id && <div className="persona-loading">{tx('Scoring…', 'جارٍ التقييم…')}</div>}
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
