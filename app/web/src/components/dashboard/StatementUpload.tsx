import { useMemo, useState } from 'react'
import { useTx } from '../../lib/tx'
import type { StatementInput } from '../../lib/api'
import { num, SAMPLE_CSV } from '../../lib/csv'
import { detectStatement, mergeStatements, type DetectedStatement } from '../../lib/adapters'
import { SAMPLE_EXPORTS, SAMPLE_EXPORT_CONTEXT } from '../../lib/sampleStatements'
import { institution } from '../../lib/institutions'

/**
 * Reusable bank/wallet statement uploader. Accepts ANY export format — one file
 * per account (e.g. an Alinma e-statement + an urpay export) or pasted CSV —
 * runs each through the universal adapter (`lib/adapters.ts`), shows what was
 * detected, and hands a merged `StatementInput` to `onSubmit`. The caller does
 * the scoring (so it works for both the Applicants flow and the Connect flow).
 */
export function StatementUpload({
  busy,
  onSubmit,
  initialName = 'Uploaded applicant',
  submitLabel,
  contextOverrides,
}: {
  busy: boolean
  onSubmit: (statement: StatementInput) => void
  initialName?: string
  submitLabel?: string
  /** Merged into the statement context — e.g. bank_name/wallet_name from the picker. */
  contextOverrides?: { bank_name?: string; wallet_name?: string }
}) {
  const { tx } = useTx()
  const [name, setName] = useState(initialName)
  const [files, setFiles] = useState<DetectedStatement[]>([])
  const [csv, setCsv] = useState('')
  const [employer, setEmployer] = useState('')
  const [salaryIban, setSalaryIban] = useState('')
  const [monthlyWage, setMonthlyWage] = useState('')
  const [gigPlatforms, setGigPlatforms] = useState('')
  const [bankOpening, setBankOpening] = useState('')
  const [walletOpening, setWalletOpening] = useState('')

  // pasted CSV goes through the same universal adapter as picked files
  const pasted = useMemo(() => (csv.trim() ? detectStatement(csv) : null), [csv])
  const detected = pasted ? [...files, pasted] : files
  const totalRows = detected.reduce((n, f) => n + f.rows.length, 0)

  function loadSampleExports() {
    setFiles(SAMPLE_EXPORTS.map((f) => detectStatement(f.text, { fileName: f.fileName })))
    setCsv('')
    setName(SAMPLE_EXPORT_CONTEXT.name)
    setEmployer(SAMPLE_EXPORT_CONTEXT.employer)
    setSalaryIban(SAMPLE_EXPORT_CONTEXT.salaryIban)
    setMonthlyWage(SAMPLE_EXPORT_CONTEXT.monthlyWage)
    setGigPlatforms(SAMPLE_EXPORT_CONTEXT.gigPlatforms)
    setBankOpening(SAMPLE_EXPORT_CONTEXT.bankOpening)
    setWalletOpening(SAMPLE_EXPORT_CONTEXT.walletOpening)
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
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-picking the same file
    picked.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () =>
        setFiles((prev) => [...prev, detectStatement(String(reader.result ?? ''), { fileName: file.name })])
      reader.readAsText(file)
    })
  }

  function submit() {
    const opening_balances: Record<string, number> = {}
    if (num(bankOpening) !== undefined) opening_balances['bank'] = num(bankOpening)!
    if (num(walletOpening) !== undefined) opening_balances['wallet'] = num(walletOpening)!
    const statement: StatementInput = {
      name,
      rows: mergeStatements(detected),
      context: {
        opening_balances,
        employer: employer || undefined,
        salary_iban: salaryIban || undefined,
        monthly_wage: num(monthlyWage),
        gig_platforms: gigPlatforms
          ? gigPlatforms.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        ...contextOverrides,
      },
    }
    onSubmit(statement)
  }

  return (
    <div className="mode-grid">
      <div className="mode-main">
        <p className="mode-help">
          {tx(
            'Add any bank or wallet export — Tabaqa auto-detects the format: Arabic or English headers, debit/credit or signed amounts, any date style (even Hijri). Add one file per account, e.g. an Alinma statement + an urpay export.',
            'أضف أي كشف حساب بنكي أو محفظة — تتعرّف Tabaqa على الصيغة تلقائيًا: عناوين عربية أو إنجليزية، مدين/دائن أو مبالغ مُوقّعة، وأي صيغة تاريخ (حتى الهجري). أضف ملفًا لكل حساب، مثل كشف الإنماء + تصدير urpay.',
          )}
        </p>
        <div className="upload-actions">
          <label className="btn btn-ghost btn-sm file-btn">
            {tx('Add statements…', 'أضف كشوف حساب…')}
            <input type="file" accept=".csv,.txt,text/csv,text/plain" multiple onChange={onFile} hidden />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={loadSampleExports}>
            {tx('Load Alinma + urpay exports', 'حمّل كشف الإنماء + urpay')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={downloadSample}>{tx('Download template', 'تنزيل القالب')}</button>
        </div>

        {files.length > 0 && (
          <div className="upl-files">
            {files.map((f, i) => {
              const inst = f.institutionId ? institution(f.institutionId) : undefined
              return (
                <div key={`${f.fileName ?? 'file'}-${i}`} className="upl-file">
                  <span className={`upl-file-kind ${f.kind ?? 'bank'}`}>
                    {f.kind === 'wallet' ? tx('Wallet', 'محفظة') : tx('Bank', 'بنك')}
                  </span>
                  <span className="upl-file-name">
                    {inst ? tx(inst.name[0], inst.name[1]) : (f.fileName ?? tx('Pasted statement', 'كشف ملصوق'))}
                  </span>
                  <span className="upl-file-meta" dir="ltr">
                    {f.rows.length} {tx('rows', 'صف')}{f.formatLabel ? ` · ${f.formatLabel}` : ''}
                  </span>
                  {f.warnings.length > 0 && (
                    <span className="upl-file-warn" title={f.warnings.join('\n')}>!</span>
                  )}
                  <button
                    className="upl-file-x"
                    aria-label={tx('Remove file', 'إزالة الملف')}
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  >×</button>
                </div>
              )
            })}
          </div>
        )}

        <textarea
          className="csv-area"
          dir="ltr"
          placeholder={tx('…or paste statement rows here (any CSV layout)', '…أو الصق صفوف الكشف هنا (بأي تنسيق CSV)')}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="faint small">
          {totalRows} {tx('rows parsed', 'صف تم تحليله')}
          {pasted?.formatLabel ? <span dir="ltr"> · {pasted.formatLabel}</span> : null}
          {pasted?.warnings.length ? <span className="upl-warn-text"> · {pasted.warnings.join(' · ')}</span> : null}
        </div>
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
        <button className="btn btn-primary full" onClick={submit} disabled={busy || totalRows === 0}>
          {busy ? tx('Scoring…', 'جارٍ التقييم…') : (submitLabel ?? tx('Reveal & score', 'اكشف وقيّم'))}
        </button>
      </div>
    </div>
  )
}
