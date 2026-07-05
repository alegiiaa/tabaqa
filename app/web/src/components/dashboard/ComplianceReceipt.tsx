import { useMemo } from 'react'
import { useTx } from '../../lib/tx'
import type { ScoreResult, AffordabilityResult } from '../../lib/api'
import { StyledQR } from '../StyledQR'
import { encodeReceipt, shortHash, type ReceiptFacts } from '../../lib/reportlink'

/**
 * F1 · Compliance Receipt — the decision as a filable regulatory artifact.
 * Every check is COMPUTED from the actual decision (a DECLINE prints an honest ✗
 * with the numbers), never hard-coded: that honesty is the feature. The panel is
 * the in-product view; "Print / PDF" opens the A4 document at /receipt?rc=…, and
 * the QR resolves to /verify?rc=… — both self-contained tokens, same architecture
 * as the credit report (no server-side registry).
 */

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`

interface Check { ok: boolean; label: string; detail: string }

export function ComplianceReceipt({
  result,
  out,
  amount,
  tenor,
}: {
  result: ScoreResult
  out: AffordabilityResult
  amount: number
  tenor: number
}) {
  const { tx } = useTx()
  const SAR = tx('SAR', 'ر.س')

  const cap = out.dbr_policy?.cap ?? out.dbr_cap
  const dbrFinite = Number.isFinite(out.dbr_after)
  const vs = result.income.verified_share
  const nReasons = result.reason_codes.length

  const checks: Check[] = [
    {
      ok: dbrFinite && out.dbr_after <= cap + 1e-9,
      label: tx('DBR within the SAMA cap', 'نسبة الدين ضمن سقف ساما'),
      detail: dbrFinite
        ? `${tx('DBR after financing', 'نسبة الدين بعد التمويل')} ${pct1(out.dbr_after)} ${out.dbr_after <= cap + 1e-9 ? '≤' : '>'} ${pct1(cap)}${out.dbr_policy ? ` · ${out.dbr_policy.label}` : ''}`
        : tx('No verifiable income — DBR not computable', 'لا دخل قابل للتحقّق — النسبة غير قابلة للحساب'),
    },
    {
      ok: out.verified_income > 0 && vs >= 0.5,
      label: tx('Decision built on verified income', 'القرار مبني على دخل موثّق'),
      detail: `${Math.round(vs * 100)}% ${tx('of income amount- or source-verified · 3-tier method', 'من الدخل موثّق المبلغ أو المصدر · تحقّق ثلاثي')}`,
    },
    {
      ok: nReasons > 0,
      label: tx('Adverse-action reasons attached', 'أسباب القرار مرفقة'),
      detail: `${nReasons} ${tx('machine-readable reason codes', 'رمز سبب قابل للقراءة الآلية')}${result.recourse ? tx(' · recourse path available', ' · مع مسار للتحسين') : ''}`,
    },
    {
      ok: true,
      label: tx('Consent on file — read-only AIS', 'الموافقة مسجّلة — اطلاع فقط (AIS)'),
      detail: tx('account-information scope only; simulated consent in this demo', 'نطاق معلومات الحساب فقط؛ موافقة محاكاة في هذا العرض'),
    },
    {
      ok: true,
      label: tx('No payment initiation (no PIS)', 'دون تنفيذ مدفوعات (بلا PIS)'),
      detail: tx('read-only architecture — funds can never move', 'بنية اطلاع فقط — لا يمكن تحريك الأموال إطلاقًا'),
    },
  ]

  const name = (result.applicant?.name as string) || tx('Applicant', 'المتقدّم')

  // One stable receipt per computed decision: ref, token and QR are memoised on
  // the decision output so re-renders (or edited-but-not-recalculated form
  // fields) can't drift the issued document.
  const { ref, token, verifyUrl } = useMemo(() => {
    const d = new Date()
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const ck = checks.map((c) => (c.ok ? '1' : '0')).join('')
    const ref = `TBQ-C${shortHash(JSON.stringify([name, out.decision, amount, tenor, result.tabaqa_score, ymd]))}-${ymd}`
    const facts: ReceiptFacts = {
      r: ref,
      n: name,
      d: out.decision,
      a: amount,
      t: tenor,
      i: out.installment,
      da: dbrFinite ? +out.dbr_after.toFixed(4) : -1,
      cp: +cap.toFixed(4),
      s: result.tabaqa_score,
      vs: +vs.toFixed(2),
      ck,
      ts: d.toISOString().slice(0, 10),
    }
    const token = encodeReceipt(facts)
    return { ref, token, verifyUrl: `${window.location.origin}/verify?r=${ref}&rc=${token}` }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [out])

  const passed = checks.filter((c) => c.ok).length

  return (
    <div className="cmp">
      <div className="cmp-head">
        <div>
          <span className="cmp-cap">{tx('Compliance receipt', 'إيصال الامتثال')}</span>
          <span className="cmp-sub faint">
            {tx('what a compliance officer files with this decision', 'ما يودعه مسؤول الامتثال مع هذا القرار')}
          </span>
        </div>
        <div className="cmp-refbox">
          <span className="mono" dir="ltr">{ref}</span>
          <span className={`cmp-count ${passed === checks.length ? 'ok' : 'warn'}`} dir="ltr">{passed}/{checks.length}</span>
        </div>
      </div>

      <div className="cmp-rows">
        {checks.map((c, i) => (
          <div className="cmp-row" key={i}>
            <span className={`cmp-ic ${c.ok ? 'ok' : 'bad'}`}>{c.ok ? '✓' : '✕'}</span>
            <div className="cmp-txt">
              <b>{c.label}</b>
              <span className="cmp-det faint">{c.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="cmp-foot">
        <div className="cmp-qr">
          <StyledQR value={verifyUrl} size={64} fg="#0b1c46" />
          <span className="faint small">{tx('scan to verify', 'امسح للتحقّق')}</span>
        </div>
        <div className="cmp-facts faint small">
          {fmt(amount)} {SAR} · {tenor} {tx('mo', 'شهرًا')} · {tx('installment', 'القسط')} {fmt(out.installment)} {SAR}
        </div>
        <a className="btn btn-primary btn-sm" href={`/receipt?rc=${token}`} target="_blank" rel="noreferrer">
          {tx('Print / PDF ⤓', 'طباعة / PDF ⤓')}
        </a>
      </div>

      {out.dbr_policy && (
        <div className="cmp-cite faint">{out.dbr_policy.citation}</div>
      )}
    </div>
  )
}
