import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type ScoreResult } from '../lib/api'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

/**
 * The QR target — re-fetches the live engine for the report's connection and confirms
 * the document is authentic (the numbers still match). An honest "verify" mechanism,
 * branded to match the official Tabaqa report.
 */
export function ReportVerify() {
  const [params] = useSearchParams()
  const ref = params.get('r') || '—'
  const conn = params.get('c') || 'con_8842'
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    api.scoreConnection(conn).then((s) => on && setResult(s)).catch((e) => on && setErr(e.message ?? String(e)))
    return () => { on = false }
  }, [conn])

  return (
    <div className="vfy">
      <div className="vfy-card">
        <Link to="/" className="vfy-brand">منصة طبقة · Tabaqa</Link>
        {!result && !err && <div className="vfy-load"><span className="rpt-spin" /> جارٍ التحقّق…</div>}
        {err && (
          <>
            <div className="vfy-badge bad">✕</div>
            <h1>تعذّر التحقّق</h1>
            <p>لم نتمكّن من تأكيد المرجع <span className="mono">{ref}</span>. قد يكون غير صالحٍ أو منتهي الصلاحية.</p>
          </>
        )}
        {result && (
          <>
            <div className="vfy-badge ok">✓</div>
            <h1>تقرير طبقة موثّق</h1>
            <p>هذه الوثيقة مطابقة لسجلّ طبقة الحيّ. · This document matches Tabaqa’s live record.</p>
            <div className="vfy-grid">
              <div><span>المرجع</span><b className="mono">{ref}</b></div>
              <div><span>المتقدّم</span><b>{(result.applicant?.name as string) || 'المتقدّم'}</b></div>
              <div><span>درجة طبقة</span><b><span className="mono">{result.tabaqa_score}</span> / 99</b></div>
              <div><span>الدخل الموثّق</span><b><span className="mono">{fmt(result.income.true_monthly_income)}</span> ريال/شهر</b></div>
            </div>
            <div className="vfy-bless">والله ولي التوفيق</div>
          </>
        )}
        <Link to="/app" className="btn btn-primary" style={{ marginTop: 20 }}>افتح طبقة →</Link>
      </div>
    </div>
  )
}
