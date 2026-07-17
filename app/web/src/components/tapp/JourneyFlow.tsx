// رحلة البحث عن التمويل — the 10-stage journey (TEAM SPEC 2026-07-17), in the
// exact stage order of the spec:
//   ① request → ② consent (identity already Nafath-verified at app login)
//   → ③ collect (the six sources, in order)
//   → ④ analyze → ⑤⑥ per-lender engines + filtering → ⑦ compliant offers
//   → ⑧ select + what-we-send → ⑨ the lender's own final check → ⑩ decision:
//   approve (contract → OTP → receipt + the lender's Tabaqa report) or reject
//   (back to offers, that lender marked, pick another).
//
// The Nafath moment lives at the app's front door now (TabaqaApp → NafathLogin):
// the journey receives the verified NIN + name and never re-asks.
//
// Every figure is derived (engines.ts + bank/derive.ts + lib/lenders.ts); every
// retrieval is real HTTP against the Tabaqa Sandbox with a bundled offline
// fallback for the curated cast.

import { useEffect, useMemo, useState } from 'react'
import type { Offer, OffersResult, ProductType } from '../../lib/lenders'
import { fmt, pct, schedule } from '../bank/financeMath'
import { eligibleIncomeOf } from '../bank/derive'
import { Ic, IconName } from '../bank/icons'
import {
  assembleJourney, fetchAssets, fetchDecisionSource, fetchHousehold, fetchIdentity,
  fetchInvestments, warmSandbox,
  journeyOffers, sortOffers, lockReasonAr, unlockHint, tabaqaScore, tabaqaAppNo,
  lenderFinalCheck, submitOrder, trackOrder, ISSUANCE_DAYS, SORTS, SortKey,
  Got, JourneyData, OrderReceipt, FinalVerdict,
} from './engines'
type Stage =
  | 'request' | 'consent' | 'collect' | 'analyze'
  | 'offers' | 'send' | 'bankcheck' | 'contract' | 'otp' | 'done'

// ── a few icons the bank set doesn't carry (أبشر / تداول) ────────────────────
const TP_PATHS = {
  idcard: (
    <>
      <rect x="2.9" y="5.1" width="18.2" height="13.8" rx="2.2" />
      <circle cx="8.3" cy="10.7" r="1.9" />
      <path d="M5.6 15.9c.5-1.6 1.5-2.4 2.7-2.4s2.2.8 2.7 2.4M14 9.4h4.4M14 12.6h4.4M14 15.8h2.6" />
    </>
  ),
  trend: (
    <>
      <path d="M3.4 20.4h17.2" />
      <path d="M5.4 16.6v-4.2M9.6 16.6V8.8M13.8 16.6v-5.6M18 16.6V5.9" />
    </>
  ),
}
type TpIconName = keyof typeof TP_PATHS
function TpIc({ name, size = 18 }: { name: TpIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TP_PATHS[name]}
    </svg>
  )
}
type AnyIcon = { kind: 'bank'; name: IconName } | { kind: 'tp'; name: TpIconName }
function SrcIcon({ ic }: { ic: AnyIcon }) {
  return ic.kind === 'bank' ? <Ic name={ic.name} size={18} /> : <TpIc name={ic.name} />
}

// ── stage 2 — the six consented sources, spec order, expandable in place ────
interface ConsentDef { ic: AnyIcon; t: string; d: string; what: string; from: string; tech: string; scope?: 'limited' }
const CONSENT_SOURCES: ConsentDef[] = [
  {
    ic: { kind: 'bank', name: 'chart' }, t: 'سمة — السجل الائتماني (محاكاة)',
    d: 'الالتزامات القائمة وتاريخ السداد',
    what: 'الدرجة الائتمانية، الالتزامات وأقساطها الشهرية، تاريخ السداد، مؤشرات الاستقرار الائتماني',
    from: 'مزوّد السجل الائتماني المرخَّص',
    tech: 'استعلام ائتماني بموافقتك — يُسجَّل بختم زمني في سجل التدقيق',
  },
  {
    ic: { kind: 'bank', name: 'briefcase' }, t: 'التأمينات الاجتماعية (محاكاة)',
    d: 'الراتب وجهة العمل والاستقرار الوظيفي',
    what: 'الراتب الموثّق، جهة العمل، القطاع، المسمى الوظيفي، مدة الخدمة، الاستقرار الوظيفي',
    from: 'مصدر التوظيف والرواتب الرسمي',
    tech: 'استعلام تحقّق موثّق — قراءة فقط',
  },
  {
    ic: { kind: 'bank', name: 'bank' }, t: 'البنوك — المصرفية المفتوحة (محاكاة)',
    d: 'كشوف آخر ٦ أشهر + المحفظة الرقمية',
    what: 'كشوف الحسابات لآخر ٦ أشهر، مصادر الدخل، متوسط الرصيد، الالتزامات البنكية، الإنفاق، التحويلات، الأنماط المالية',
    from: 'بنوكك ومحفظتك الرقمية مباشرة، بعد موافقتك',
    tech: 'واجهات AIS ضمن إطار المصرفية المفتوحة السعودي — قراءة فقط، دون كلمات مرور',
  },
  {
    ic: { kind: 'tp', name: 'idcard' }, t: 'أبشر — الأحوال المدنية (محاكاة)',
    d: 'الحالة الاجتماعية وعدد المعالين',
    what: 'الحالة الاجتماعية وعدد المعالين وبيانات شخصية أساسية',
    from: 'السجلات المدنية، بعد موافقتك',
    tech: 'تُستخدم لتقدير المصروفات الأساسية وفق حجم الأسرة فقط — ليست مدخلًا في درجة المخاطر',
  },
  {
    ic: { kind: 'tp', name: 'trend' }, t: 'تداول — الاستثمارات (محاكاة)',
    d: 'المحافظ والأسهم والأصول المالية',
    what: 'المحافظ الاستثمارية والأسهم والصناديق وقيمتها السوقية',
    from: 'مزوّد خدمات السوق المالية، بعد موافقتك',
    tech: 'قوة أصول تدعم الملاءة — لا تُحتسب دخلًا شهريًا',
  },
  {
    ic: { kind: 'bank', name: 'building' }, t: 'الأصول والعقارات (محاكاة)',
    d: 'العقارات والملكيات ذات القيمة',
    what: 'العقارات والأراضي والأصول التجارية المسجَّلة وقيمتها التقديرية',
    from: 'سجل الأصول — التكامل الرسمي غير متاح بعد، بيانات محاكاة للنموذج',
    tech: 'تكامل مستقبلي يعتمد على الأطر الرسمية — لا يدخل في قرار النسخة الحالية',
  },
]

const PRODUCTS: { id: ProductType | 'realestate'; t: string; d: string; ic: IconName; off?: boolean }[] = [
  { id: 'auto', t: 'تمويل المركبات', d: 'حتى 500,000 ر.س', ic: 'car' },
  { id: 'personal', t: 'التمويل الشخصي', d: 'حتى 500,000 ر.س', ic: 'cash' },
  { id: 'goods', t: 'أجهزة وسلع', d: 'حتى 150,000 ر.س', ic: 'card' },
  { id: 'realestate', t: 'التمويل العقاري', d: 'قريبًا', ic: 'building', off: true },
]
const PRODUCT_AR: Record<ProductType, string> = {
  auto: 'تمويل المركبات', personal: 'التمويل الشخصي', goods: 'تمويل أجهزة وسلع',
}

// ── the flow ─────────────────────────────────────────────────────────────────

export function JourneyFlow({ nin, nameAr, onExit, onOrder }: {
  nin: string
  nameAr: string
  onExit: () => void
  onOrder?: () => void // the shell reloads its tracked-order card off this
}) {
  const [stage, setStage] = useState<Stage>('request')

  // stage 1 — the request
  const [product, setProduct] = useState<ProductType>('auto')
  const [amount, setAmount] = useState(150_000)
  const [maxMode, setMaxMode] = useState(false)
  const [tenor, setTenor] = useState(48)

  // data over the app-login identity (Nafath-verified before the journey opened)
  const [data, setData] = useState<JourneyData | null>(null)

  // offers + decision
  const [sort, setSort] = useState<SortKey>('best')
  const [selected, setSelected] = useState<Offer | null>(null)
  const [dead, setDead] = useState<Record<string, string>>({}) // lender id → refusal reason
  const [verdict, setVerdict] = useState<FinalVerdict | null>(null)
  const [order, setOrder] = useState<OrderReceipt | null>(null) // the desk's receipt for this send
  const [sending, setSending] = useState(false)

  useEffect(() => { warmSandbox() }, [])

  const offersRes: OffersResult | null = useMemo(
    () => (data ? journeyOffers(data, product, maxMode ? null : amount, tenor) : null),
    [data, product, amount, maxMode, tenor],
  )

  function restart() {
    setStage('request'); setData(null); setSelected(null)
    setDead({}); setVerdict(null); setSort('best'); setOrder(null)
  }

  // stage 8 → 9: the order lands on the Tabaqa dashboard (the lender's desk),
  // then the lender's own systems run. Offline mode skips the desk gracefully.
  async function sendToLender() {
    if (!data || !selected || sending) return
    setSending(true)
    const receipt = await submitOrder(data, selected, PRODUCT_AR[product])
    setOrder(receipt)
    // the shell watches this order — قبول/رفض/تمديد from the desk raises the
    // matching notice wherever the user is, and the home card tracks it live
    if (receipt.ok && receipt.orderId) {
      trackOrder({
        id: receipt.orderId,
        nin,
        lenderAr: selected.lender.nameAr,
        productAr: PRODUCT_AR[product],
        amount: selected.amount,
        tenor: selected.tenor,
        installment: selected.installment,
      })
      onOrder?.()
    }
    setSending(false)
    setVerdict(null)
    setStage('bankcheck')
  }

  const amountBad = !maxMode && (amount < 2_000 || amount > 500_000)

  return (
    <div className="tp-fin">
      {stage === 'request' && (
        <Screen title="البحث عن عروض التمويل" sub="حدّد احتياجك — ثم نبني ملفك المالي الموحد بموافقتك ونشغّل محركات جهات التمويل عليه.">
          <label className="tp-lab">نوع التمويل</label>
          <div className="tp-prods">
            {PRODUCTS.map((p) => (
              <button
                key={p.id}
                className={`tp-prod${product === p.id ? ' sel' : ''}`}
                disabled={p.off}
                onClick={() => !p.off && setProduct(p.id as ProductType)}
              >
                <Ic name={p.ic} size={22} />
                <b>{p.t}</b>
                <small>{p.d}</small>
              </button>
            ))}
          </div>

          <label className="tp-lab">قيمة التمويل المطلوبة (ر.س)</label>
          <input
            className="tp-amount" type="number" inputMode="numeric" dir="ltr"
            value={maxMode ? '' : amount} disabled={maxMode}
            placeholder={maxMode ? '—' : undefined}
            min={2_000} max={500_000} step={5_000}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
          />
          <label className="tp-check">
            <input type="checkbox" checked={maxMode} onChange={(e) => setMaxMode(e.target.checked)} />
            <span>أعرض أقصى مبلغ متاح لي لدى كل جهة</span>
          </label>
          {amountBad && amount > 0 && <p className="tp-err">المبلغ بين 2,000 و 500,000 ر.س</p>}

          <label className="tp-lab">مدة السداد المفضّلة</label>
          <input
            className="tp-range" type="range" min={6} max={60} step={6}
            value={tenor} onChange={(e) => setTenor(Number(e.target.value))}
          />
          <div className="tp-range-val"><span>6 أشهر</span><b>{tenor} شهرًا</b><span>60 شهرًا</span></div>

          <p className="tp-hint" style={{ marginTop: 14 }}>
            جميع العروض بصيغة مرابحة بنسبة ثابتة معلنة — تظهر النسبة والتكلفة الإجمالية على كل عرض.
          </p>

          <button className="tp-cta" disabled={amountBad} onClick={() => setStage('consent')}>متابعة</button>
          <button className="tp-ghost" onClick={onExit}>إلغاء</button>
        </Screen>
      )}

      {stage === 'consent' && (
        <Screen
          title="الموافقة على جمع البيانات"
          sub="بناء عروض دقيقة يتطلب — بموافقتك الصريحة — قراءة بياناتك من المصرفية المفتوحة وعدد من الجهات. أولًا، تعهّداتنا:"
          onBack={() => setStage('request')}
        >
          <div className="tp-promises">
            <Pledge yes text={<><b>تُستخدم بياناتك لغرض واحد:</b> تحليل أهليتك وبناء عروض تمويل مخصصة لك.</>} />
            <Pledge text={<><b>لا تُباع</b> بياناتك ولا تُشارك مع أي جهة — إطلاقًا.</>} />
            <Pledge text={<><b>لا تُرسل بياناتك التفصيلية</b> لمقدمي التمويل — تصلهم نتائج التحليل فقط.</>} />
            <Pledge text={<><b>لا نحتفظ بالبيانات</b> بعد انتهاء المعالجة، وفق سياسة الخصوصية.</>} />
          </div>

          <label className="tp-lab">المصادر — اضغط أي مصدر لتعرف ماذا نقرأ، ومن أين، وكيف:</label>
          <div className="tp-consent">
            {CONSENT_SOURCES.map((s) => <ConsentSource key={s.t} s={s} />)}
          </div>
          <p className="tp-hint" style={{ marginTop: 10 }}>
            الوصول للقراءة فقط، وتُسجَّل موافقتك بختم زمني في سجل التدقيق ويمكنك إلغاؤها في أي وقت.
            في هذه النسخة التجريبية تُحاكى جميع الجهات عبر Tabaqa Sandbox API — نفس الهيكل والتقنية،
            دون اتصال بجهات حقيقية.
          </p>
          <div className="tp-banner ok">
            <span>✓</span>
            <span>
              هويتك موثّقة عبر <b>نفاذ (محاكاة)</b> منذ تسجيل الدخول —
              تُربط الموافقة بها: {nameAr} · {nin.slice(0, 1)}•••••{nin.slice(6)}
            </span>
          </div>
          <button className="tp-cta" onClick={() => setStage('collect')}>أوافق — ابدأ جمع بياناتي</button>
          <button className="tp-ghost" onClick={onExit}>إلغاء</button>
        </Screen>
      )}

      {stage === 'collect' && (
        <Collect nin={nin} onDone={(d) => { setData(d); setStage('analyze') }} />
      )}

      {stage === 'analyze' && data && (
        <Analyze data={data} onNext={() => setStage('offers')} />
      )}

      {stage === 'offers' && data && offersRes && (
        <Screen
          title="العروض المتوافقة معك"
          sub={`${data.identity.nameAr} · ${PRODUCT_AR[product]}${maxMode ? ' · أقصى مبلغ' : ` · ${fmt(amount)} ر.س`} · ${tenor} شهرًا`}
          onBack={() => setStage('analyze')}
        >
          {data.decision.decision === 'review' && (
            <div className="tp-banner warn">
              <span>⚠</span>
              <span>{data.decision.reasonAr} العروض أدناه محسوبة على الدخل الذي أمكن توثيقه فقط، وقد تطلب الجهة مستندات إضافية.</span>
            </div>
          )}

          <div className="tp-market-head">
            شغّلنا محركات <b>{offersRes.offers.length + offersRes.locked.length} جهات تمويل</b> — كلٌّ بمعاييرها —
            على ملفك الموحد: <b>{offersRes.offers.length} عروض متوافقة</b>
            {offersRes.locked.length > 0 && <> و{offersRes.locked.length} غير متوافقة (لا تُعرض افتراضيًا)</>}.
            {!maxMode && offersRes.fullOfferCount > 0 && <> منها <b>{offersRes.fullOfferCount}</b> يغطي كامل المبلغ المطلوب.</>}
          </div>

          {offersRes.offers.length > 0 ? (
            <>
              <div className="tp-sorts">
                {SORTS.map((s) => (
                  <button key={s.k} className={`tp-sort${sort === s.k ? ' sel' : ''}`} onClick={() => setSort(s.k)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="tp-offers">
                {sortOffers(offersRes.offers, sort).map((o) => {
                  const refusal = dead[o.lender.id]
                  const isSel = selected?.lender.id === o.lender.id
                  const days = ISSUANCE_DAYS[o.lender.id] ?? 2
                  return (
                    <button
                      key={o.lender.id}
                      className={`tp-offer${o.best && sort === 'best' ? ' best' : ''}${isSel ? ' sel' : ''}${refusal ? ' dead' : ''}`}
                      disabled={Boolean(refusal)}
                      onClick={() => setSelected(o)}
                    >
                      <div className="tp-offer-top">
                        <span className="tp-mono-chip" style={{ background: o.lender.color }}>
                          {o.lender.nameAr.replace('مصرف ', '').replace('بنك ', '').charAt(0)}
                        </span>
                        <span className="who">
                          <b>{o.lender.nameAr}</b>
                          <small>{o.lender.kindAr} · إصدار {days === 0 ? 'فوري' : `خلال ${days} ${days === 1 ? 'يوم' : 'أيام'}`}</small>
                        </span>
                        {o.best && sort === 'best' && !refusal && <span className="tp-best-tag">الأنسب لك</span>}
                      </div>
                      <div className="tp-offer-amounts">
                        <b>{fmt(o.amount)} <span className="unit">ر.س</span></b>
                        <span>{fmt(o.installment)} ر.س/شهر</span>
                      </div>
                      <div className="tp-offer-meta">
                        <span>{o.tenor} شهرًا</span>
                        <span>نسبة سنوية {pct(o.annualRate)}</span>
                        <span>الإجمالي {fmt(o.totalCost)} ر.س</span>
                        <span>رسوم إدارية {fmt(o.adminFee)} ر.س</span>
                      </div>
                      {o.reducedFrom != null && (
                        <div className="tp-counter">عرض بديل: المطلوب {fmt(o.reducedFrom)} — المتاح وفق سياسة الجهة {fmt(o.amount)} ر.س</div>
                      )}
                      {refusal && <div className="tp-offer-dead-note">لم توافق الجهة على الطلب النهائي — اختر جهة أخرى</div>}
                    </button>
                  )
                })}
              </div>
              <button
                className="tp-cta"
                disabled={!selected || Boolean(selected && dead[selected.lender.id])}
                onClick={() => setStage('send')}
              >
                متابعة بالعرض المحدد
              </button>
            </>
          ) : (
            <div className="tp-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--tp-faint)" strokeWidth="1.6" strokeLinecap="round"><circle cx="11" cy="11" r="7.2" /><path d="m16.4 16.4 4.2 4.2M8 11h6" /></svg>
              <h3>لا توجد عروض متوافقة حاليًا</h3>
              <p>{data.decision.decision === 'declined'
                ? data.decision.reasonAr
                : 'لم تحقق شروط أي جهة تمويل على هذا الطلب — جرّب مبلغًا أو مدة مختلفة.'}</p>
              {unlockHint(data.profile) && <div className="hint">{unlockHint(data.profile)}</div>}
            </div>
          )}

          {offersRes.locked.length > 0 && (
            <details className="tp-locked">
              <summary>العروض غير المتوافقة ({offersRes.locked.length}) — مخفية عن الواجهة الرئيسية، اضغط للاطلاع</summary>
              <div className="tp-locked-list">
                {offersRes.locked.map((l) => (
                  <div key={l.lender.id} className="tp-locked-row">
                    <span className="tp-mono-chip" style={{ background: l.lender.color, width: 30, height: 30, fontSize: 13, borderRadius: 9 }}>
                      {l.lender.nameAr.replace('مصرف ', '').replace('بنك ', '').charAt(0)}
                    </span>
                    <span className="why"><b>{l.lender.nameAr}</b> — {lockReasonAr(l)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          <Powered />
        </Screen>
      )}

      {stage === 'send' && data && selected && (
        <Screen
          title="ماذا نرسل للجهة الممولة؟"
          sub={`قبل إرسال طلبك إلى ${selected.lender.nameAr} — بشفافية كاملة:`}
          onBack={() => setStage('offers')}
        >
          <div className="tp-receipt">
            <Row k="الجهة" v={selected.lender.nameAr} />
            <Row k="المبلغ" v={`${fmt(selected.amount)} ر.س`} />
            <Row k="القسط الشهري" v={`${fmt(selected.installment)} ر.س × ${selected.tenor}`} />
            <Row k="النسبة السنوية" v={pct(selected.annualRate)} />
          </div>
          <div className="tp-share" style={{ marginTop: 10 }}>
            <div className="tp-share-box yes">
              <h4><Ic name="check" size={15} stroke={2.4} /> يُرسل للجهة</h4>
              <ul>
                <li>نتائج تحليل طبقة: الدرجة {tabaqaScore(data.profile).score}/99، الدخل المعتمد {fmt(eligibleIncomeOf(data.profile))} ر.س، نسبة الالتزامات، مؤشر الاستقرار</li>
                <li>بياناتك التعريفية الأساسية (الاسم ورقم الهوية) وموافقتك الموثّقة بختم زمني</li>
                <li>ما تملك الجهة صلاحية الوصول إليه أصلًا (استعلامها الائتماني الخاص)</li>
              </ul>
            </div>
            <div className="tp-share-box no">
              <h4><span style={{ fontWeight: 800 }}>✕</span> لا يُرسل أبدًا</h4>
              <ul>
                <li>كشوف حساباتك وحركاتها الخام</li>
                <li>بيانات الجهات الحكومية التفصيلية (التأمينات، أبشر)</li>
                <li>تفاصيل استثماراتك وأصولك</li>
              </ul>
            </div>
          </div>
          <button className="tp-cta" disabled={sending} onClick={() => { void sendToLender() }}>
            {sending ? 'جارٍ إرسال الطلب…' : `إرسال الطلب إلى ${selected.lender.nameAr}`}
          </button>
        </Screen>
      )}

      {stage === 'bankcheck' && data && selected && (
        <BankCheck
          data={data} offer={selected}
          verdict={verdict} setVerdict={setVerdict}
          onApproved={() => setStage('contract')}
          onBackToOffers={(reason) => {
            setDead((m) => ({ ...m, [selected.lender.id]: reason }))
            setSelected(null)
            setVerdict(null)
            setStage('offers')
          }}
        />
      )}

      {stage === 'contract' && data && selected && (
        <Contract offer={selected} onBack={() => setStage('offers')} onConfirm={() => setStage('otp')} />
      )}

      {stage === 'otp' && (
        <Otp onBack={() => setStage('contract')} onOk={() => setStage('done')} />
      )}

      {stage === 'done' && data && selected && (
        <Screen title="تمت الموافقة واكتمل التوثيق" tone="ok">
          <div className="tp-done">
            <div className="tp-done-badge">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.7 4.6 4.6L19 7.7" /></svg>
            </div>
            <p>
              وافقت <b>{selected.lender.nameAr}</b> على طلبك ووُقِّع العقد إلكترونيًا.
              تستكمل الجهة التفعيل وفق إجراءاتها المعتمدة.
            </p>
            <div className="tp-receipt">
              <Row k="رقم الطلب" v={order?.orderId ?? tabaqaAppNo(nin, selected.lender.id)} />
              <Row k="الجهة الممولة" v={selected.lender.nameAr} />
              <Row k="المبلغ" v={`${fmt(selected.amount)} ر.س`} />
              <Row k="القسط الشهري" v={`${fmt(selected.installment)} ر.س × ${selected.tenor}`} />
              <Row k="توثيق الهوية" v="نفاذ (محاكاة) ✓" />
              <Row k="التوقيع الإلكتروني" v="مؤكَّد (OTP) ✓" />
              <Row k="سجل التدقيق" v="موافقة بختم زمني — قابلة للإلغاء" />
            </div>
            <div className="tp-report-card">
              <b>وصل طلبك إلى لوحة طبقة</b>
              <p>
                {order?.ok
                  ? 'ظهر طلبك الآن في لوحة طبقة لدى الجهة الممولة — ومعه تقريرك الموثّق نفسه. على الجهة اعتماد الطلب خلال 24 ساعة.'
                  : 'وضع بدون اتصال — يُسلَّم الطلب وتقريرك الموثّق إلى لوحة الجهة فور عودة الاتصال، وعلى الجهة اعتماده خلال 24 ساعة.'}
              </p>
            </div>
            <p className="tp-hint" style={{ marginTop: 12 }}>
              تابع حالة طلبك من بطاقة <b>«طلب التمويل الحالي»</b> في الشاشة الرئيسية —
              أي تحديث من الجهة (قبول أو تمديد) يصلك إشعاره فورًا.
            </p>
            <p className="tp-hint" style={{ marginTop: 6 }}>كل ذلك — دون زيارة فرع، ودون أن تغادر بياناتك الخام طبقة.</p>
          </div>
          <button className="tp-cta" onClick={onExit}>العودة للرئيسية</button>
          <button className="tp-ghost" onClick={restart}>بدء طلب جديد</button>
          <Powered />
        </Screen>
      )}
    </div>
  )
}

// ── stage 3 — collection: the six sources tick in the spec's exact order ────

type RowStatus = 'pending' | 'now' | 'done' | 'warn'
interface CollectRow { t: string; status: RowStatus; d?: string }

function Collect({ nin, onDone }: { nin: string; onDone: (d: JourneyData) => void }) {
  const [rows, setRows] = useState<CollectRow[]>([
    { t: 'سمة — السجل الائتماني (محاكاة)', status: 'now' },
    { t: 'التأمينات الاجتماعية — الراتب والتوظيف (محاكاة)', status: 'pending' },
    { t: 'البنوك — المصرفية المفتوحة والمحفظة (محاكاة)', status: 'pending' },
    { t: 'أبشر — الحالة الاجتماعية والمعالون (محاكاة)', status: 'pending' },
    { t: 'تداول — المحافظ والاستثمارات (محاكاة)', status: 'pending' },
    { t: 'سجل الأصول والعقارات (محاكاة)', status: 'pending' },
  ])
  const [foot, setFoot] = useState<'wait' | 'sandbox' | 'local'>('wait')

  useEffect(() => {
    let alive = true
    const set = (i: number, patch: Partial<CollectRow>, nextNow?: boolean) => {
      if (!alive) return
      setRows((rs) => rs.map((r, j) =>
        j === i ? { ...r, ...patch }
        : nextNow && j === i + 1 && r.status === 'pending' ? { ...r, status: 'now' }
        : r))
    }
    ;(async () => {
      try {
        const identityP = fetchIdentity(nin) // KYC done at Nafath — age rides along silently

        const credit = await fetchDecisionSource(nin, 'credit-bureau')
        const rep = credit.data.report
        set(0, {
          status: 'done',
          d: `درجة ${rep.credit_grade} · ${rep.obligations.length} التزامات بقيمة ${fmt(rep.total_monthly_obligations)} ر.س/شهر`,
        }, true)

        const employment = await fetchDecisionSource(nin, 'employment')
        const rec = employment.data.record
        set(1, {
          status: 'done',
          d: `${rec.employer_name} · ${rec.employment_sector} · راتب موثّق ${fmt(Number(rec.verified_monthly_salary))} ر.س · خدمة ${rec.service_years} سنوات`,
        }, true)

        const [bank, openbanking, wallet] = await Promise.all([
          fetchDecisionSource(nin, 'bank-core'),
          fetchDecisionSource(nin, 'open-banking'),
          fetchDecisionSource(nin, 'wallet'),
        ])
        const txn = bank.data.transactions.length + openbanking.data.transactions.length + wallet.data.transactions.length
        set(2, { status: 'done', d: `3 حسابات · ${txn} عملية · آخر 6 أشهر — قراءة فقط (AIS)` }, true)

        // the identity call resolved in parallel — age/name ride along silently
        const [identity, household] = await Promise.all([identityP, fetchHousehold(nin)])
        set(3, {
          status: 'done',
          d: `${household.data.marital} · ${household.data.dependents === 0 ? 'بدون معالين' : `${household.data.dependents} معالين`} — لتقدير المصروفات فقط`,
        }, true)

        const investments = await fetchInvestments(nin)
        set(4, {
          status: 'done',
          d: investments.data.total > 0
            ? `محفظة بقيمة ${fmt(investments.data.total)} ر.س (${investments.data.count} أوراق مالية)`
            : 'لا محفظة استثمارية مسجَّلة',
        }, true)

        const assets = await fetchAssets(nin)
        set(5, {
          status: 'done',
          d: assets.data.total > 0
            ? `${assets.data.count} ${assets.data.count === 1 ? 'أصل' : 'أصول'} بقيمة تقديرية ${fmt(assets.data.total)} ر.س`
            : 'لا أصول عقارية مسجَّلة',
        })

        const all = [identity, credit, employment, bank, openbanking, wallet, household, investments, assets]
        if (alive) setFoot(all.every((g) => (g as Got<unknown>).transport === 'sandbox') ? 'sandbox' : 'local')

        const d = assembleJourney(nin, identity, credit, employment, bank, openbanking, wallet,
          household, investments, assets)
        window.setTimeout(() => { if (alive) onDone(d) }, 900)
      } catch {
        if (alive) setFoot('local')
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="tp-screen tp-proc">
      <div className="tp-spinner" />
      <h2>نجمع بياناتك من المصادر — بموافقتك</h2>
      <div className="tp-steps">
        {rows.map((r) => (
          <div key={r.t} className={`tp-step ${r.status === 'done' ? 'done' : r.status === 'warn' ? 'warn' : r.status === 'now' ? 'now' : ''}`}>
            <span className="tp-step-ic">{r.status === 'done' ? '✓' : r.status === 'warn' ? '⚠' : r.status === 'now' ? '●' : '○'}</span>
            <span>
              {r.t}
              {r.d && <small className="tp-step-d">{r.d}</small>}
            </span>
          </div>
        ))}
      </div>
      <p className="tp-hint" style={{ marginTop: 14 }}>
        {foot === 'sandbox'
          ? 'المصادر استُدعيت عبر Tabaqa Sandbox API — بيئة تجريبية، جميع الجهات والبيانات محاكاة'
          : foot === 'local'
            ? 'وضع بدون اتصال — بيانات محاكاة محلية بنفس الإيقاع'
            : 'قراءة فقط · موافقة موثّقة بختم زمني · لا تُحفظ البيانات بعد المعالجة'}
      </p>
      <Powered />
    </div>
  )
}

// ── stage 4 — analysis: pipeline ticks, then the unified-file indicators ────

const ANALYZE_STEPS = [
  'تنظيف البيانات وتوحيد صيغها',
  'إزالة التكرار والتحويلات الداخلية',
  'دمج المصادر في ملف مالي موحد',
  'حساب المؤشرات التي لا يراها أي مصدر منفردًا',
]

function Analyze({ data, onNext }: { data: JourneyData; onNext: () => void }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    let alive = true
    let i = 0
    const tick = () => {
      if (!alive) return
      i += 1
      setStep(i)
      if (i < ANALYZE_STEPS.length) window.setTimeout(tick, 480)
    }
    window.setTimeout(tick, 480)
    return () => { alive = false }
  }, [])

  const p = data.profile
  const t = tabaqaScore(p)
  const inc = eligibleIncomeOf(p)
  const load = inc > 0 ? p.obligations / inc : 0
  const assetPower = data.investments.total + data.assets.total
  const ready = step >= ANALYZE_STEPS.length

  return (
    <div className="tp-screen tp-proc">
      {!ready && <div className="tp-spinner" />}
      <h2>{ready ? 'ملفك المالي الموحد جاهز' : 'محرك طبقة يحلل ملفك…'}</h2>
      <div className="tp-steps">
        {ANALYZE_STEPS.map((s, i) => (
          <div key={s} className={`tp-step${i < step ? ' done' : i === step ? ' now' : ''}`}>
            <span className="tp-step-ic">{i < step ? '✓' : i === step ? '●' : '○'}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>

      {ready && (
        <>
          <div className="tp-inds">
            <div className="tp-ind hero">
              <small>مؤشر طبقة — من ملفك المدمج، لا يُرسل منه إلا النتيجة</small>
              <b>{t.score}<span className="unit">/99</span></b>
              <span className="sub">
                {t.risk === 'low' ? 'نطاق مخاطر منخفض' : t.risk === 'medium' ? 'نطاق مخاطر متوسط' : 'نطاق مخاطر مرتفع'}
                {' '}· {p.stability}
              </span>
            </div>
            <div className="tp-ind">
              <small>الدخل الحقيقي الموثّق</small>
              <b>{fmt(inc)}<span className="unit"> ر.س/شهر</span></b>
              <span className="sub">راتب {fmt(p.verifiedSalary)} + 50٪ من دخل جانبي مستقر {fmt(p.sideIncome)}</span>
            </div>
            <div className="tp-ind">
              <small>نسبة الالتزامات الفعلية</small>
              <b>{Math.round(load * 100)}<span className="unit">٪</span></b>
              <span className="sub">{fmt(p.obligations)} ر.س شهريًا — مطابقة مع السجل الائتماني</span>
            </div>
            <div className="tp-ind">
              <small>الاستقرار الوظيفي</small>
              <b>{p.serviceYears}<span className="unit"> سنوات</span></b>
              <span className="sub">{p.sector} · راتب في {p.salaryMonthsSeen} من آخر 6 أشهر</span>
            </div>
            <div className="tp-ind">
              <small>قوة الأصول</small>
              <b>{assetPower > 0 ? fmt(assetPower) : '—'}{assetPower > 0 && <span className="unit"> ر.س</span>}</b>
              <span className="sub">استثمارات وعقارات — تدعم الملاءة ولا تُحتسب دخلًا</span>
            </div>
          </div>
          <button className="tp-cta" onClick={onNext}>اعرض العروض المتوافقة</button>
        </>
      )}
      <Powered />
    </div>
  )
}

// ── stage 9 — the lender's own verification, step by step ───────────────────

function BankCheck({ data, offer, verdict, setVerdict, onApproved, onBackToOffers }: {
  data: JourneyData
  offer: Offer
  verdict: FinalVerdict | null
  setVerdict: (v: FinalVerdict) => void
  onApproved: () => void
  onBackToOffers: (reason: string) => void
}) {
  const v = useMemo(() => verdict ?? lenderFinalCheck(offer.lender, data, offer), [verdict, data, offer])
  useEffect(() => { if (!verdict) setVerdict(v) }, [verdict, v, setVerdict])

  const [shown, setShown] = useState(0)
  useEffect(() => {
    let alive = true
    let i = 0
    const tick = () => {
      if (!alive) return
      i += 1
      setShown(i)
      if (i < v.steps.length) window.setTimeout(tick, 680)
    }
    window.setTimeout(tick, 600)
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finished = shown >= v.steps.length

  return (
    <div className="tp-screen tp-proc">
      {!finished && <div className="tp-spinner" />}
      {finished ? (
        <h2 className={v.approved ? 'ok' : 'bad'} style={{ color: v.approved ? 'var(--tp-ok)' : 'var(--tp-bad)' }}>
          {v.approved ? 'وافقت الجهة — القرار مطابق لنتيجة طبقة' : 'اعتذرت الجهة عن الطلب'}
        </h2>
      ) : (
        <h2>{offer.lender.nameAr} تشغّل أنظمتها الداخلية…</h2>
      )}
      <p className="tp-hint" style={{ maxWidth: 340, margin: '0 auto 14px' }}>
        الجهة تتحقق بنفسها — على بياناتها ونتائج طبقة فقط، دون ملفك الخام. لذلك قد تختلف نتيجتها أحيانًا عن نتيجة طبقة.
      </p>
      <div className="tp-steps">
        {v.steps.map((s, i) => (
          <div key={s.t} className={`tp-step${i < shown ? (s.ok ? ' done' : ' fail') : i === shown ? ' now' : ''}`}>
            <span className="tp-step-ic">{i < shown ? (s.ok ? '✓' : '✕') : i === shown ? '●' : '○'}</span>
            <span>
              {s.t}
              {s.d && i < shown && <small className="tp-step-d">{s.d}</small>}
            </span>
          </div>
        ))}
      </div>
      {finished && (
        v.approved ? (
          <button className="tp-cta" onClick={onApproved}>متابعة — توقيع العقد إلكترونيًا</button>
        ) : (
          <>
            <div className="tp-banner bad" style={{ textAlign: 'start', marginTop: 14 }}>
              <span>✕</span><span>{v.reasonAr}</span>
            </div>
            <button className="tp-cta" onClick={() => onBackToOffers(v.reasonAr)}>العودة للعروض واختيار جهة أخرى</button>
          </>
        )
      )}
      <Powered />
    </div>
  )
}

// ── stage 10 — contract review + OTP ─────────────────────────────────────────

function Contract({ offer, onBack, onConfirm }: { offer: Offer; onBack: () => void; onConfirm: () => void }) {
  const [agree, setAgree] = useState(false)
  const rows = schedule(offer.amount, offer.annualRate, offer.tenor)
  const head = rows.slice(0, 6)
  const last = rows[rows.length - 1]
  return (
    <Screen title="مراجعة العقد" sub={`ملخص التمويل لدى ${offer.lender.nameAr} وجدول السداد — للمعاينة قبل التوقيع`} onBack={onBack}>
      <div className="tp-receipt">
        <Row k="الجهة الممولة" v={offer.lender.nameAr} />
        <Row k="مبلغ التمويل" v={`${fmt(offer.amount)} ر.س`} />
        <Row k="المدة" v={`${offer.tenor} شهرًا`} />
        <Row k="القسط الشهري" v={`${fmt(offer.installment)} ر.س`} />
        <Row k="النسبة السنوية" v={pct(offer.annualRate)} />
        <Row k="الرسوم الإدارية" v={`${fmt(offer.adminFee)} ر.س — ضمن الحد النظامي`} />
        <Row k="إجمالي المبلغ المستحق" v={`${fmt(offer.totalCost)} ر.س`} />
      </div>
      <h3 className="tp-h3">جدول السداد</h3>
      <div className="tp-sched-wrap">
        <table className="tp-sched">
          <thead><tr><th>#</th><th>القسط</th><th>الأصل</th><th>الربح</th><th>المتبقي</th></tr></thead>
          <tbody>
            {head.map((r) => (
              <tr key={r.n}><td>{r.n}</td><td>{fmt(r.pay)}</td><td>{fmt(r.principal)}</td><td>{fmt(r.profit)}</td><td>{fmt(r.balance)}</td></tr>
            ))}
            <tr className="tp-sched-skip"><td colSpan={5}>… حتى القسط {offer.tenor}</td></tr>
            <tr><td>{last.n}</td><td>{fmt(last.pay)}</td><td>{fmt(last.principal)}</td><td>{fmt(last.profit)}</td><td>0</td></tr>
          </tbody>
        </table>
      </div>
      <label className="tp-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>قرأتُ شروط التمويل والإفصاحات ووافقتُ عليها</span>
      </label>
      <button className="tp-cta" disabled={!agree} onClick={onConfirm}>توقيع العقد إلكترونيًا</button>
    </Screen>
  )
}

function Otp({ onBack, onOk }: { onBack: () => void; onOk: () => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState(false)
  function submit() {
    if (code === '1234') onOk()
    else setErr(true)
  }
  return (
    <Screen title="رمز التحقق" sub="أدخل الرمز المرسل إلى جوالك المسجَّل" onBack={onBack}>
      <input
        className="tp-otp" dir="ltr" inputMode="numeric" maxLength={4} autoFocus
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr(false) }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {err && <p className="tp-err">الرمز غير صحيح — حاول مرة أخرى</p>}
      <p className="tp-hint">نسخة تجريبية — الرمز: 1234</p>
      <button className="tp-cta" disabled={code.length !== 4} onClick={submit}>تأكيد التوقيع</button>
    </Screen>
  )
}

// ── shared pieces ────────────────────────────────────────────────────────────

function Screen({ title, sub, tone, onBack, children }: {
  title: string; sub?: string; tone?: 'ok'; onBack?: () => void; children: React.ReactNode
}) {
  return (
    <div className="tp-screen">
      <div className="tp-screen-head">
        {onBack && <button className="tp-back" onClick={onBack} aria-label="رجوع">‹</button>}
        <h2 className={tone === 'ok' ? 'ok' : ''}>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function Pledge({ yes, text }: { yes?: boolean; text: React.ReactNode }) {
  return (
    <div className={`tp-promise ${yes ? 'yes' : 'no'}`}>
      <span className="ic">
        {yes
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.7 4.6 4.6L19 7.7" /></svg>
          : <span style={{ fontSize: 11, fontWeight: 800 }}>✕</span>}
      </span>
      <span>{text}</span>
    </div>
  )
}

function ConsentSource({ s }: { s: ConsentDef }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`tp-src${open ? ' open' : ''}`}>
      <button className="tp-src-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="tp-src-ic"><SrcIcon ic={s.ic} /></span>
        <span className="tp-src-t"><b>{s.t}</b><small>{s.d}</small></span>
        <span className={`tp-src-scope${s.scope === 'limited' ? ' warn' : ''}`}>
          {s.scope === 'limited' ? 'محدود جدًا' : 'قراءة فقط'}
        </span>
        <span className="tp-src-chev" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <dl className="tp-src-details">
          <dt>ماذا نقرأ</dt><dd>{s.what}</dd>
          <dt>من أين</dt><dd>{s.from}</dd>
          <dt>كيف — التقنية</dt><dd>{s.tech}</dd>
        </dl>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="tp-row"><span>{k}</span><b>{v}</b></div>
}

function Powered() {
  return (
    <div className="tp-powered">
      محرك <b>طبقة</b> · جميع الجهات والبيانات محاكاة عبر Tabaqa Sandbox API — الجهات المعروضة أمثلة توضيحية
    </div>
  )
}
