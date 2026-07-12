import { useMemo, useState } from 'react'
import { useTx } from '../../lib/tx'
import type { ScoreResult, AffordabilityResult } from '../../lib/api'
import {
  computeOffers, offerInputs, SAMA_CAP_EMPLOYEE,
  type Offer, type OfferInputs, type OfferSearch, type ProductType,
} from '../../lib/lenders'
import { ComplianceReceipt } from './ComplianceReceipt'
import { AffordScreen } from './Result'
import type { Section } from './DashboardLayout'

/**
 * The financing marketplace — the applicant-facing inversion, extended to offers.
 * One verified money picture in, every lender's published product policy applied to
 * it, ranked offers out. The hero beat: the same search on bank-only income yields
 * fewer (often zero) full offers — the wallet reveal, spoken in offers.
 * Lenders are fictional demo policies; every card says the final decision belongs
 * to the licensed lender.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`

const TENORS = [12, 24, 36, 48, 60]

export function Marketplace({ result, onNavigate }: { result: ScoreResult; onNavigate?: (s: Section) => void }) {
  const { tx } = useTx()
  const SAR = tx('SAR', 'ر.س')

  const [product, setProduct] = useState<ProductType>('auto')
  const [amount, setAmount] = useState(60_000)
  const [maxMode, setMaxMode] = useState(false)
  const [tenor, setTenor] = useState(48)
  const [search, setSearch] = useState<OfferSearch | null>(null)
  const [picked, setPicked] = useState<Offer | null>(null)

  const inp = useMemo(() => offerInputs(result), [result])
  const bankInp = useMemo(() => offerInputs(result, true), [result])
  const res = useMemo(() => (search ? computeOffers(inp, search) : null), [inp, search])
  const bankRes = useMemo(() => (search ? computeOffers(bankInp, search) : null), [bankInp, search])

  const products: [ProductType, string][] = [
    ['auto', tx('Car', 'سيارة')],
    ['personal', tx('Personal', 'شخصي')],
    ['goods', tx('Goods & devices', 'أجهزة وسلع')],
  ]

  function runSearch() {
    setPicked(null)
    setSearch({ product, amount: maxMode ? null : amount, tenor })
  }

  if (picked && search) {
    return (
      <ApplicationView
        result={result}
        inp={inp}
        offer={picked}
        onBack={() => setPicked(null)}
      />
    )
  }

  return (
    <div className="screen mkt">
      {/* ── search ── */}
      <div className="mkt-search">
        <div className="field">
          <label>{tx('Financing type', 'نوع التمويل')}</label>
          <div className="afford-seg">
            {products.map(([p, label]) => (
              <button key={p} type="button" className={`afford-seg-btn${product === p ? ' on' : ''}`} onClick={() => setProduct(p)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>{tx('Amount', 'المبلغ')}</label>
          <div className="field-wrap">
            <input
              type="number"
              value={maxMode ? '' : amount}
              placeholder={maxMode ? tx('maximum I qualify for', 'أقصى ما أستحقه') : ''}
              disabled={maxMode}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
            <span className="field-suffix">{SAR}</span>
          </div>
          <button type="button" className={`mkt-max-toggle${maxMode ? ' on' : ''}`} onClick={() => setMaxMode((m) => !m)}>
            {maxMode ? '✓ ' : ''}{tx('Show my maximum', 'أعرض أقصى مبلغ لي')}
          </button>
        </div>
        <div className="field">
          <label>{tx('Tenor (months)', 'المدة (أشهر)')}</label>
          <div className="afford-seg">
            {TENORS.map((t) => (
              <button key={t} type="button" className={`afford-seg-btn${tenor === t ? ' on' : ''}`} onClick={() => setTenor(t)}>{t}</button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={runSearch}>
          {tx('Search offers', 'ابحث عن العروض')}
        </button>
      </div>

      {res && bankRes && (
        <>
          {/* ── the reveal, spoken in offers ── */}
          {result.income.reveal_delta > 0 && (
            <div className="mkt-reveal">
              <div className="mkt-reveal-row muted">
                <span>{tx('On bank-only income', 'بدخل البنك فقط')} ({fmt(bankInp.income)} {SAR})</span>
                <b>{bankRes.fullOfferCount} {tx('full offers', 'عروض كاملة')}</b>
              </div>
              <div className="mkt-reveal-row hot">
                <span>{tx('On your verified income', 'بدخلك الموثّق')} ({fmt(inp.income)} {SAR})</span>
                <b>{res.fullOfferCount} {tx('full offers', 'عروض كاملة')}</b>
              </div>
              <div className="mkt-reveal-note faint">
                {tx('Same engine, same rules — the only difference is the income the system can see.',
                  'نفس المحرك ونفس القواعد — الفرق الوحيد هو الدخل الذي يراه النظام.')}
              </div>
            </div>
          )}

          {search?.amount == null && res.bestMaxFinancing > 0 && (
            <div className="mkt-maxline">
              {tx('Your verified income qualifies you for up to', 'دخلك الموثّق يؤهلك لتمويل يصل إلى')}{' '}
              <b dir="ltr">{fmt(res.bestMaxFinancing)} {SAR}</b>
            </div>
          )}

          {/* ── offers ── */}
          {res.offers.length === 0 ? (
            <div className="mkt-empty">
              {tx('No lender policy fits this search yet — try a longer tenor or a smaller amount.',
                'لا توجد سياسة تمويل تناسب هذا البحث حاليًا — جرّب مدة أطول أو مبلغًا أصغر.')}
            </div>
          ) : (
            <div className="mkt-grid">
              {res.offers.map((o) => (
                <OfferCard key={o.lender.id} o={o} onPick={() => setPicked(o)} />
              ))}
            </div>
          )}

          {/* ── locked lenders + the unlock path ── */}
          {res.locked.length > 0 && (
            <div className="mkt-locked">
              <div className="mkt-locked-head">{tx('Not yet available to you', 'غير متاحة لك بعد')}</div>
              {res.locked.map((l) => {
                const r = l.reason
                return (
                  <div className="mkt-locked-row" key={l.lender.id}>
                    <span className="mkt-lock">🔒</span>
                    <b>{tx(l.lender.nameEn, l.lender.nameAr)}</b>
                    <span className="mkt-lock-why faint">
                      {r.kind === 'score' && `${tx('needs score', 'يتطلب درجة')} ${r.minScore} (${tx('you are', 'ينقصك')} ${r.gap} ${tx('points away', 'نقطة')})`}
                      {r.kind === 'risk' && tx('risk band outside this lender’s policy', 'نطاق المخاطر خارج سياسة هذا الممول')}
                      {r.kind === 'dbr' && `${tx('installment would exceed the SAMA cap — max here', 'القسط يتجاوز سقف ساما — أقصى تمويل هنا')} ${fmt(r.maxFinancing)} ${SAR}`}
                      {r.kind === 'amount_range' && `${tx('amounts', 'المبالغ')} ${fmt(r.min)}–${fmt(r.max)} ${SAR}`}
                      {r.kind === 'income' && tx('no verifiable income visible', 'لا يظهر دخل قابل للتحقق')}
                    </span>
                    {r.kind === 'score' && r.unlockedByRecourse && (
                      <button className="mkt-unlock" onClick={() => onNavigate?.('income')}>
                        {tx('Your improvement steps unlock this →', 'خطوات تحسينك تفتح هذا العرض ←')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="mkt-disclaim faint">
            {tx('Illustrative lenders with published product policies, for demonstration. Offers are pre-qualifications on SAMA rules — the final credit decision always belongs to the licensed lender.',
              'جهات تمويل توضيحية بسياسات منتجات معلنة، لغرض العرض. العروض تأهيل مسبق وفق قواعد ساما — والقرار الائتماني النهائي دائمًا للجهة التمويلية المرخّصة.')}
          </div>
        </>
      )}

      {/* the lender-side policy calculator stays available, one level down */}
      <details className="mkt-adv">
        <summary>{tx('Custom policy calculator (for lenders)', 'حاسبة سياسة مخصّصة (للممولين)')}</summary>
        <AffordScreen result={result} />
      </details>
    </div>
  )
}

function OfferCard({ o, onPick }: { o: Offer; onPick: () => void }) {
  const { tx } = useTx()
  const SAR = tx('SAR', 'ر.س')
  const L = o.lender
  return (
    <div className={`mkt-card${o.best ? ' best' : ''}`}>
      {o.best && <div className="mkt-ribbon">✦ {tx('Best for you', 'الأفضل لك')}</div>}
      <div className="mkt-lender">
        <span className="mkt-mono" style={{ background: L.color }}>{tx(L.nameEn, L.nameAr).slice(0, 1)}</span>
        <div className="mkt-lender-txt">
          <b>{tx(L.nameEn, L.nameAr)}</b>
          <span className="tag t-inf">{tx(L.kindEn, L.kindAr)}</span>
        </div>
      </div>
      <div className="mkt-install">
        <span className="v" dir="ltr">{fmt(o.installment)}</span>
        <span className="u">{SAR} / {tx('mo', 'شهر')}</span>
      </div>
      <div className="mkt-rows">
        <Row k={tx('Amount', 'المبلغ')} v={`${fmt(o.amount)} ${SAR}`} />
        {o.reducedFrom != null && (
          <div className="mkt-reduced">{tx('counter-offer — requested', 'عرض مخفّض — طلبت')} {fmt(o.reducedFrom)} {SAR}</div>
        )}
        <Row k={tx('Annual rate', 'النسبة السنوية')} v={pct1(o.annualRate)} />
        <Row k={tx('Tenor', 'المدة')} v={`${o.tenor} ${tx('mo', 'شهرًا')}`} />
        <Row k={tx('Admin fee (SAMA-capped)', 'رسوم إدارية (بسقف ساما)')} v={`${fmt(o.adminFee)} ${SAR}`} />
        <Row k={tx('Total repayment', 'إجمالي السداد')} v={`${fmt(o.totalCost)} ${SAR}`} />
        <Row k={tx('DBR after', 'نسبة الدين بعد')} v={`${pct1(o.dbrAfter)} ≤ ${pct1(o.dbrCap)}`} />
      </div>
      <button className="btn btn-primary mkt-apply" onClick={onPick}>{tx('Apply', 'قدّم الطلب')}</button>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="mkt-row">
      <span className="faint">{k}</span>
      <span className="mono" dir="ltr">{v}</span>
    </div>
  )
}

/** SAMA total-obligations ceiling by income segment (sama.py mirror). */
function totalObligationsCeiling(income: number): number {
  if (income <= 15_000) return 0.55
  if (income <= 25_000) return 0.65
  return 0.45
}

/** Shape an offer as the AffordabilityResult the ComplianceReceipt documents. */
function offerToAfford(o: Offer, inp: OfferInputs, tx: (en: string, ar: string) => string): AffordabilityResult {
  const lenderCapped = o.dbrCap < SAMA_CAP_EMPLOYEE - 1e-9
  return {
    installment: o.installment,
    dbr_before: o.dbrBefore,
    dbr_after: o.dbrAfter,
    dbr_cap: o.dbrCap,
    max_installment: Math.round(o.dbrCap * inp.income - inp.obligations),
    max_financing: o.maxFinancing,
    decision: 'APPROVE',
    annuity_factor: o.annuityFactor,
    reasons: [],
    verified_income: inp.income,
    dbr_policy: {
      cap: o.dbrCap,
      code: lenderCapped ? 'lender_policy_within_sama' : 'sama_salary_deduction_employee',
      label: lenderCapped
        ? tx('Lender policy cap (within the SAMA 33.33% employee cap)', 'سقف سياسة الممول (ضمن سقف ساما ٣٣٫٣٣٪ للموظفين)')
        : tx('SAMA salary-deduction cap — employees (33.33% of gross salary)', 'سقف الاستقطاع من الراتب — موظفون (٣٣٫٣٣٪ من إجمالي الراتب)'),
      total_obligations_ceiling: totalObligationsCeiling(inp.income),
      citation: 'SAMA Responsible Lending Principles for Individuals, Circular 46538/99, Chapter IV (Quantitative Principles)',
    },
  }
}

function ApplicationView({
  result, inp, offer, onBack,
}: { result: ScoreResult; inp: OfferInputs; offer: Offer; onBack: () => void }) {
  const { tx } = useTx()
  const SAR = tx('SAR', 'ر.س')
  const [sent, setSent] = useState(false)
  const out = useMemo(() => offerToAfford(offer, inp, tx), [offer, inp]) // eslint-disable-line react-hooks/exhaustive-deps
  const L = offer.lender

  return (
    <div className="screen mkt-app">
      <button className="btn btn-ghost btn-sm" onClick={onBack}>← {tx('Back to offers', 'عودة للعروض')}</button>

      <div className="mkt-app-head">
        <span className="mkt-mono lg" style={{ background: L.color }}>{tx(L.nameEn, L.nameAr).slice(0, 1)}</span>
        <div>
          <h2>{tx('Financing application —', 'طلب تمويل —')} {tx(L.nameEn, L.nameAr)}</h2>
          <p className="faint">
            {tx('This package is exactly what the lender receives on its dashboard.', 'هذه الحزمة هي بالضبط ما تستقبله الجهة التمويلية في لوحتها.')}
          </p>
        </div>
      </div>

      <div className="afford-grid">
        <div className="stat"><div className="stat-label">{tx('Amount', 'المبلغ')}</div><div className="stat-value" dir="ltr">{fmt(offer.amount)} {SAR}</div></div>
        <div className="stat"><div className="stat-label">{tx('Monthly installment', 'القسط الشهري')}</div><div className="stat-value" dir="ltr">{fmt(offer.installment)} {SAR}</div></div>
        <div className="stat"><div className="stat-label">{tx('Tabaqa score', 'درجة طبقة')}</div><div className="stat-value" dir="ltr">{result.tabaqa_score}</div></div>
        <div className="stat"><div className="stat-label">{tx('DBR after', 'نسبة الدين بعد')}</div><div className="stat-value" dir="ltr">{pct1(offer.dbrAfter)}</div></div>
      </div>

      <ComplianceReceipt result={result} out={out} amount={offer.amount} tenor={offer.tenor} />

      {!sent ? (
        <button className="btn btn-primary mkt-send" onClick={() => setSent(true)}>
          {tx('Send to the lender', 'أرسل للجهة التمويلية')}
        </button>
      ) : (
        <div className="mkt-sent">
          <div className="decision-banner ok">✓ {tx('Application delivered — pre-qualified', 'وصل الطلب — مؤهَّل مسبقًا')}</div>
          <p className="faint">
            {tx('The lender reviews this package on its dashboard (see the Applicants section for the lender view). The final credit decision always belongs to the licensed lender.',
              'تراجع الجهة التمويلية هذه الحزمة في لوحتها (انظر قسم «المتقدمون» لواجهة الممول). القرار الائتماني النهائي دائمًا للجهة المرخّصة.')}
          </p>
        </div>
      )}
    </div>
  )
}
