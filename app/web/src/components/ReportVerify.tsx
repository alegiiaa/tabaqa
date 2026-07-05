import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type ScoreResult, type StatementInput } from '../lib/api'
import { decodeStatement, decodeFacts, decodeReceipt, type VerifyFacts, type ReceiptFacts } from '../lib/reportlink'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`

const DECISION_AR: Record<string, string> = { APPROVE: 'موافقة', REVIEW: 'مراجعة', DECLINE: 'رفض' }

/**
 * The QR target — re-fetches the live engine for the report's connection and confirms
 * the document is authentic (the numbers still match). An honest "verify" mechanism,
 * branded to match the official Tabaqa report.
 */
export function ReportVerify() {
  const [params] = useSearchParams()
  const ref = params.get('r') || '—'
  const c = params.get('c')
  const dParam = params.get('d')
  const vParam = params.get('v')
  const rcParam = params.get('rc')
  // own data verifies from a compact issued-facts token (?v=, what the QR carries); a
  // larger ?d= statement re-scores; demo ?c= re-fetches the live record; a compliance
  // receipt (?rc=) certifies the issued decision facts — fully self-contained.
  const facts = useMemo<VerifyFacts | null>(() => {
    if (!vParam) return null
    try { return decodeFacts(vParam) } catch { return null }
  }, [vParam])
  const receipt = useMemo<ReceiptFacts | null>(() => {
    if (!rcParam) return null
    try { return decodeReceipt(rcParam) } catch { return null }
  }, [rcParam])
  const statement = useMemo<StatementInput | null>(() => {
    if (!dParam) return null
    try { return decodeStatement(dParam) } catch { return null }
  }, [dParam])
  const conn = c || (dParam || vParam || rcParam ? '' : 'con_8842')
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (facts || receipt) return // self-contained token — nothing to fetch
    let on = true
    if ((dParam && !statement) || (vParam && !facts) || (rcParam && !receipt)) { setErr('تعذّر قراءة بيانات التحقّق.'); return }
    const p = statement ? api.scoreStatement(statement) : api.scoreConnection(conn)
    p.then((s) => on && setResult(s)).catch((e) => on && setErr(e.message ?? String(e)))
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, dParam, vParam, rcParam])

  const view = facts
    ? { name: facts.n, score: facts.s, trueIncome: facts.ti, live: false }
    : result
      ? { name: (result.applicant?.name as string) || 'المتقدّم', score: result.tabaqa_score, trueIncome: result.income.true_monthly_income, live: true }
      : null

  const passed = receipt ? receipt.ck.split('').filter((b) => b === '1').length : 0

  return (
    <div className="vfy">
      <div className="vfy-card">
        <Link to="/" className="vfy-brand">منصة طبقة · Tabaqa</Link>
        {!view && !receipt && !err && <div className="vfy-load"><span className="rpt-spin" /> جارٍ التحقّق…</div>}
        {err && (
          <>
            <div className="vfy-badge bad">✕</div>
            <h1>تعذّر التحقّق</h1>
            <p>لم نتمكّن من تأكيد المرجع <span className="mono">{ref}</span>. قد يكون غير صالحٍ أو منتهي الصلاحية.</p>
          </>
        )}
        {receipt && (
          <>
            <div className="vfy-badge ok">✓</div>
            <h1>إيصال امتثال موثّق</h1>
            <p>القيم والضوابط المعتمدة في هذا الإيصال الصادر عن منصة طبقة. · Issued decision facts certified on this Tabaqa receipt.</p>
            <div className="vfy-grid">
              <div><span>المرجع</span><b className="mono">{receipt.r}</b></div>
              <div><span>المتقدّم</span><b>{receipt.n}</b></div>
              <div><span>القرار</span><b>{DECISION_AR[receipt.d] ?? receipt.d}</b></div>
              <div><span>مبلغ التمويل</span><b><span className="mono">{fmt(receipt.a)}</span> ريال · {receipt.t} شهرًا</b></div>
              <div><span>نسبة الدين بعد التمويل</span><b className="mono">{receipt.da >= 0 ? `${pct1(receipt.da)} / ${pct1(receipt.cp)}` : '—'}</b></div>
              <div><span>درجة طبقة</span><b><span className="mono">{receipt.s}</span> / 99</b></div>
              <div><span>الضوابط المستوفاة</span><b className="mono">{passed}/{receipt.ck.length}</b></div>
              <div><span>تاريخ الإصدار</span><b className="mono">{receipt.ts}</b></div>
            </div>
            <div className="vfy-bless">والله ولي التوفيق</div>
          </>
        )}
        {view && !receipt && (
          <>
            <div className="vfy-badge ok">✓</div>
            <h1>تقرير طبقة موثّق</h1>
            <p>{view.live
              ? 'هذه الوثيقة مطابقة لسجلّ طبقة الحيّ. · This document matches Tabaqa’s live record.'
              : 'القيم المعتمدة في هذه الوثيقة الصادرة عن منصة طبقة. · Issued values certified on this Tabaqa document.'}</p>
            <div className="vfy-grid">
              <div><span>المرجع</span><b className="mono">{ref}</b></div>
              <div><span>المتقدّم</span><b>{view.name}</b></div>
              <div><span>درجة طبقة</span><b><span className="mono">{view.score}</span> / 99</b></div>
              <div><span>الدخل الموثّق</span><b><span className="mono">{fmt(view.trueIncome)}</span> ريال/شهر</b></div>
            </div>
            <div className="vfy-bless">والله ولي التوفيق</div>
          </>
        )}
        <Link to="/app" className="btn btn-primary" style={{ marginTop: 20 }}>افتح طبقة ←</Link>
      </div>
    </div>
  )
}
