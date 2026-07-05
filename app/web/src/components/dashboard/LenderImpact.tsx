import { useState } from 'react'
import { useTx } from '../../lib/tx'
import card from '../../data/model_card.json'

/**
 * F5 + F6 · the lender-impact block — feasibility in the buyer's language, computed
 * from our OWN published evidence (model_card.json), never invented:
 *
 *   F5 ROI — the swap-set (real Berka defaults, equal approval volume: 7.6% → 2.9%
 *   approved-pool bad rate) translated into a CFO's money line. Volumes, ticket,
 *   LGD and price are the lender's policy inputs; the risk delta is measured.
 *
 *   F6 Inclusion — the thin-file segment (37% of the demonstration book) that a
 *   bureau view ranks near coin-flip (AUC 0.60) becomes scoreable (0.77), tied to
 *   the verified national frame: the 78.8%-banked vs 56.7%-bureau-covered wedge
 *   and the FSDP SME-credit KPI (9.4% actual vs 20%-by-2030). Sources: EVIDENCE.md
 *   refs 20–21; AUCs from the real-Berka ablation in the model card.
 */

const swap = card.swap_set
const thin = card.thin_file
const thinShare =
  (card.corpus.segments as { key: string; share: number }[]).find((s) => s.key === 'thin_file')?.share ?? 0.37

// FSDP SME-credit KPI (share of bank credit) — verified in EVIDENCE.md ref 21.
const FSDP = { base2019: 5.7, actual: 9.4, interim2025: 11, target2030: 20 }
// Banked-vs-bureau wedge — verified in EVIDENCE.md ref 20 (vintage caveat noted in copy).
const WEDGE = { banked: 78.8, bureau: 56.7 }

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`

function NumField({
  label, v, set, suffix,
}: { label: string; v: number; set: (n: number) => void; suffix?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-wrap">
        <input type="number" value={Number.isFinite(v) ? v : ''} onChange={(e) => set(parseFloat(e.target.value))} />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
    </div>
  )
}

export function LenderImpact() {
  const { tx } = useTx()
  const SAR = tx('SAR', 'ر.س')

  // The lender's policy inputs (defaults = a mid-size consumer-finance book).
  const [decisions, setDecisions] = useState(10_000)
  const [avgLoan, setAvgLoan] = useState(60_000)
  const [lgd, setLgd] = useState(45)
  const [price, setPrice] = useState(25)

  // Measured on real Berka defaults at equal approval volume — see ModelCardPanel.
  const dBad = swap.baseline_approved_bad_rate - swap.full_approved_bad_rate
  const approved = (decisions || 0) * swap.approval_rate
  const avoided = approved * dBad
  const saved = avoided * (avgLoan || 0) * ((lgd || 0) / 100)
  const cost = (decisions || 0) * (price || 0)
  const net = saved - cost
  const roi = cost > 0 ? saved / cost : 0

  const thinPerMonth = (decisions || 0) * thinShare
  const cut = 1 - swap.full_approved_bad_rate / swap.baseline_approved_bad_rate

  return (
    <div className="li">
      {/* ── F5 · the CFO line ── */}
      <div className="li-panel">
        <div className="li-head">
          <div>
            <span className="li-cap">{tx('The CFO line — risk cut, in money', 'سطر المدير المالي — خفض المخاطر بالأرقام')}</span>
            <span className="li-sub faint">
              {tx(
                `measured on real defaults at equal approval volume: approved-pool bad rate ${pct1(swap.baseline_approved_bad_rate)} → ${pct1(swap.full_approved_bad_rate)} (−${Math.round(cut * 100)}%)`,
                `مقيس على تعثّرات حقيقية بحجم موافقات متساوٍ: نسبة التعثّر في المحفظة ${pct1(swap.baseline_approved_bad_rate)} ← ${pct1(swap.full_approved_bad_rate)} (−${Math.round(cut * 100)}٪)`,
              )}
            </span>
          </div>
          <span className="li-roi" dir="ltr">×{roi.toFixed(0)}</span>
        </div>

        <div className="li-inputs">
          <NumField label={tx('Decisions / month', 'قرارات / شهر')} v={decisions} set={setDecisions} />
          <NumField label={tx('Avg financing', 'متوسط التمويل')} v={avgLoan} set={setAvgLoan} suffix={SAR} />
          <NumField label={tx('Loss given default %', 'الخسارة عند التعثّر %')} v={lgd} set={setLgd} />
          <NumField label={tx('Price / decision', 'السعر / قرار')} v={price} set={setPrice} suffix={SAR} />
        </div>

        <div className="li-outs">
          <div className="stat">
            <div className="stat-label">{tx('Defaults avoided / mo', 'تعثّرات مُتجنَّبة / شهر')}</div>
            <div className="stat-value" dir="ltr">≈ {fmt(avoided)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">{tx('Credit losses avoided / mo', 'خسائر ائتمانية مُتجنَّبة / شهر')}</div>
            <div className="stat-value" dir="ltr">{compact.format(saved)} <small>{SAR}</small></div>
          </div>
          <div className="stat">
            <div className="stat-label">{tx('Tabaqa cost / mo', 'تكلفة طبقة / شهر')}</div>
            <div className="stat-value" dir="ltr">{compact.format(cost)} <small>{SAR}</small></div>
          </div>
          <div className="stat li-net">
            <div className="stat-label">{tx('Net / mo — every SAR 1 returns', 'الصافي / شهر — كل ريال يعيد')}</div>
            <div className="stat-value" dir="ltr">{compact.format(net)} <small>{SAR}</small> · ×{roi.toFixed(1)}</div>
          </div>
        </div>

        <div className="li-note faint">
          {tx(
            'Demonstration arithmetic: the bad-rate delta is measured (real Berka defaults, equal approval volume — see Model validation); volumes, ticket, LGD and price are your policy inputs. Re-measured on your book at go-live.',
            'حساب توضيحي: فارق نسبة التعثّر مقيس (تعثّرات Berka حقيقية بحجم موافقات متساوٍ — انظر التحقق من النموذج)؛ الأحجام والمبلغ والخسارة والسعر مدخلات سياستكم. يُعاد قياسه على محفظتكم عند الإطلاق.',
          )}
        </div>
      </div>

      {/* ── F6 · the inclusion meter ── */}
      <div className="li-panel">
        <div className="li-head">
          <div>
            <span className="li-cap">{tx('The inclusion meter — the FSDP line', 'مقياس الشمول — سطر برنامج تطوير القطاع المالي')}</span>
            <span className="li-sub faint">
              {tx(
                `${(WEDGE.banked - WEDGE.bureau).toFixed(1)} points of Saudis are banked (${WEDGE.banked}%, Findex 2024) but bureau-covered only ${WEDGE.bureau}% (last official, 2020) — banked, yet unscorable`,
                `${(WEDGE.banked - WEDGE.bureau).toFixed(1)} نقطة من السعوديين لديهم حسابات (${WEDGE.banked}٪، فينديكس 2024) لكن تغطية المكتب الائتماني ${WEDGE.bureau}٪ فقط (آخر رقم رسمي، 2020) — مصرفيّون لكن غير قابلين للتقييم`,
              )}
            </span>
          </div>
        </div>

        {/* the book: thin-file share a bureau ranks near coin-flip */}
        <div className="li-meter">
          <div className="li-meter-track">
            <span className="li-meter-fill" style={{ width: `${thinShare * 100}%` }} />
          </div>
          <div className="li-meter-legend">
            <span>
              <b dir="ltr">{Math.round(thinShare * 100)}%</b> {tx('of the book is thin-file', 'من المحفظة ملفات رقيقة')} ·{' '}
              {tx('bureau view ranks them at', 'رؤية المكتب ترتّبهم عند')} <b dir="ltr">AUC {thin.baseline_auc.toFixed(2)}</b>{' '}
              {tx('(coin flip = 0.50) — with the wallet layer', '(العملة المرمية = 0.50) — ومع طبقة المحفظة')}{' '}
              <b dir="ltr">{thin.full_auc.toFixed(2)}</b>
            </span>
            <span className="faint">
              {tx(
                `at ${fmt(decisions || 0)} decisions/mo ≈ ${fmt(thinPerMonth)} applicants your bureau can’t rank — Tabaqa can`,
                `عند ${fmt(decisions || 0)} قرار/شهر ≈ ${fmt(thinPerMonth)} متقدمًا لا يستطيع المكتب ترتيبهم — طبقة تستطيع`,
              )}
            </span>
          </div>
        </div>

        {/* the national KPI this moves */}
        <div className="li-fsdp">
          <div className="li-fsdp-head">
            <span>{tx('FSDP KPI · SME share of bank credit', 'مؤشر البرنامج · حصة المنشآت الصغيرة من الائتمان')}</span>
            <span className="faint" dir="ltr">2019 {FSDP.base2019}% → {FSDP.actual}% <b>Q4 2024</b> · target {FSDP.target2030}% by 2030</span>
          </div>
          <div className="li-fsdp-track">
            <span className="li-fsdp-fill" style={{ width: `${(FSDP.actual / FSDP.target2030) * 100}%` }} />
            <span className="li-fsdp-tick" style={{ insetInlineStart: `${(FSDP.interim2025 / FSDP.target2030) * 100}%` }} title={tx('2025 interim target 11%', 'الهدف المرحلي 2025: 11٪')} />
          </div>
          <div className="li-fsdp-legend faint">
            <span dir="ltr">{FSDP.actual}%</span>
            <span>{tx('interim 11% (2025) — missed; the gap is an assessment gap, not an appetite gap', 'الهدف المرحلي 11٪ (2025) — لم يتحقق؛ والفجوة فجوة تقييم لا فجوة رغبة')}</span>
            <span dir="ltr">{FSDP.target2030}%</span>
          </div>
        </div>

        <div className="li-note faint">
          {tx(
            'Thin-file share from the 1M-account Saudi-anchored demonstration book (no accuracy claim); AUCs measured on real Berka defaults. Wedge figures carry different vintages — stated as-is in EVIDENCE.md.',
            'حصة الملفات الرقيقة من محفظة العرض السعودية المرساة (مليون حساب، دون ادعاء دقة)؛ قيم AUC مقيسة على تعثّرات Berka حقيقية. رقما الفجوة من سنتين مختلفتين — كما هو مثبت في ملف الأدلة.',
          )}
        </div>
      </div>
    </div>
  )
}
