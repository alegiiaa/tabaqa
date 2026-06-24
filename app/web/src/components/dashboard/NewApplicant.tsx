import { useEffect, useState } from 'react'
import { useTx } from '../../lib/tx'
import {
  api,
  type ScoreResult,
  type StatementInput,
  type StatementRowInput,
  type ApplicantFormInput,
  type Persona,
} from '../../lib/api'
import type { InputKind } from '../../lib/db'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const GIG_PLATFORMS = ['Jahez', 'HungerStation', 'Mrsool', 'Careem', 'Uber']

const SAMPLE_IBAN = 'SA0380000000608010167519'
const SAMPLE_CSV = `date,description,amount,source,counterparty_iban
2026-03-05,قسط تمويل عقاري,-800,bank,
2026-03-12,مدى - بنده الرياض,-600,bank,
2026-03-27,راتب - شركة الأفق للتجارة,4000,bank,${SAMPLE_IBAN}
2026-03-15,JAHEZ-RYD دفعة,2600,wallet,
2026-03-18,تحويل من عبدالله,800,wallet,
2026-03-22,HUNGERSTATION SA,2600,wallet,
2026-04-05,قسط تمويل عقاري,-800,bank,
2026-04-12,مدى - بنده الرياض,-600,bank,
2026-04-27,راتب - شركة الأفق للتجارة,4000,bank,${SAMPLE_IBAN}
2026-04-15,JAHEZ-RYD دفعة,2700,wallet,
2026-04-18,تحويل من عبدالله,800,wallet,
2026-04-22,HUNGERSTATION SA,2500,wallet,
2026-05-05,قسط تمويل عقاري,-800,bank,
2026-05-12,مدى - بنده الرياض,-600,bank,
2026-05-27,راتب - شركة الأفق للتجارة,4000,bank,${SAMPLE_IBAN}
2026-05-15,JAHEZ-RYD دفعة,2550,wallet,
2026-05-18,تحويل من عبدالله,800,wallet,
2026-05-22,HUNGERSTATION SA,2650,wallet,
`

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

// ── CSV helpers ──────────────────────────────────────────────────────────────
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else q = false
      } else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length)
  if (!lines.length) return []
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()))
    return row
  })
}

const num = (s?: string) => {
  if (s === undefined || s === '') return undefined
  const v = parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(v) ? v : undefined
}

function rowsToStatement(rows: Record<string, string>[]): StatementRowInput[] {
  return rows.map((r) => ({
    date: r.date || r.timestamp || '',
    description: r.description || r.raw_desc || '',
    amount: num(r.amount),
    debit: num(r.debit),
    credit: num(r.credit),
    source: r.source || '',
    counterparty_iban: r.counterparty_iban || undefined,
    balance: num(r.balance),
  }))
}

// ── upload mode ──────────────────────────────────────────────────────────────
function UploadMode({
  busy, run, onScored,
}: { busy: boolean; run: (fn: () => Promise<void>) => void; onScored: (p: ScoredPayload) => void }) {
  const { tx } = useTx()
  const [name, setName] = useState('Uploaded applicant')
  const [csv, setCsv] = useState('')
  const [employer, setEmployer] = useState('')
  const [salaryIban, setSalaryIban] = useState('')
  const [monthlyWage, setMonthlyWage] = useState('')
  const [gigPlatforms, setGigPlatforms] = useState('')
  const [bankOpening, setBankOpening] = useState('')
  const [walletOpening, setWalletOpening] = useState('')

  const rows = csv ? parseCsv(csv) : []

  function loadSample() {
    setCsv(SAMPLE_CSV)
    setName('Fahd A. (sample)')
    setEmployer('شركة الأفق للتجارة')
    setSalaryIban(SAMPLE_IBAN)
    setMonthlyWage('4000')
    setGigPlatforms('Jahez, HungerStation')
    setBankOpening('8000')
    setWalletOpening('300')
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tabaqa-sample-statement.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  function submit() {
    run(async () => {
      const opening_balances: Record<string, number> = {}
      if (num(bankOpening) !== undefined) opening_balances['bank'] = num(bankOpening)!
      if (num(walletOpening) !== undefined) opening_balances['wallet'] = num(walletOpening)!
      const statement: StatementInput = {
        name,
        rows: rowsToStatement(rows),
        context: {
          opening_balances,
          employer: employer || undefined,
          salary_iban: salaryIban || undefined,
          monthly_wage: num(monthlyWage),
          gig_platforms: gigPlatforms
            ? gigPlatforms.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        },
      }
      const result = await api.scoreStatement(statement)
      onScored({ result, name, input_kind: 'statement', input: statement })
    })
  }

  return (
    <div className="mode-grid">
      <div className="mode-main">
        <p className="mode-help">
          {tx(
            'Upload a CSV with columns: date, description, amount (+ inflow / − outflow), source (bank|wallet), and optional counterparty_iban / balance.',
            'ارفع ملف CSV بالأعمدة: date و description و amount (+ وارد / − صادر) و source (bank|wallet) واختياريًا counterparty_iban / balance.',
          )}
        </p>
        <div className="upload-actions">
          <label className="btn btn-ghost btn-sm file-btn">
            {tx('Choose CSV…', 'اختر ملف CSV…')}
            <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={loadSample}>{tx('Load sample', 'تحميل عيّنة')}</button>
          <button className="btn btn-ghost btn-sm" onClick={downloadSample}>{tx('Download template', 'تنزيل القالب')}</button>
        </div>
        <textarea
          className="csv-area"
          dir="ltr"
          placeholder="date,description,amount,source,counterparty_iban&#10;2026-03-27,راتب,4000,bank,SA03..."
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="faint small">{rows.length} {tx('rows parsed', 'صف تم تحليله')}</div>
      </div>

      <div className="mode-side">
        <div className="side-title">{tx('Name', 'الاسم')}</div>
        <input className="ti" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="side-title">
          {tx('Verification context', 'سياق التحقّق')}
          <span className="faint small"> · {tx('optional — unlocks Masdr tiers', 'اختياري — يُفعّل مستويات مصدر')}</span>
        </div>
        <input className="ti" placeholder={tx('Employer', 'جهة العمل')} value={employer} onChange={(e) => setEmployer(e.target.value)} />
        <input className="ti" dir="ltr" placeholder={tx('Salary IBAN', 'آيبان الراتب')} value={salaryIban} onChange={(e) => setSalaryIban(e.target.value)} />
        <input className="ti" placeholder={tx('Monthly wage', 'الراتب الشهري')} value={monthlyWage} onChange={(e) => setMonthlyWage(e.target.value)} />
        <input className="ti" placeholder={tx('Gig platforms (comma-sep)', 'منصات العمل الحر (مفصولة بفاصلة)')} value={gigPlatforms} onChange={(e) => setGigPlatforms(e.target.value)} />
        <div className="two-col">
          <input className="ti" placeholder={tx('Bank opening', 'رصيد البنك الافتتاحي')} value={bankOpening} onChange={(e) => setBankOpening(e.target.value)} />
          <input className="ti" placeholder={tx('Wallet opening', 'رصيد المحفظة الافتتاحي')} value={walletOpening} onChange={(e) => setWalletOpening(e.target.value)} />
        </div>
        <button className="btn btn-primary full" onClick={submit} disabled={busy || rows.length === 0}>
          {busy ? tx('Scoring…', 'جارٍ التقييم…') : tx('Reveal & score', 'اكشف وقيّم')}
        </button>
      </div>
    </div>
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
