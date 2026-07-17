// The تمويل journey inside the bank app (PRODUCT_SPEC §6–§13).
// Request → consent → engine (3–6s) → decision + reveal → offers → docs → OTP → done.
// All figures computed in financeMath.ts; the engine story is Tabaqa-behind-the-bank.

import { useEffect, useMemo, useState } from 'react'
import {
  PRODUCT, BankOffer, offersFor, maxFinancing, eligibleIncome,
  installmentRoom, schedule, fmt, pct, AHMED,
} from './financeMath'
import {
  PERSONAS, RAW_COUNTS, retrieveSource, verifyIdentity, warmSandbox,
  type Retrieval, type Transport,
} from './connectors'
import { applicationId } from '../bankdash/appdata'
import { Ic, IconName } from './icons'

type Stage =
  | 'products' | 'request' | 'consent' | 'processing'
  | 'result' | 'docs' | 'otp' | 'done'

const STAGES: Stage[] = ['products', 'request', 'consent', 'processing', 'result', 'docs', 'otp', 'done']

// Spec §6.5 — the progress experience while connectors + engine run. Each step's
// detail line is REAL: computed by derive.ts from the raw datasets the connectors
// return (web/src/data/ahmed/*.json) — not scripted copy. Retrieval steps (identity,
// employment, accounts, obligations) tick when their HTTP call to the Tabaqa Sandbox
// actually resolves (Processing below); the engine passes in between are local
// compute, paced only for legibility.
const ENGINE_STEPS: { t: string; d?: string }[] = [
  { t: 'التحقق من الهوية', d: 'عميل موثّق لدى المصرف' },
  { t: 'جلب بيانات التوظيف والراتب', d: `${AHMED.sector} · راتب موثّق ${fmt(AHMED.verifiedSalary)} ر.س` },
  { t: 'ربط الحسابات المالية بموافقتك', d: `${RAW_COUNTS.accounts} مصادر · ${RAW_COUNTS.total} عملية` },
  { t: 'تحليل الدخل والمصروفات', d: `دخل معتمد ${fmt(eligibleIncome(true))} ر.س · مصروفات أساسية ${fmt(AHMED.essentials)} ر.س` },
  { t: 'فحص الالتزامات القائمة', d: `${fmt(AHMED.obligations)} ر.س/شهر · مطابقة للسجل الائتماني ✓` },
  { t: 'تطبيق سياسة التمويل في المصرف', d: 'حد الاستقطاع النظامي مطبَّق' },
  { t: 'تجهيز العروض المؤهلة' },
]

// Spec §6.4 — the consented sources.
const CONSENT_SOURCES: { icon: IconName; t: string; d: string }[] = [
  { icon: 'bank', t: 'حساباتك في المصرف', d: 'الرواتب والحركات في حسابك الجاري' },
  { icon: 'link', t: 'حساباتك في البنوك الأخرى', d: 'عبر الخدمات المصرفية المفتوحة — قراءة فقط' },
  { icon: 'wallet', t: 'محفظتك الرقمية', d: 'الدخل الجانبي والتحويلات المنتظمة' },
  { icon: 'briefcase', t: 'بيانات التوظيف والراتب', d: 'التحقق من جهة العمل والراتب الموثّق' },
  { icon: 'chart', t: 'السجل الائتماني', d: 'الالتزامات القائمة وتاريخ السداد' },
]

export function FinanceFlow({ onExit }: { onExit: () => void }) {
  // ?fin=<stage> — rehearsal/dev shortcut straight to a stage.
  const preset = useMemo(() => {
    const q = new URLSearchParams(window.location.search).get('fin') as Stage | null
    return q && STAGES.includes(q) ? q : null
  }, [])

  const [stage, setStage] = useState<Stage>(preset ?? 'products')

  // Wake the serverless API the moment the flow opens: by the time the user has
  // picked an amount and read the consent screen, the lambda is warm and the
  // processing screen's retrievals answer inside their timeout.
  useEffect(() => { warmSandbox() }, [])
  const [amount, setAmount] = useState(150_000)
  const [maxMode, setMaxMode] = useState(false)
  const [selected, setSelected] = useState<BankOffer | null>(null)
  // Derived from the applicant, NOT the clock: the bank dashboard (§15) computes the
  // same id from the same seed, so the رقم الطلب on Ahmed's receipt is the row a judge
  // finds in the bank's queue. A Date.now() id renumbered every run and matched nothing.
  const appNo = useMemo(() => applicationId(PERSONAS.ahmed), [])

  const ceilingFused = maxFinancing(true)
  const ceilingBank = maxFinancing(false)
  const grantable = maxMode ? Math.floor(ceilingFused / 1000) * 1000 : Math.min(amount, Math.floor(ceilingFused / 1000) * 1000)
  const approvedInFull = !maxMode && amount <= ceilingFused
  const offers = offersFor(grantable)
  const recommended = offers.find((o) => o.recommended && o.available) ?? offers.find((o) => o.available)!

  useEffect(() => {
    if (preset && preset !== 'products' && preset !== 'request' && !selected) setSelected(recommended)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  return (
    <div className="bk-fin">
      {stage === 'products' && (
        <Screen title="التمويل" sub="اختر نوع التمويل — القرار خلال ثوانٍ، دون زيارة الفرع">
          <button className="bk-prod" onClick={() => setStage('request')}>
            <span className="bk-prod-ic"><Ic name="car" /></span>
            <span>
              <b>تمويل المركبات</b>
              <small>حتى 500,000 ر.س · قرار فوري</small>
            </span>
            <span className="bk-chev">‹</span>
          </button>
          <button className="bk-prod off" disabled>
            <span className="bk-prod-ic"><Ic name="card" /></span>
            <span><b>التمويل الشخصي</b><small>قريبًا</small></span>
          </button>
          <button className="bk-prod off" disabled>
            <span className="bk-prod-ic"><Ic name="building" /></span>
            <span><b>التمويل العقاري</b><small>قريبًا</small></span>
          </button>
          <PoweredBy />
        </Screen>
      )}

      {stage === 'request' && (
        <Screen title="تمويل المركبات" sub="كم تحتاج؟" onBack={() => setStage('products')}>
          <label className="bk-lab">المبلغ المطلوب (ر.س)</label>
          <input
            className="bk-amount" type="number" inputMode="numeric" dir="ltr"
            value={maxMode ? '' : amount} disabled={maxMode}
            placeholder={maxMode ? '—' : undefined}
            min={PRODUCT.minAmount} max={PRODUCT.maxAmount} step={5000}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
          />
          <label className="bk-check">
            <input type="checkbox" checked={maxMode} onChange={(e) => setMaxMode(e.target.checked)} />
            <span>احسب أقصى مبلغ يمكنني الحصول عليه</span>
          </label>
          <p className="bk-hint">مدة السداد والدفعة الأولى اختيارية — سنعرض عليك الخيارات المؤهلة.</p>
          <button
            className="bk-cta"
            disabled={!maxMode && (amount < PRODUCT.minAmount || amount > PRODUCT.maxAmount)}
            onClick={() => setStage('consent')}
          >متابعة</button>
          {!maxMode && amount > 0 && (amount < PRODUCT.minAmount || amount > PRODUCT.maxAmount) && (
            <p className="bk-warn">مبلغ التمويل بين {fmt(PRODUCT.minAmount)} و {fmt(PRODUCT.maxAmount)} ر.س</p>
          )}
        </Screen>
      )}

      {stage === 'consent' && (
        <Screen title="الموافقة على الوصول للبيانات" sub="لنحسب أهليتك، سيصل المصرف — بموافقتك — إلى:" onBack={() => setStage('request')}>
          <div className="bk-consent">
            {CONSENT_SOURCES.map((s) => (
              <div key={s.t} className="bk-src">
                <span className="bk-src-ic"><Ic name={s.icon} size={18} /></span>
                <span><b>{s.t}</b><small>{s.d}</small></span>
                <span className="bk-src-ok"><Ic name="check" size={16} stroke={2.6} /></span>
              </div>
            ))}
          </div>
          <p className="bk-hint">
            الغرض: تقييم أهليتك للتمويل فقط. الوصول للقراءة فقط، ويمكنك إلغاؤه في أي وقت.
            تُسجَّل موافقتك بختم زمني ضمن سجل التدقيق.
          </p>
          <button className="bk-cta" onClick={() => setStage('processing')}>
            اسمح بالوصول واحسب أهليتي
          </button>
          <button className="bk-ghost" onClick={onExit}>إلغاء</button>
        </Screen>
      )}

      {stage === 'processing' && <Processing onDone={() => setStage('result')} />}

      {stage === 'result' && (
        <Screen title={approvedInFull || maxMode ? 'تمت الموافقة تلقائيًا ✓' : 'قرارك جاهز'} tone={approvedInFull || maxMode ? 'ok' : undefined}>
          <Reveal grantable={grantable} approvedInFull={approvedInFull} maxMode={maxMode} requested={amount} ceilingBank={ceilingBank} />
          <div className="bk-offers">
            {offers.map((o) => (
              <button
                key={o.months}
                className={`bk-offer${o.recommended && o.available ? ' rec' : ''}${!o.available ? ' locked' : ''}${selected?.months === o.months ? ' sel' : ''}`}
                disabled={!o.available}
                onClick={() => setSelected(o)}
              >
                {o.recommended && o.available && <span className="bk-rec">موصى به · توازن بين القسط والتكلفة</span>}
                <div className="bk-offer-row">
                  <b>{fmt(o.installment)} <small>ر.س/شهر</small></b>
                  <span>{o.months} شهرًا</span>
                </div>
                <div className="bk-offer-meta">
                  <span>معدل النسبة السنوي {pct(o.apr)}</span>
                  <span>الإجمالي {fmt(o.total)} ر.س</span>
                </div>
                {!o.available && (
                  <div className="bk-offer-lock">القسط يتجاوز حد الاستقطاع النظامي ({fmt(installmentRoom(true))} ر.س) — غير متاح</div>
                )}
              </button>
            ))}
          </div>
          <button className="bk-cta" disabled={!selected} onClick={() => setStage('docs')}>
            متابعة بالعرض المحدد
          </button>
          <PoweredBy />
        </Screen>
      )}

      {stage === 'docs' && selected && (
        <Docs amount={grantable} offer={selected} onBack={() => setStage('result')} onConfirm={() => setStage('otp')} />
      )}

      {stage === 'otp' && <Otp onBack={() => setStage('docs')} onOk={() => setStage('done')} />}

      {stage === 'done' && selected && (
        <Screen title="تمت الموافقة تلقائيًا — اكتمل التوثيق" tone="ok">
          <div className="bk-done">
            <div className="bk-done-badge"><Ic name="check" size={34} stroke={2.4} /></div>
            <p>
              تمت الموافقة على طلب تمويلك تلقائيًا واكتملت جميع المستندات المطلوبة.
              الطلب جاهز للتفعيل وفق إجراءات المصرف المعتمدة.
            </p>
            <div className="bk-receipt">
              <Row k="رقم الطلب" v={appNo} />
              <Row k="المبلغ" v={`${fmt(grantable)} ر.س`} />
              <Row k="القسط الشهري" v={`${fmt(selected.installment)} ر.س × ${selected.months}`} />
              <Row k="التوثيق الإلكتروني" v="مؤكَّد (OTP)" />
              <Row k="سجل التدقيق" v="مكتمل — إيصال امتثال مُنشأ" />
            </div>
            <p className="bk-nobranch">كل ذلك — دون زيارة الفرع.</p>
          </div>
          <button className="bk-cta" onClick={onExit}>العودة للرئيسية</button>
          <PoweredBy />
        </Screen>
      )}
    </div>
  )
}

// ── pieces ───────────────────────────────────────────────────────────────────

function Screen({ title, sub, tone, onBack, children }: {
  title: string; sub?: string; tone?: 'ok'; onBack?: () => void; children: React.ReactNode
}) {
  return (
    <div className="bk-screen">
      <div className="bk-screen-head">
        {onBack && <button className="bk-back" onClick={onBack} aria-label="رجوع">‹</button>}
        <h2 className={tone === 'ok' ? 'ok' : ''}>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

// The retrieval is REAL: steps 0/1/2/4 advance only when their HTTP call to the
// Tabaqa Sandbox (/sandbox/v1/*) resolves — watch the network tab. Steps 3/5/6 are
// the local engine passes (derive.ts is synchronous), paced so the tick is legible.
// If the API is unreachable every connector falls back to the bundled payload at
// the same pacing (identical bytes — see connectors.ts) and the footer says so.
function Processing({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [transport, setTransport] = useState<Transport | null>(null)
  useEffect(() => {
    // closure-scoped so StrictMode's discarded first run can never tick the UI
    let alive = true
    const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
    const tick = (i: number) => { if (alive) setStep(i) }
    const events: Retrieval<unknown>[] = []
    const grab = async <T,>(p: Promise<Retrieval<T>>) => { events.push(await p) }
    const me = PERSONAS.ahmed.id
    ;(async () => {
      await grab(verifyIdentity(me));                    tick(1)
      await grab(retrieveSource(me, 'employment'));      tick(2)
      await Promise.all([
        grab(retrieveSource(me, 'bank')),
        grab(retrieveSource(me, 'openbanking')),
        grab(retrieveSource(me, 'wallet')),
      ]);                                                tick(3)
      await pause(520);                                  tick(4) // income/expense analysis — local derive
      await grab(retrieveSource(me, 'credit'));          tick(5)
      if (alive) {
        setTransport(events.every((e) => e.transport === 'sandbox') ? 'sandbox' : 'local')
      }
      await pause(480);                                  tick(6) // bank policy — local
      await pause(600)                                           // offers assembled
      if (alive) window.setTimeout(onDone, 700)
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="bk-screen bk-proc">
      <div className="bk-spinner" />
      <h2>نحسب أهليتك الآن…</h2>
      <div className="bk-steps">
        {ENGINE_STEPS.map((s, i) => (
          <div key={s.t} className={`bk-step${i < step ? ' done' : i === step ? ' now' : ''}`}>
            <span className="bk-step-ic">{i < step ? '✓' : i === step ? '●' : '○'}</span>
            <span>
              {s.t}
              {s.d && i <= step && <small className="bk-step-d">{s.d}</small>}
            </span>
          </div>
        ))}
      </div>
      <p className="bk-hint bk-proc-net">
        {transport === 'sandbox'
          ? 'المصادر استُدعيت عبر Tabaqa Sandbox API — بيئة تجريبية، جميع البيانات محاكاة'
          : transport === 'local'
            ? 'وضع بدون اتصال — بيانات محاكاة محلية بنفس الإيقاع'
            : 'يجلب البيانات من المصادر الخمسة…'}
      </p>
      <PoweredBy />
    </div>
  )
}

// The hybrid reveal: the bank's own view can't cover the ask; the consented,
// fused view approves it in full. Same mechanic as the dashboard reveal.
function Reveal({ grantable, approvedInFull, maxMode, requested, ceilingBank }: {
  grantable: number; approvedInFull: boolean; maxMode: boolean; requested: number; ceilingBank: number
}) {
  return (
    <div className="bk-reveal">
      <div className="bk-rev-row dim">
        <span>على بيانات حسابك في المصرف فقط</span>
        <b>دخل موثّق {fmt(eligibleIncome(false))} ← حد أقصى ≈ {fmt(ceilingBank)} ر.س</b>
      </div>
      <div className="bk-rev-arrow">↓ بعد موافقتك: التوظيف + البنوك الأخرى + المحفظة</div>
      <div className="bk-rev-row lit">
        <span>الصورة الكاملة الموثّقة</span>
        <b>
          دخل موثّق {fmt(eligibleIncome(true))} ←{' '}
          {maxMode
            ? `أقصى تمويل متاح لك ${fmt(grantable)} ر.س`
            : approvedInFull
              ? `موافقة على كامل المبلغ ${fmt(grantable)} ر.س`
              : `المطلوب ${fmt(requested)} يتجاوز الحد — المتاح ${fmt(grantable)} ر.س`}
        </b>
      </div>
    </div>
  )
}

function Docs({ amount, offer, onBack, onConfirm }: {
  amount: number; offer: BankOffer; onBack: () => void; onConfirm: () => void
}) {
  const [agree, setAgree] = useState(false)
  const rows = schedule(amount, offer.apr, offer.months)
  const head = rows.slice(0, 6)
  const last = rows[rows.length - 1]
  return (
    <Screen title="مراجعة المستندات" sub="ملخص الطلب وجدول السداد — للمعاينة قبل التأكيد" onBack={onBack}>
      <div className="bk-receipt">
        <Row k="المنتج" v={PRODUCT.nameAr} />
        <Row k="مبلغ التمويل" v={`${fmt(amount)} ر.س`} />
        <Row k="المدة" v={`${offer.months} شهرًا`} />
        <Row k="القسط الشهري" v={`${fmt(offer.installment)} ر.س`} />
        <Row k="معدل النسبة السنوي" v={pct(offer.apr)} />
        <Row k="الرسوم الإدارية" v={`${fmt(offer.adminFee)} ر.س`} />
        <Row k="إجمالي المبلغ المستحق" v={`${fmt(offer.total)} ر.س`} />
      </div>
      <h3 className="bk-h3">جدول السداد</h3>
      <div className="bk-sched-wrap">
        <table className="bk-sched">
          <thead><tr><th>#</th><th>القسط</th><th>الأصل</th><th>الربح</th><th>المتبقي</th></tr></thead>
          <tbody>
            {head.map((r) => (
              <tr key={r.n}>
                <td>{r.n}</td><td>{fmt(r.pay)}</td><td>{fmt(r.principal)}</td><td>{fmt(r.profit)}</td><td>{fmt(r.balance)}</td>
              </tr>
            ))}
            <tr className="bk-sched-skip"><td colSpan={5}>… حتى القسط {offer.months}</td></tr>
            <tr>
              <td>{last.n}</td><td>{fmt(last.pay)}</td><td>{fmt(last.principal)}</td><td>{fmt(last.profit)}</td><td>0</td>
            </tr>
          </tbody>
        </table>
      </div>
      <label className="bk-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>قرأتُ شروط التمويل والإفصاحات ووافقتُ عليها</span>
      </label>
      <button className="bk-cta" disabled={!agree} onClick={onConfirm}>تأكيد طلب التمويل</button>
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
    <Screen title="رمز التحقق" sub="أدخل الرمز المرسل إلى جوالك ‎+966 •• ••• 4821" onBack={onBack}>
      <input
        className="bk-otp" dir="ltr" inputMode="numeric" maxLength={4} autoFocus
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr(false) }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {err && <p className="bk-warn">الرمز غير صحيح — حاول مرة أخرى</p>}
      <p className="bk-hint">نسخة تجريبية — الرمز: 1234</p>
      <button className="bk-cta" disabled={code.length !== 4} onClick={submit}>تأكيد</button>
    </Screen>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="bk-row"><span>{k}</span><b>{v}</b></div>
  )
}

function PoweredBy() {
  return <div className="bk-powered">قرارات التمويل عبر محرك <b>Tabaqa</b> · API مضمَّنة في تطبيق المصرف</div>
}
