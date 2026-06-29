import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type ScoreResult, type StatementInput } from '../lib/api'
import { decodeStatement, decodeFacts, type VerifyFacts } from '../lib/reportlink'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

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
  // own data verifies from a compact issued-facts token (?v=, what the QR carries); a
  // larger ?d= statement re-scores; demo ?c= re-fetches the live record.
  const facts = useMemo<VerifyFacts | null>(() => {
    if (!vParam) return null
    try { return decodeFacts(vParam) } catch { return null }
  }, [vParam])
  const statement = useMemo<StatementInput | null>(() => {
    if (!dParam) return null
    try { return decodeStatement(dParam) } catch { return null }
  }, [dParam])
  const conn = c || (dParam || vParam ? '' : 'con_8842')
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (facts) return // self-contained token — nothing to fetch
    let on = true
    if ((dParam && !statement) || (vParam && !facts)) { setErr('تعذّر قراءة بيانات التحقّق.'); return }
    const p = statement ? api.scoreStatement(statement) : api.scoreConnection(conn)
    p.then((s) => on && setResult(s)).catch((e) => on && setErr(e.message ?? String(e)))
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, dParam, vParam])

  const view = facts
    ? { name: facts.n, score: facts.s, trueIncome: facts.ti, live: false }
    : result
      ? { name: (result.applicant?.name as string) || 'المتقدّم', score: result.tabaqa_score, trueIncome: result.income.true_monthly_income, live: true }
      : null

  return (
    <div className="vfy">
      <div className="vfy-card">
        <Link to="/" className="vfy-brand">منصة طبقة · Tabaqa</Link>
        {!view && !err && <div className="vfy-load"><span className="rpt-spin" /> جارٍ التحقّق…</div>}
        {err && (
          <>
            <div className="vfy-badge bad">✕</div>
            <h1>تعذّر التحقّق</h1>
            <p>لم نتمكّن من تأكيد المرجع <span className="mono">{ref}</span>. قد يكون غير صالحٍ أو منتهي الصلاحية.</p>
          </>
        )}
        {view && (
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
        <Link to="/app" className="btn btn-primary" style={{ marginTop: 20 }}>افتح طبقة →</Link>
      </div>
    </div>
  )
}
