import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StyledQR } from './StyledQR'
import { Mark } from './CreditReport'
import { decodeReceipt, type ReceiptFacts } from '../lib/reportlink'
import { dualDate } from '../lib/dates'

/**
 * F1 · the /receipt route — the Compliance Receipt as a print-ready A4 document in
 * the same Watheeq attestation shell as the credit report (rpt-* classes: spine,
 * masthead, docbar, print CSS all reused). Fully self-contained: renders from the
 * ?rc= token, so the printed sheet certifies the ISSUED decision facts — the QR
 * resolves to /verify?rc=… with the same token. Arabic-first, like the report.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`

const DECISION_AR: Record<string, string> = { APPROVE: 'موافقة', REVIEW: 'مراجعة', DECLINE: 'رفض' }
const DECISION_CLS: Record<string, string> = { APPROVE: 'ok', REVIEW: 'warn', DECLINE: 'bad' }

/** The checks, fixed order — must match the `ck` bitstring the panel issues.
 *  The 6th (statement integrity) only exists for balance-bearing uploads, so the
 *  doc renders exactly `ck.length` entries. */
const CHECKS: { ar: string; en: string; detail: (f: ReceiptFacts) => string }[] = [
  {
    ar: 'نسبة الدين ضمن سقف ساما',
    en: 'DBR within the SAMA cap',
    detail: (f) => (f.da >= 0 ? `${pct1(f.da)} ${f.da <= f.cp + 1e-9 ? '≤' : '>'} ${pct1(f.cp)}` : 'غير قابلة للحساب'),
  },
  {
    ar: 'القرار مبني على دخل موثّق',
    en: 'Decision built on verified income',
    detail: (f) => `${Math.round(f.vs * 100)}% من الدخل موثّق · تحقّق ثلاثي`,
  },
  {
    ar: 'أسباب القرار مرفقة',
    en: 'Adverse-action reasons attached',
    detail: () => 'رموز أسباب قابلة للقراءة الآلية مع مسار للتحسين',
  },
  {
    ar: 'الموافقة الصريحة مسجّلة — اطلاع فقط',
    en: 'Consent on file — read-only AIS',
    detail: () => 'نطاق معلومات الحساب فقط، بموافقة المتقدّم',
  },
  {
    ar: 'دون تنفيذ مدفوعات',
    en: 'No payment initiation (no PIS)',
    detail: () => 'بنية اطلاع فقط — لا يمكن تحريك الأموال',
  },
  {
    ar: 'سلامة كشف الحساب محقّقة',
    en: 'Statement integrity verified',
    detail: (f) => (f.ck[5] === '1'
      ? 'أُعيد احتساب الرصيد المتحرك من الكشف نفسه — السلسلة مُطابقة بالكامل'
      : 'سلسلة الرصيد المتحرك غير مُطابقة — احتمال تعديل يدوي على الملف'),
  },
]

export function ComplianceReceiptDoc() {
  const [params] = useSearchParams()
  const rc = params.get('rc')
  const facts = useMemo<ReceiptFacts | null>(() => {
    if (!rc) return null
    try { return decodeReceipt(rc) } catch { return null }
  }, [rc])

  if (!facts) return <div className="rpt-load">تعذّر قراءة بيانات الإيصال من الرابط.</div>

  const d = dualDate(facts.ts, true)
  const verifyUrl = `${window.location.origin}/verify?r=${facts.r}&rc=${rc}`
  const decisionAr = DECISION_AR[facts.d] ?? facts.d
  const passed = facts.ck.split('').filter((b) => b === '1').length

  return (
    <div className="rpt-wrap">
      <div className="rpt-toolbar">
        <Link to="/app" className="btn btn-ghost btn-sm">→ العودة إلى التطبيق</Link>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>⤓ طباعة / حفظ PDF</button>
      </div>

      <div className="rpt-page">
        <div className="rpt-spine" aria-hidden><span>TABAQA · COMPLIANCE RECEIPT · إيصال الامتثال</span></div>
        <div className="rpt-watermark" aria-hidden><Mark fill="currentColor" className="rpt-wm-mark" /></div>

        <div className="rpt-body" dir="rtl">
          <div className="rpt-top">
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

            <div className="rpt-title">
              <h1>إيصال امتثال — قرار تمويل</h1>
              <div className="rpt-title-en" dir="ltr">FINANCING DECISION · COMPLIANCE RECEIPT</div>
              <div className="rpt-fleuron" aria-hidden>◆</div>
              <div className="rpt-meta">
                <span><b>المرجع</b> <span className="mono">{facts.r}</span></span>
                <span><b>تاريخ الإصدار</b> <span className="mono">{facts.ts}</span>{d.hijri ? <> · {d.hijri}</> : null}</span>
                <span className="rpt-verified">✓ {passed}/{facts.ck.length} ضوابط مستوفاة</span>
              </div>
            </div>

            {/* the decision, stated once, officially */}
            <div className="cmpd-decision">
              <span className={`cmpd-chip ${DECISION_CLS[facts.d] ?? 'warn'}`}>{decisionAr}</span>
              <p className="cmpd-line">
                قرار تمويلٍ للمتقدّم <b>{facts.n}</b> بمبلغ <span className="rpt-num">{fmt(facts.a)}</span> ريال سعودي
                على <span className="rpt-num">{facts.t}</span> شهرًا، بقسطٍ شهري قدره <span className="rpt-num">{fmt(facts.i)}</span> ريالًا،
                ودرجة طبقة <span className="rpt-num">{facts.s}</span> من <span className="rpt-num">99</span>.
              </p>
            </div>

            {/* the checklist — the artifact itself */}
            <div className="cmpd-table">
              {CHECKS.slice(0, facts.ck.length).map((c, i) => {
                const ok = facts.ck[i] === '1'
                return (
                  <div className="cmpd-row" key={i}>
                    <span className={`cmpd-ic ${ok ? 'ok' : 'bad'}`}>{ok ? '✓' : '✕'}</span>
                    <div className="cmpd-txt">
                      <b>{c.ar}</b>
                      <span className="cmpd-en" dir="ltr">{c.en}</span>
                    </div>
                    <span className="cmpd-det">{c.detail(facts)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rpt-bottom">
            <footer className="rpt-foot">
              <div className="rpt-foot-statement">
                <span className="rpt-foot-en" dir="ltr">Verified by Tabaqa</span>
                <strong>حُرِّر هذا الإيصال آليًا مع القرار، وكل ضابطٍ أعلاه محسوبٌ من بيانات القرار نفسه</strong>
                <div className="rpt-bless">والله ولي التوفيق</div>
              </div>
              <div className="rpt-foot-row">
                <div className="rpt-qr">
                  {verifyUrl.length <= 1200
                    ? <StyledQR value={verifyUrl} size={84} fg="#0b1c46" />
                    : <span className="mono" style={{ fontSize: 10, color: '#8593ad' }}>{facts.r}</span>}
                  <span>SCAN TO VERIFY</span>
                </div>
              </div>
            </footer>

            <p className="rpt-disclaimer">
              صدر هذا الإيصال عن منصة طبقة توثيقًا لقرار تمويلٍ محسوبٍ وفق ضوابط ساما للإقراض المسؤول (التعميم 46538/99، الفصل الرابع) —
              منصةٌ مستقلّة، وهذه الوثيقة ليست سجلًّا حكوميًا، وموافقة العرض التجريبي محاكاة.
            </p>

            <div className="rpt-docbar">
              <span>المرجع · <span className="mono">{facts.r}</span></span>
              <span className="rpt-docbar-url mono">{window.location.host}/verify</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
