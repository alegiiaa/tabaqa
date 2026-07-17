import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StyledQR } from './StyledQR'
import { API_BASE, api, type ScoreResult, type AffordabilityResult, type StatementInput } from '../lib/api'
import { decodeStatement, encodeFacts, shortHash } from '../lib/reportlink'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (x: number) => `${Math.round(x * 100)}%`

function refId(conn: string, d: Date) {
  const digits = conn.match(/\d+/)?.[0] ?? '0000'
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `TBQ-${digits}-${ymd}`
}

const RISK_AR: Record<string, string> = { low: 'منخفض', medium: 'متوسط', high: 'مرتفع' }

const maskNin = (nin: string) => (nin.length === 10 ? `${nin[0]}•••••${nin.slice(6)}` : nin)

/** One labeled value inside the document's info grids. */
function Cell({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rpt-cell">
      <small>{k}</small>
      <b className={mono ? 'mono' : undefined}>{v}</b>
    </div>
  )
}

/** Tabaqa "stacked layers" mark — color-controllable for masthead / seal / watermark. */
export function Mark({ fill, className }: { fill: string; className?: string }) {
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
 * Tabaqa Credit Report — a single-page, Watheeq-style Arabic attestation set in the traditional
 * Naskh face: KSA masthead, official title, ONE flowing paragraph that sums up the verified income,
 * score, risk and a financing headline (numbers inline, same face — no stat cards), a faint mid-page
 * seal + watermark, QR bottom-right, the green blessing, and a flush bottom document band — all on
 * one fixed A4 sheet, for any data (no variable-length table is ever rendered — every added block
 * is a fixed grid). Frontend-only: re-fetches the live /v1/score + /v1/affordability so the
 * numbers always match the engine. Truthfully Tabaqa-branded — NOT a government record (see note).
 *
 * Desk mode (?o=<order_id>): the bank-worker view adds the person behind the numbers — the
 * applicant record the app journey pulled (one /sandbox/v1/cohort/{nin} call: identity, employment,
 * bureau, household, asset power, internal rating), the incoming order the iOS app sent, and the
 * consented-sources trail with the fused statement's transaction counts.
 */
export function CreditReport() {
  const [params] = useSearchParams()
  const c = params.get('c')
  const dParam = params.get('d')
  const oParam = params.get('o')
  // Own/uploaded data travels as ?d=<encoded statement>; orders from the Tabaqa
  // app arrive as ?o=<order_id> and the statement is FETCHED from the sandbox
  // desk (a ~25KB ?d= query string trips Node's 16KB header cap — HTTP 431);
  // demo connections as ?c=<id>.
  const dStatement = useMemo<StatementInput | null>(() => {
    if (!dParam) return null
    try { return decodeStatement(dParam) } catch { return null }
  }, [dParam])
  const decodeFailed = !!dParam && !dStatement

  const [orderStatement, setOrderStatement] = useState<StatementInput | null>(null)
  const [order, setOrder] = useState<Record<string, any> | null>(null)
  const [orderErr, setOrderErr] = useState<string | null>(null)
  useEffect(() => {
    if (!oParam) return
    let on = true
    ;(async () => {
      try {
        // cache-bust: a stale edge/browser copy (esp. a cold-instance 404) must
        // never stick, or the report keeps failing after the order is available
        const res = await fetch(`${API_BASE}/sandbox/v1/orders/${encodeURIComponent(oParam)}?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`orders HTTP ${res.status}`)
        const env = (await res.json()) as Record<string, any>
        const s = decodeStatement(String(env.report_d ?? ''))
        if (on) { setOrder(env); setOrderStatement(s) }
      } catch {
        if (on) setOrderErr('تعذّر جلب ملف الطلب من مكتب الطلبات — تأكد من تشغيل الخادم وأن الطلب ما زال قائمًا.')
      }
    })()
    return () => { on = false }
  }, [oParam])

  // The lender's view deserves the person, not just the numbers: one call to the
  // sandbox pulls the SAME applicant record the app journey was built from —
  // identity, employment, bureau, household, asset power, and the computed risk
  // block. Best-effort: an older API or offline desk just renders the plain report.
  const [person, setPerson] = useState<Record<string, any> | null>(null)
  useEffect(() => {
    const nin = order?.national_id as string | undefined
    if (!nin) return
    let on = true
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/sandbox/v1/cohort/${encodeURIComponent(nin)}`)
        if (!res.ok) return
        const env = (await res.json()) as Record<string, any>
        if (on && env.record) setPerson(env.record as Record<string, any>)
      } catch { /* the attestation stands on its own */ }
    })()
    return () => { on = false }
  }, [order])

  const statement = dStatement ?? orderStatement
  const conn = c || (dParam || oParam ? '' : 'con_8842')

  const [result, setResult] = useState<ScoreResult | null>(null)
  const [afford, setAfford] = useState<AffordabilityResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    if (decodeFailed) { setErr('تعذّر قراءة بيانات التقرير من الرابط.'); return }
    // order-based report: hold until the desk hands over the statement (or fails)
    if (oParam && !statement) { if (orderErr) setErr(orderErr); return }
    ;(async () => {
      try {
        const s = statement ? await api.scoreStatement(statement) : await api.scoreConnection(conn)
        if (!on) return
        setResult(s)
        const a = await (statement
          ? api.affordability({ verified_income: s.income.true_monthly_income, bank_only_income: s.income.bank_only_income, risk_flag: s.risk_flag, amount: 60000, tenor_months: 48, annual_rate: 0.10, customer_type: 'employee' })
          : api.affordability({ connection_id: conn, amount: 60000, tenor_months: 48, annual_rate: 0.10, customer_type: 'employee' })
        ).catch(() => null)
        if (on) setAfford(a)
      } catch { if (on) setErr('تعذّر الوصول إلى خدمة التسجيل. تحقق من اتصالك ثم أعد تحميل الصفحة.') }
    })()
    return () => { on = false }
    // statement / conn / decodeFailed derive from c + dParam + the fetched order
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, dParam, oParam, statement, orderErr])

  if (err) return <div className="rpt-load">تعذّر إنشاء التقرير — {err}</div>
  if (!result) return <div className="rpt-load"><span className="rpt-spin" /> جارٍ إنشاء التقرير الموثّق…</div>

  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const ref = statement ? `TBQ-U${shortHash((dParam ?? oParam) as string)}-${ymd}` : refId(conn, d)
  const issued = d.toISOString().slice(0, 10)
  const name = (result.applicant?.name as string) || 'المتقدّم'
  const inc = result.income
  // Demo verifies by re-fetch (?c=); uploaded data carries a COMPACT issued-facts token
  // (?v=) so the QR always fits — a full statement in the QR would overflow and crash.
  const verifyUrl = statement
    ? `${window.location.origin}/verify?r=${ref}&v=${encodeFacts({ r: ref, n: name, s: result.tabaqa_score, pd: result.pd, rf: result.risk_flag, ti: inc.true_monthly_income, bo: inc.bank_only_income, vs: inc.verified_share })}`
    : `${window.location.origin}/verify?r=${ref}&c=${conn}`
  const riskAr = RISK_AR[result.risk_flag] ?? result.risk_flag
  const assetPower = person
    ? Number(person.portfolio_value_sar ?? 0) + Number(person.property_value_sar ?? 0)
    : 0

  return (
    <div className="rpt-wrap">
      <div className="rpt-toolbar">
        <Link to="/app" className="btn btn-ghost btn-sm">→ العودة إلى التطبيق</Link>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>⤓ طباعة / حفظ PDF</button>
      </div>

      <div className="rpt-page">
        {/* royal-blue gradient spine (left) */}
        <div className="rpt-spine" aria-hidden><span>TABAQA · CREDIT INTELLIGENCE · الذكاء الائتماني</span></div>

        {/* faint layered watermark — fills the mid-page whitespace */}
        <div className="rpt-watermark" aria-hidden><Mark fill="currentColor" className="rpt-wm-mark" /></div>

        {/* verification seal — mid-page whitespace normally; the desk layout fills
            the middle, so there the stamp drops to the signature area by the QR */}
        <div className={`rpt-seal${order ? ' desk' : ''}`} aria-hidden>
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

        <div className="rpt-body" dir="rtl">
          {/* ── top group ── */}
          <div className="rpt-top">
            {/* masthead (KSA · Tabaqa) */}
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

            {/* official title */}
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

            {/* attestation — one quiet paragraph, numbers inline in the same face (Watheeq) */}
            <p className="rpt-attest">
              يشهد هذا التقرير الصادر عن <b>منصة طبقة</b> بأنّ المتقدّم <b>{name}</b> قد جرى التحقّق من بياناته
              المالية إلكترونيًا عبر مصادر البيانات المفتوحة وبموافقته الصريحة. وقد بلغ دخله الشهري الموثّق{' '}
              <span className="rpt-num">{fmt(inc.true_monthly_income)}</span> ريالًا سعوديًا، مقابل{' '}
              <span className="rpt-num">{fmt(inc.bank_only_income)}</span> ريالًا في الكشف البنكي وحده، بفارقٍ موثّقٍ
              قدره <span className="rpt-num">{fmt(inc.reveal_delta)}</span> ريالًا يمثّل ما نسبته{' '}
              <span className="rpt-num">{pct(inc.verified_share)}</span> من دخله المُتحقَّق منه. وبناءً على ذلك بلغت
              درجته الائتمانية <span className="rpt-num">{result.tabaqa_score}</span> من <span className="rpt-num">99</span>{' '}
              بمستوى مخاطر <b>{riskAr}</b>، واحتمالِ تعثّرٍ قدره <span className="rpt-num">{(result.pd * 100).toFixed(1)}%</span>
              {afford
                ? <>، ويؤهّله ذلك لتمويلٍ يصل إلى نحو <span className="rpt-num">{fmt(afford.max_financing)}</span> ريال ضمن ضوابط ساما.</>
                : '.'}
            </p>
          </div>

          {/* ── the desk's applicant block (?o= only) — the person behind the
                 numbers: the record the app journey pulled (backend), the order
                 it sent (iOS app), and the consented sources it read ── */}
          {order && (
            <div className="rpt-mid">
              <div className="rpt-sec">
                <div className="rpt-sec-h"><b>بيانات المتقدّم الموثّقة</b><span dir="ltr">APPLICANT RECORD</span></div>
                <div className="rpt-grid">
                  <Cell k="رقم الهوية" v={maskNin(String(order.national_id ?? ''))} mono />
                  {person ? (
                    <>
                      <Cell k="العمر" v={`${person.age} سنة`} />
                      <Cell k="المنطقة" v={String(person.region ?? '—')} />
                      <Cell k="الحالة الاجتماعية" v={`${person.marital_status ?? '—'}${Number(person.dependents ?? 0) > 0 ? ` · يعول ${person.dependents}` : ''}`} />
                      <Cell k="جهة العمل" v={String(person.employer ?? '—')} />
                      <Cell k="فئة جهة العمل" v={String(person.employer_category ?? person.sector ?? '—')} />
                      <Cell k="سنوات الخدمة" v={person.service_years != null ? String(Math.round(Number(person.service_years))) : '—'} />
                      <Cell k="الراتب الموثّق" v={`${fmt(Number(person.monthly_salary_sar ?? 0))} ر.س`} />
                      <Cell k="الدرجة الائتمانية" v={`${person.credit_grade ?? '—'} · ${person.serious_delinquency ? 'تعثّر مسجَّل' : 'سداد منتظم'}`} />
                      <Cell k="الالتزامات الشهرية" v={`${fmt(Number(person.obligations_monthly_sar ?? 0))} ر.س`} />
                      <Cell k="قوة الأصول" v={assetPower > 0 ? `${fmt(assetPower)} ر.س` : 'لا أصول مسجَّلة'} />
                      <Cell k="التصنيف الداخلي" v={`${person.internal_rating ?? '—'} · مخاطر ${person.risk_segment_ar ?? '—'}`} />
                    </>
                  ) : (
                    <>
                      {statement?.context?.employer && <Cell k="جهة العمل" v={statement.context.employer} />}
                      {statement?.context?.monthly_wage != null && <Cell k="الراتب الموثّق" v={`${fmt(statement.context.monthly_wage)} ر.س`} />}
                    </>
                  )}
                </div>
              </div>

              <div className="rpt-sec">
                <div className="rpt-sec-h"><b>الطلب الوارد عبر تطبيق طبقة</b><span dir="ltr">INCOMING ORDER — TABAQA APP</span></div>
                <div className="rpt-grid">
                  <Cell k="رقم الطلب" v={String(order.order_id ?? '')} mono />
                  <Cell k="الجهة الممولة" v={String(order.lender_ar ?? '—')} />
                  <Cell k="نوع التمويل" v={String(order.product_ar ?? '—')} />
                  <Cell k="المبلغ المطلوب" v={`${fmt(Number(order.amount ?? 0))} ر.س`} />
                  <Cell k="القسط الشهري" v={`${fmt(Number(order.installment ?? 0))} ر.س × ${order.tenor_months}`} />
                  <Cell k="النسبة السنوية" v={`${(Number(order.apr ?? 0) * 100).toFixed(1)}٪`} />
                  <Cell k="إجمالي المبلغ المستحق" v={`${fmt(Number(order.total ?? 0))} ر.س`} />
                  <Cell k="قناة الورود" v="تطبيق طبقة (iOS) — نفاذ ✓ · OTP ✓" />
                </div>
              </div>

              <div className="rpt-sec">
                <div className="rpt-sec-h"><b>مصادر البيانات المعتمدة</b><span dir="ltr">CONSENTED DATA SOURCES</span></div>
                <p className="rpt-srcs">
                  نفاذ — توثيق الهوية ✓ · سمة — السجل الائتماني · التأمينات الاجتماعية — الراتب والتوظيف ·
                  البنوك — المصرفية المفتوحة والمحفظة الرقمية · أبشر — الحالة الاجتماعية (لتقدير المصروفات فقط) ·
                  تداول — الاستثمارات (ملاءة، لا تُحتسب دخلًا) · سجل الأصول والعقارات (ملاءة).
                  {statement && <> جُمعت <b className="rpt-num">{statement.rows.length}</b> عملية من <b className="rpt-num">{new Set(statement.rows.map((r) => r.source)).size}</b> حسابات خلال آخر ٦ أشهر.</>}
                  {' '}جميع المصادر (محاكاة) عبر Tabaqa Sandbox — قراءة فقط، بموافقة موثّقة بختم زمني قابلة للإلغاء.
                </p>
              </div>
            </div>
          )}

          {/* ── bottom group (pinned to the foot of the page) ── */}
          <div className="rpt-bottom">
            <footer className="rpt-foot">
              <div className="rpt-foot-statement">
                <span className="rpt-foot-en" dir="ltr">Verified by Tabaqa</span>
                <strong>وُثِّقت هذه البيانات وتحقّقت إلكترونيًا عبر منصة طبقة</strong>
                <div className="rpt-bless">والله ولي التوفيق</div>
              </div>
              <div className="rpt-foot-row">
                <div className="rpt-qr">
                  {/* guard: never let an over-capacity value crash the report (level H caps below M) */}
                  {verifyUrl.length <= 1200
                    ? <StyledQR value={verifyUrl} size={84} fg="#0b1c46" />
                    : <span className="mono" style={{ fontSize: 10, color: '#8593ad' }}>{ref}</span>}
                  <span>SCAN TO VERIFY</span>
                </div>
              </div>
            </footer>

            <p className="rpt-disclaimer">
              صدر هذا التقرير عن منصة طبقة من بياناتٍ مصرفية مفتوحة وبموافقة المتقدّم — منصةٌ مستقلّة، وهذه الوثيقة ليست سجلًّا حكوميًا.
            </p>

            {/* bottom document band — flush to the page edge, Watheeq-style */}
            <div className="rpt-docbar">
              <span>المرجع · <span className="mono">{ref}</span></span>
              <span className="rpt-docbar-url mono">{window.location.host}/verify</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
