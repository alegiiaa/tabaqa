import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { api, type ScoreResult, type Insights, type AffordabilityResult } from '../lib/api'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (x: number) => `${Math.round(x * 100)}%`

function refId(conn: string, d: Date) {
  const digits = conn.match(/\d+/)?.[0] ?? '0000'
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `TBQ-${digits}-${ymd}`
}

const RISK_AR: Record<string, string> = { low: 'منخفض', medium: 'متوسط', high: 'مرتفع' }
const DECISION_AR: Record<string, string> = { APPROVE: 'قابل للتمويل', REVIEW: 'قيد المراجعة', DECLINE: 'غير مؤهَّل' }
const TIER_AR: Record<string, string> = {
  amount_verified: 'موثّق بالمبلغ (مصدر)',
  source_verified: 'موثّق المصدر',
  inferred: 'مُستنتَج',
}

/** Tabaqa "stacked layers" mark — color-controllable for masthead / seal / watermark. */
function Mark({ fill, className }: { fill: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 92" aria-hidden>
      <g fill={fill}>
        <rect x="6" y="66" width="88" height="20" rx="8" />
        <rect x="6" y="39" width="88" height="20" rx="8" />
        <rect x="6" y="12" width="88" height="20" rx="8" transform="rotate(-8 50 22)" />
      </g>
    </svg>
  )
}

/**
 * Tabaqa Credit Report — an official, verifiable, print-ready Arabic document set in the
 * traditional Naskh face, styled after the user's Tabaqa template (royal-blue frame, vertical
 * spine, centred KSA masthead, blue seal, green blessing) and laid out in the flowing,
 * attestation-first manner of a Watheeq وثيقة. Frontend-only: it re-fetches the live
 * /v1/score + /v1/insights + /v1/affordability, so the numbers always match the engine.
 * Truthfully Tabaqa-branded — NOT a government record (see disclaimer).
 */
export function CreditReport() {
  const [params] = useSearchParams()
  const conn = params.get('c') || 'con_8842'
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [afford, setAfford] = useState<AffordabilityResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    Promise.all([
      api.scoreConnection(conn),
      api.insightsConnection(conn).catch(() => null),
      api.affordability({ connection_id: conn, amount: 60000, tenor_months: 48, annual_rate: 0.10, customer_type: 'employee' }).catch(() => null),
    ]).then(([s, i, a]) => { if (on) { setResult(s); setInsights(i); setAfford(a) } })
      .catch((e) => on && setErr(e.message ?? String(e)))
    return () => { on = false }
  }, [conn])

  if (err) return <div className="rpt-load">تعذّر إنشاء التقرير: {err}</div>
  if (!result) return <div className="rpt-load"><span className="rpt-spin" /> جارٍ إنشاء التقرير الموثّق…</div>

  const d = new Date()
  const ref = refId(conn, d)
  const issued = d.toISOString().slice(0, 10)
  const name = (result.applicant?.name as string) || 'المتقدّم'
  const inc = result.income
  const verifyUrl = `${window.location.origin}/verify?r=${ref}&c=${conn}`
  const riskAr = RISK_AR[result.risk_flag] ?? result.risk_flag

  return (
    <div className="rpt-wrap">
      <div className="rpt-toolbar">
        <Link to="/app" className="btn btn-ghost btn-sm">→ العودة إلى التطبيق</Link>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>⤓ طباعة / حفظ PDF</button>
      </div>

      <div className="rpt-page">
        {/* royal-blue gradient spine (left) */}
        <div className="rpt-spine" aria-hidden><span>TABAQA · CREDIT INTELLIGENCE · الذكاء الائتماني</span></div>

        {/* faint layered watermark */}
        <div className="rpt-watermark" aria-hidden><Mark fill="currentColor" className="rpt-wm-mark" /></div>

        <div className="rpt-body" dir="rtl">
          {/* ── masthead (KSA · Tabaqa) ── */}
          <header className="rpt-mast">
            <div className="rpt-mast-side ar">
              <span className="rpt-mast-country">المملكة العربية السعودية</span>
              <strong>منصة طبقة</strong>
              <span>الذكاء الائتماني</span>
            </div>
            <div className="rpt-mast-logo"><Mark fill="#0a0e1a" className="rpt-mark" /></div>
            <div className="rpt-mast-side en" dir="ltr">
              <span className="rpt-mast-country">Kingdom of Saudi Arabia</span>
              <strong>Tabaqa Platform</strong>
              <span>Credit Intelligence</span>
            </div>
          </header>

          {/* ── official title ── */}
          <div className="rpt-title">
            <h1>تقرير ائتماني موثّق</h1>
            <div className="rpt-title-en" dir="ltr">VERIFIED CREDIT REPORT</div>
            <div className="rpt-fleuron" aria-hidden>◆</div>
            <div className="rpt-meta">
              <span><b>المرجع</b> <span className="mono">{ref}</span></span>
              <span><b>تاريخ الإصدار</b> <span className="mono">{issued}</span></span>
              <span className="rpt-verified">✓ موثّق</span>
            </div>
          </div>

          {/* ── applicant strip ── */}
          <section className="rpt-applicant">
            <div><span className="rpt-k">المتقدّم</span><span className="rpt-v">{name}</span></div>
            <div><span className="rpt-k">معرّف الاتصال</span><span className="rpt-v mono">{conn}</span></div>
            <div><span className="rpt-k">نسبة الدخل الموثّق</span><span className="rpt-v">{pct(inc.verified_share)}</span></div>
          </section>

          {/* ── attestation (the Watheeq-style prose) ── */}
          <p className="rpt-attest">
            يشهد هذا التقرير الصادر عن <b>منصة طبقة</b> بأنّ المتقدّم <b>{name}</b> قد جرى التحقّق من بياناته
            المالية إلكترونيًا عبر مصادر البيانات المفتوحة وبموافقته الصريحة. وقد بلغ دخله الشهري الموثّق{' '}
            <b className="mono">{fmt(inc.true_monthly_income)}</b> ريالًا سعوديًا، مقابل{' '}
            <span className="mono">{fmt(inc.bank_only_income)}</span> ريالًا في الكشف البنكي وحده، بفارقٍ موثّقٍ
            قدره <b className="mono">{fmt(inc.reveal_delta)}</b> ريالًا يمثّل ما نسبته{' '}
            <span className="mono">{pct(inc.verified_share)}</span> من دخله المُتحقَّق منه. وبناءً على ذلك فقد
            بلغت درجته الائتمانية <b className="mono">{result.tabaqa_score}</b> من <span className="mono">99</span>{' '}
            بمستوى مخاطر <b>{riskAr}</b>، واحتمالِ تعثّرٍ قدره <span className="mono">{(result.pd * 100).toFixed(1)}%</span>.
          </p>

          {/* ── key facts ── */}
          <div className="rpt-facts">
            <div className="rpt-fact">
              <span className="rpt-fact-k">الدرجة الائتمانية</span>
              <b className={`rpt-fact-v mono ${result.risk_flag}`}>{result.tabaqa_score}<small>/99</small></b>
              <span className={`rpt-chip ${result.risk_flag}`}>مخاطر {riskAr}</span>
            </div>
            <div className="rpt-fact">
              <span className="rpt-fact-k">الدخل الشهري الموثّق</span>
              <b className="rpt-fact-v mono">{fmt(inc.true_monthly_income)}<small> ريال</small></b>
              <span className="rpt-fact-sub">
                بنكي <span className="mono">{fmt(inc.bank_only_income)}</span> ← حقيقي <span className="mono">{fmt(inc.true_monthly_income)}</span>
              </span>
            </div>
            <div className="rpt-fact">
              <span className="rpt-fact-k">الكشف الإضافي الموثّق</span>
              <b className="rpt-fact-v mono delta">+{fmt(inc.reveal_delta)}<small> ريال</small></b>
              <span className="rpt-fact-sub">المبلغ الذي يفتح التمويل</span>
            </div>
          </div>

          {/* ── income verification (3-tier) ── */}
          <section className="rpt-card">
            <h2>التحقّق من مصادر الدخل</h2>
            <table className="rpt-table">
              <thead><tr><th>المصدر</th><th>الشهري (ريال)</th><th>درجة التحقّق</th></tr></thead>
              <tbody>
                {inc.components.map((c, i) => (
                  <tr key={i}>
                    <td>{c.label}</td>
                    <td className="mono">{fmt(c.monthly_amount)}</td>
                    <td><span className={`rpt-tier ${c.verification}`}>{TIER_AR[c.verification] ?? c.verification}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── affordability ── */}
          {afford && (
            <section className="rpt-card">
              <h2>القدرة على السداد <small>(60,000 SAR · 48 mo · 10%)</small></h2>
              <div className="rpt-afford">
                <div><span>القرار</span><b className={`rpt-dec ${afford.decision.toLowerCase()}`}>{DECISION_AR[afford.decision] ?? afford.decision}</b></div>
                <div><span>القسط الشهري</span><b><span className="mono">{fmt(afford.installment)}</span> ريال</b></div>
                <div><span>عبء الدين بعد التمويل</span><b className="mono">{Number.isFinite(afford.dbr_after) ? pct(afford.dbr_after) : '—'}</b></div>
                <div><span>الحد الأقصى للتمويل</span><b><span className="mono">{fmt(afford.max_financing)}</span> ريال</b></div>
              </div>
              {afford.dbr_policy && <p className="rpt-cite">المرجع التنظيمي · {afford.dbr_policy.label} — {afford.dbr_policy.citation}</p>}
            </section>
          )}

          {/* ── financial-intelligence line ── */}
          {insights?.summary_line && (
            <p className="rpt-intel"><b>قراءة مالية:</b> {insights.summary_line}</p>
          )}

          {/* ── verification footer ── */}
          <footer className="rpt-foot">
            <div className="rpt-foot-statement">
              <strong>وُثِّقت هذه البيانات وتحقّقت إلكترونيًا عبر منصة طبقة</strong>
              <span>This data was electronically verified via Tabaqa Platform</span>
              <div className="rpt-bless">والله ولي التوفيق</div>
            </div>
            <div className="rpt-foot-row">
              <div className="rpt-qr">
                <QRCodeSVG value={verifyUrl} size={92} bgColor="#ffffff" fgColor="#0b1c46" level="M" />
                <span>امسح للتحقّق · SCAN TO VERIFY</span>
              </div>
              <div className="rpt-seal" aria-hidden>
                <svg viewBox="0 0 132 132">
                  <defs><path id="rptArc" d="M66,66 m-52,0 a52,52 0 1,1 104,0 a52,52 0 1,1 -104,0" /></defs>
                  <circle cx="66" cy="66" r="63" fill="none" stroke="#1f3bff" strokeWidth="1.2" />
                  <circle cx="66" cy="66" r="57" fill="none" stroke="#1f3bff" strokeWidth="0.7" strokeDasharray="1.4 2.3" opacity=".7" />
                  <text className="rpt-seal-arc"><textPath href="#rptArc" startOffset="0">· TABAQA · VERIFIED CREDIT INTELLIGENCE </textPath></text>
                  <g fill="#1f3bff" transform="translate(45,27) scale(.42)">
                    <rect x="6" y="66" width="88" height="20" rx="8" />
                    <rect x="6" y="39" width="88" height="20" rx="8" />
                    <rect x="6" y="12" width="88" height="20" rx="8" transform="rotate(-8 50 22)" />
                  </g>
                  <text x="66" y="93" textAnchor="middle" className="rpt-seal-score">{result.tabaqa_score}</text>
                  <text x="66" y="107" textAnchor="middle" className="rpt-seal-lab">VERIFIED</text>
                </svg>
              </div>
            </div>
          </footer>

          {/* bottom document bar (verify) */}
          <div className="rpt-docbar">
            <span>المرجع · <span className="mono">{ref}</span></span>
            <span className="rpt-docbar-url mono">{window.location.host}/verify</span>
          </div>

          <p className="rpt-disclaimer">
            صدر هذا التقرير عن منصة طبقة استنادًا إلى بيانات مصرفية مفتوحة وبموافقة المتقدّم. وطبقة منصةٌ مستقلّة
            للذكاء الائتماني، وهذه الوثيقة ليست سجلًّا حكوميًا ولا تحمل أي اعتمادٍ من جهةٍ حكومية أو تنظيمية.
          </p>
        </div>
      </div>
    </div>
  )
}
