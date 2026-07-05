import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StyledQR } from './StyledQR'
import { api, type ScoreResult, type AffordabilityResult, type StatementInput } from '../lib/api'
import { decodeStatement, encodeFacts, shortHash } from '../lib/reportlink'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (x: number) => `${Math.round(x * 100)}%`

function refId(conn: string, d: Date) {
  const digits = conn.match(/\d+/)?.[0] ?? '0000'
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `TBQ-${digits}-${ymd}`
}

const RISK_AR: Record<string, string> = { low: 'منخفض', medium: 'متوسط', high: 'مرتفع' }

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
 * one fixed A4 sheet, for any data (it stays a fixed height because no variable-
 * length table is rendered). Frontend-only: re-fetches the live /v1/score + /v1/affordability so the
 * numbers always match the engine. Truthfully Tabaqa-branded — NOT a government record (see note).
 */
export function CreditReport() {
  const [params] = useSearchParams()
  const c = params.get('c')
  const dParam = params.get('d')
  // Own/uploaded data travels as ?d=<encoded statement>; demo connections as ?c=<id>.
  const statement = useMemo<StatementInput | null>(() => {
    if (!dParam) return null
    try { return decodeStatement(dParam) } catch { return null }
  }, [dParam])
  const decodeFailed = !!dParam && !statement
  const conn = c || (dParam ? '' : 'con_8842')

  const [result, setResult] = useState<ScoreResult | null>(null)
  const [afford, setAfford] = useState<AffordabilityResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    if (decodeFailed) { setErr('تعذّر قراءة بيانات التقرير من الرابط.'); return }
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
    // statement / conn / decodeFailed all derive from c + dParam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, dParam])

  if (err) return <div className="rpt-load">تعذّر إنشاء التقرير — {err}</div>
  if (!result) return <div className="rpt-load"><span className="rpt-spin" /> جارٍ إنشاء التقرير الموثّق…</div>

  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const ref = statement ? `TBQ-U${shortHash(dParam as string)}-${ymd}` : refId(conn, d)
  const issued = d.toISOString().slice(0, 10)
  const name = (result.applicant?.name as string) || 'المتقدّم'
  const inc = result.income
  // Demo verifies by re-fetch (?c=); uploaded data carries a COMPACT issued-facts token
  // (?v=) so the QR always fits — a full statement in the QR would overflow and crash.
  const verifyUrl = statement
    ? `${window.location.origin}/verify?r=${ref}&v=${encodeFacts({ r: ref, n: name, s: result.tabaqa_score, pd: result.pd, rf: result.risk_flag, ti: inc.true_monthly_income, bo: inc.bank_only_income, vs: inc.verified_share })}`
    : `${window.location.origin}/verify?r=${ref}&c=${conn}`
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

        {/* faint layered watermark — fills the mid-page whitespace */}
        <div className="rpt-watermark" aria-hidden><Mark fill="currentColor" className="rpt-wm-mark" /></div>

        {/* verification seal — sits quietly in the whitespace, Watheeq-stamp style */}
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
