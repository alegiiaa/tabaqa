import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'
import { useTx } from '../../lib/tx'
import card from '../../data/model_card.json'

/**
 * Model-card / wallet-layer ABLATION panel — the on-screen proof for the
 * "Data analysis" criterion. Every number is the real out-of-sample result of
 * eval/ablation.py on the public Berka / PKDD'99 default data (see model_card.json),
 * so the rigor is on screen instead of buried in a markdown file.
 *
 * The centrepiece is the wallet-layer toggle: flip it and watch a bureau-only
 * model (AUC 0.66) gain the 7 cash-flow features and jump to 0.86 — with the
 * ROC curve, KS, Brier and thin-file/swap-set panels all re-rendering live.
 */

// ── typed view over the generated JSON ──────────────────────────────────────
type Curve = { label: string; features: string[]; auc: number; ks: number; brier: number; roc: number[][] }
interface ModelCard {
  dataset: string; n_accounts: number; n_defaults: number; bad_rate: number
  baseline: Curve; full: Curve
  lift: { auc: number; ci_low: number; ci_high: number; p_gt_0: number; n_boot: number }
  thin_file: {
    definition: string; n: number; n_defaults: number
    baseline_auc: number; full_auc: number; baseline_roc: number[][]; full_roc: number[][]
  }
  swap_set: {
    approval_rate: number; baseline_approved_bad_rate: number; full_approved_bad_rate: number
    swap_in_n: number; swap_in_bad_rate: number; swap_out_n: number; swap_out_bad_rate: number
  }
  calibration: { bins: { pred: number; obs: number; n: number }[]; brier_baseline: number; brier_full: number }
  score_bands: { band: string; n: number; defaults: number; rate: number }[]
  information_value: { name: string; iv: number }[]
  caveats: string[]
  corpus?: Corpus
  cross_check?: CrossCheck | null
  lineage?: Lineage
}

// ── additive scale / cross-check / lineage blocks (optional — the card degrades
//    gracefully if eval/build_model_card.py hasn't run) ──────────────────────
interface CorpusSegment { key: string; label: string; n: number; share: number; bad_rate: number }
interface Corpus {
  generator: string
  n_source_accounts: number; n_synthetic_accounts: number
  n_real_transactions: number; mean_txns_per_account: number; n_transactions_extrapolated: number
  n_segments: number; segments: CorpusSegment[]; methodology: string
  tstr: { auc: number; ks: number; note: string }
  trtr: { auc: number; ks: number; note: string }
  retention: number
  fidelity: { avg_ks_complement: number; per_feature: { name: string; ks_complement: number }[]; note: string }
}
interface CrossCheck {
  dataset: string; n_accounts: number; n_defaults: number; bad_rate: number
  baseline: { auc: number; ks: number }; full: { auc: number; ks: number }
  lift: { auc: number; ci_low: number; ci_high: number; p_gt_0: number }
  feature_mapping: { tabaqa: string; homecredit: string }[]; caveats: string[]
}
interface Lineage { tiers: { tier: string; source: string; claim: string }[]; live_scorer: string }

const c = card as ModelCard

const intFmt = (n: number) => Math.round(n).toLocaleString('en-US')
const SEG_LABEL: Record<string, [string, string]> = {
  thin_file: ['Thin-file', 'محدودو السجل'],
  high_obligation: ['Heavily obligated', 'مثقلون بالالتزامات'],
  irregular_income: ['Irregular income', 'دخل غير منتظم'],
  stable_salaried: ['Stable salaried', 'رواتب مستقرة'],
}
const TIER_LABEL: Record<string, [string, string]> = {
  Validity: ['Validity', 'الصحّة'],
  Scale: ['Scale', 'المقياس'],
  Generalization: ['Generalization', 'التعميم'],
}

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`
const pct0 = (x: number) => `${Math.round(x * 100)}%`

const FEATURE_LABEL: Record<string, [string, string]> = {
  balance_volatility: ['Balance volatility', 'تقلّب الرصيد'],
  income_regularity: ['Income regularity', 'انتظام الدخل'],
  recurring_obligation_load: ['Obligation load', 'عبء الالتزامات'],
  min_balance: ['Minimum balance', 'أدنى رصيد'],
  income_expense_ratio: ['Income ÷ expense', 'الدخل ÷ المصروف'],
  avg_balance: ['Average balance', 'متوسط الرصيد'],
  nsf_count: ['Overdraft events', 'السحب على المكشوف'],
}

// ── animated number (counts between values on toggle) ───────────────────────
function Num({
  value, digits = 3, className, format, from0 = false, duration = 0.6,
}: {
  value: number; digits?: number; className?: string
  format?: (n: number) => string; from0?: boolean; duration?: number
}) {
  const [d, setD] = useState(from0 ? 0 : value)
  const from = useRef(from0 ? 0 : value)
  useEffect(() => {
    const ctrl = animate(from.current, value, {
      duration, ease: 'easeOut', onUpdate: (v) => setD(v),
    })
    from.current = value
    return () => ctrl.stop()
  }, [value, duration])
  return <span className={className}>{format ? format(d) : d.toFixed(digits)}</span>
}

// ── ROC chart (hand-drawn SVG; no chart lib) ────────────────────────────────
function Roc({
  baseline, full, showFull, size = 210,
}: { baseline: number[][]; full: number[][]; showFull: boolean; size?: number }) {
  const P = 20
  const span = size - 2 * P
  const X = (fpr: number) => P + fpr * span
  const Y = (tpr: number) => size - P - tpr * span
  const d = (pts: number[][]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' ')
  return (
    <svg className="roc" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="ROC curve">
      {/* frame + chance diagonal */}
      <rect x={P} y={P} width={span} height={span} className="roc-frame" />
      <line x1={P} y1={size - P} x2={size - P} y2={P} className="roc-diag" />
      {/* baseline (bureau) curve — always visible */}
      <path d={d(baseline)} className="roc-base" />
      {/* full (+ wallet) curve — drawn when the wallet layer is on */}
      <path
        key={showFull ? 'on' : 'off'}
        d={d(full)}
        className={`roc-full${showFull ? ' show' : ''}`}
        style={{ transition: 'opacity .4s ease' }}
      />
      <text x={size / 2} y={size - 4} className="roc-ax">False positives →</text>
      <text x={4} y={P - 6} className="roc-ax">True positives ↑</text>
    </svg>
  )
}

function StatDelta({ from, to, good }: { from: string; to: string; good: boolean }) {
  return (
    <span className="mc-delta-row">
      <span className="mc-from">{from}</span>
      <span className={`mc-arrow ${good ? 'good' : 'bad'}`}>→</span>
      <span className={`mc-to ${good ? 'good' : 'bad'}`}>{to}</span>
    </span>
  )
}

export function ModelCardPanel() {
  const { tx } = useTx()
  const [walletOn, setWalletOn] = useState(true)
  const cur = walletOn ? c.full : c.baseline

  const maxIv = Math.max(...c.information_value.map((f) => f.iv))
  const maxRate = Math.max(...c.score_bands.map((b) => b.rate))
  const reduction = (c.swap_set.baseline_approved_bad_rate - c.swap_set.full_approved_bad_rate) /
    c.swap_set.baseline_approved_bad_rate

  return (
    <div className="screen mc">
      <div className="ins-panel">
        <div className="ins-head">
          <div className="ins-title">
            <span className="ins-spark" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 3v5c0 4.6-3.1 7.6-7 9-3.9-1.4-7-4.4-7-9V6z" /><path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            <div>
              <h3>{tx('The wallet layer, measured', 'أثر طبقة المحفظة، مُقاسًا')}</h3>
              <span className="ins-sub faint">{tx(
                'A controlled ablation on real default outcomes — turn the wallet layer on or off.',
                'اختبار مضبوط على نتائج تعثّر حقيقية — شغّل طبقة المحفظة أو أطفئها.',
              )}</span>
            </div>
          </div>
          <span className="ins-badge ai">{tx('Real data', 'بيانات حقيقية')} · Berka {c.n_accounts.toLocaleString('en-US')} · {pct1(c.bad_rate)} {tx('default', 'تعثّر')}</span>
        </div>

        {c.lineage && <LineageStrip lineage={c.lineage} />}

        {/* ── HERO: the toggle + AUC + ROC ─────────────────────────────── */}
        <div className="mc-hero">
          <div className="mc-hero-l">
            <div className="mc-toggle" role="tablist">
              <button role="tab" aria-selected={!walletOn} className={!walletOn ? 'on' : ''} onClick={() => setWalletOn(false)}>
                {tx('Bureau view', 'رؤية المكتب')}
              </button>
              <button role="tab" aria-selected={walletOn} className={walletOn ? 'on' : ''} onClick={() => setWalletOn(true)}>
                {tx('+ Wallet layer', '+ طبقة المحفظة')}
              </button>
            </div>

            <div className="mc-auc">
              <Num value={cur.auc} className="mc-auc-big" />
              <span className="mc-auc-cap">AUC · {tx('out-of-sample', 'خارج العينة')}</span>
            </div>

            <div className={`mc-lift${walletOn ? ' show' : ''}`}>
              <span className="mc-lift-v">+<Num value={c.lift.auc} /> AUC</span>
              <span className="mc-lift-sub">
                {tx('95% CI', 'فاصل ثقة ٩٥٪')} +{c.lift.ci_low.toFixed(2)}…+{c.lift.ci_high.toFixed(2)} ·{' '}
                {tx('significant in', 'دالّ في')} {pct0(c.lift.p_gt_0)} {tx('of bootstraps', 'من العيّنات')}
              </span>
            </div>

            <div className="mc-submetrics">
              <div><Num value={cur.ks} className="mc-sm-v" /><span className="mc-sm-c">KS</span></div>
              <div><Num value={cur.brier} digits={3} className="mc-sm-v" /><span className="mc-sm-c">Brier ↓</span></div>
              <div><span className="mc-sm-v">{walletOn ? c.full.features.length : c.baseline.features.length}</span><span className="mc-sm-c">{tx('features', 'ميزات')}</span></div>
            </div>
          </div>

          <div className="mc-hero-r">
            <Roc baseline={c.baseline.roc} full={c.full.roc} showFull={walletOn} />
            <div className="mc-roc-legend">
              <span><i className="dot base" /> {tx('Bureau', 'المكتب')} {c.baseline.auc.toFixed(2)}</span>
              <span className={walletOn ? '' : 'off'}><i className="dot full" /> {tx('+ Wallet', '+ المحفظة')} {c.full.auc.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <p className="mc-read faint">{tx(
          `Same ${c.n_accounts.toLocaleString('en-US')} accounts, same folds — the only change is adding the 7 cash-flow features. A bulging curve = better separation of defaulters from good borrowers.`,
          `نفس ${c.n_accounts.toLocaleString('en-US')} حسابًا — الفرق الوحيد هو إضافة ميزات التدفق النقدي السبع. انحناء المنحنى للأعلى = فصل أفضل للمتعثّرين عن الجيّدين.`,
        )}</p>

        {c.corpus && <ScaleSection corpus={c.corpus} />}

        {/* ── THIN-FILE: bureau's blind spot ───────────────────────────── */}
        <div className="mc-block">
          <div className="val-block-h">
            <span className="ins-cap">{tx('Thin-file borrowers — where the bureau is blind', 'العملاء محدودو السجل — حيث يعجز المكتب')}</span>
            <span className="faint val-note">{c.thin_file.n} {tx('accounts', 'حسابًا')} · {c.thin_file.definition}</span>
          </div>
          <div className="mc-thin">
            <div className="mc-thin-nums">
              <StatDelta from={`${tx('Bureau', 'المكتب')} ${c.thin_file.baseline_auc.toFixed(3)}`} to={`+ ${tx('Wallet', 'المحفظة')} ${c.thin_file.full_auc.toFixed(3)}`} good />
              <p className="faint">{tx(
                `On the thinnest-history third of the book the bureau scores ${c.thin_file.baseline_auc.toFixed(2)} — barely above a coin-flip (0.50). The wallet layer lifts it to ${c.thin_file.full_auc.toFixed(2)}.`,
                `على الثلث الأقل سجلًّا يحقّق المكتب ${c.thin_file.baseline_auc.toFixed(2)} — بالكاد أفضل من العشوائية (٠٫٥٠). طبقة المحفظة ترفعه إلى ${c.thin_file.full_auc.toFixed(2)}.`,
              )}</p>
            </div>
            <Roc baseline={c.thin_file.baseline_roc} full={c.thin_file.full_roc} showFull size={170} />
          </div>
        </div>

        {/* ── SWAP-SET: the business kill-shot ─────────────────────────── */}
        <div className="mc-block">
          <div className="val-block-h">
            <span className="ins-cap">{tx('Same approvals, real outcomes', 'نفس الموافقات، نتائج حقيقية')}</span>
            <span className="faint val-note">{tx('at equal approval volume', 'عند نفس حجم الموافقات')} ({pct0(c.swap_set.approval_rate)})</span>
          </div>
          <div className="mc-swap-head">
            <StatDelta from={`${pct1(c.swap_set.baseline_approved_bad_rate)}`} to={`${pct1(c.swap_set.full_approved_bad_rate)}`} good />
            <span className="mc-swap-cap">{tx('realized default rate in the approved pool', 'معدل التعثّر الفعلي في المقبولين')} · <b>−{pct0(reduction)}</b></span>
          </div>
          <div className="mc-swap">
            <div className="mc-swap-card good">
              <span className="mc-swap-n">{c.swap_set.swap_in_n}</span>
              <span className="mc-swap-t">{tx('rescued by the wallet layer', 'أنقذتهم طبقة المحفظة')}</span>
              <span className="mc-swap-r">{pct1(c.swap_set.swap_in_bad_rate)} {tx('realized default', 'تعثّر فعلي')}</span>
              <span className="mc-swap-x faint">{tx('good borrowers the bureau declined', 'عملاء جيّدون رفضهم المكتب')}</span>
            </div>
            <div className="mc-swap-card bad">
              <span className="mc-swap-n">{c.swap_set.swap_out_n}</span>
              <span className="mc-swap-t">{tx('rejected by the wallet layer', 'رفضتهم طبقة المحفظة')}</span>
              <span className="mc-swap-r">{pct1(c.swap_set.swap_out_bad_rate)} {tx('realized default', 'تعثّر فعلي')}</span>
              <span className="mc-swap-x faint">{tx('risky borrowers the bureau approved', 'عملاء متعثّرون وافق عليهم المكتب')}</span>
            </div>
          </div>
        </div>

        {/* ── CALIBRATION + IV side by side ────────────────────────────── */}
        <div className="mc-two">
          <div className="mc-block">
            <div className="val-block-h">
              <span className="ins-cap">{tx('Calibration', 'المعايرة')}</span>
              <span className="faint val-note">{tx('predicted vs actual — on the diagonal = accurate PD', 'المتوقّع مقابل الفعلي — على القطر = احتمال دقيق')}</span>
            </div>
            <Calib bins={c.calibration.bins} />
            <div className="mc-brier">
              <StatDelta from={`Brier ${c.calibration.brier_baseline.toFixed(3)}`} to={c.calibration.brier_full.toFixed(3)} good />
            </div>
          </div>

          <div className="mc-block">
            <div className="val-block-h">
              <span className="ins-cap">{tx('Feature strength · Information Value', 'قوة الميزات · قيمة المعلومات')}</span>
              <span className="faint val-note">{tx('IV > 0.1 = useful', 'IV > 0.1 = مفيدة')}</span>
            </div>
            <div className="ins-rows">
              {c.information_value.map((f) => {
                const [en, ar] = FEATURE_LABEL[f.name] ?? [f.name, f.name]
                return (
                  <div className="ins-row" key={f.name}>
                    <span className="ins-row-l val-feat">{tx(en, ar)}</span>
                    <span className="ins-row-bar"><span style={{ width: `${Math.max(1.5, (f.iv / maxIv) * 100)}%` }} /></span>
                    <span className="ins-row-v">{f.iv.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── monotonic score bands ────────────────────────────────────── */}
        <div className="mc-block">
          <div className="val-block-h">
            <span className="ins-cap">{tx('Default rate by score band', 'معدل التعثّر حسب شريحة الدرجة')}</span>
            <span className="faint val-note">{tx('monotonic — default falls as the score rises', 'متناقص — التعثّر ينخفض كلما ارتفعت الدرجة')}</span>
          </div>
          <div className="val-bands">
            {c.score_bands.map((b, i) => (
              <div className="val-band" key={b.band}>
                <span className="val-band-v">{pct1(b.rate)}</span>
                <span className="val-bar-wrap">
                  <span className={`val-bar${i === c.score_bands.length - 1 ? ' good' : i === 0 ? ' bad' : ''}`}
                    style={{ height: `${Math.max(2, (b.rate / maxRate) * 100)}%` }} />
                </span>
                <span className="val-band-l">{b.band}</span>
              </div>
            ))}
          </div>
        </div>

        {c.cross_check && <CrossCheck cc={c.cross_check} />}

        {/* trust footnotes */}
        <div className="val-foot">
          <Foot icon="🔒" title={tx('No leakage', 'دون تسريب')} body={tx('Cash-flow features use strictly pre-loan transactions — measured before the outcome exists.', 'تُحسب ميزات التدفق النقدي من معاملات ما قبل القرض فقط — قبل وجود النتيجة.')} />
          <Foot icon="📏" title={tx('Honest statistics', 'إحصاء أمين')} body={tx('Out-of-sample 5-fold CV; the AUC lift carries a bootstrap 95% confidence interval.', 'تحقّق تقاطعي خماسي خارج العينة؛ ولفرق AUC فاصل ثقة ٩٥٪ بالتحميل الذاتي.')} />
          <Foot icon="↻" title={tx('Reproducible', 'قابل للتكرار')} body={tx('Generated by eval/ablation.py on the public Berka data — no login, fixed seed.', 'مُولّد عبر eval/ablation.py على بيانات Berka العامة — دون تسجيل وببذرة ثابتة.')} />
        </div>

        <p className="val-caveat faint">
          {tx(
            `${c.caveats[0]} ${c.caveats[1]} ${c.caveats[2]}`,
            'دُرّب على بيانات Berka / PKDD’99 العامة كأقرب بديل عام يجمع معاملات حقيقية بنتائج تعثّر حقيقية (لا يوجد بديل سعودي مفتوح). «رؤية المكتب» هنا بديل من الخصائص الديموغرافية وبيانات المنطقة عن ملف مكتب ائتماني حقيقي. الوسوم على القروض المموّلة فقط؛ ويضيف الإنتاج استدلال المرفوضين لمعالجة انحياز الاختيار.',
          )}
        </p>
      </div>
    </div>
  )
}

// reliability curve (calibration)
function Calib({ bins }: { bins: { pred: number; obs: number; n: number }[] }) {
  const size = 170, P = 18, span = size - 2 * P
  const X = (v: number) => P + Math.min(1, v) * span
  const Y = (v: number) => size - P - Math.min(1, v) * span
  const path = bins.map((b, i) => `${i ? 'L' : 'M'}${X(b.pred).toFixed(1)} ${Y(b.obs).toFixed(1)}`).join(' ')
  return (
    <svg className="roc" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Calibration curve">
      <rect x={P} y={P} width={span} height={span} className="roc-frame" />
      <line x1={P} y1={size - P} x2={size - P} y2={P} className="roc-diag" />
      <path d={path} className="roc-full show" />
      {bins.map((b, i) => <circle key={i} cx={X(b.pred)} cy={Y(b.obs)} r={2.6} className="calib-dot" />)}
    </svg>
  )
}

function Foot({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="val-f">
      <span className="val-f-h">{icon} {title}</span>
      <span className="val-f-b">{body}</span>
    </div>
  )
}

// ── 3-tier evidence badge (Validity · Scale · Generalization) ────────────────
function LineageStrip({ lineage }: { lineage: Lineage }) {
  const { tx } = useTx()
  return (
    <div className="mc-lineage">
      {lineage.tiers.map((t) => {
        const [en, ar] = TIER_LABEL[t.tier] ?? [t.tier, t.tier]
        return (
          <div className="mc-lin" key={t.tier}>
            <span className="mc-lin-t">{tx(en, ar)}</span>
            <span className="mc-lin-c">{t.claim}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── "Processing at scale": the millions-row synthetic corpus + the TSTR bridge ─
function ScaleSection({ corpus }: { corpus: Corpus }) {
  const { tx } = useTx()
  const maxBad = Math.max(...corpus.segments.map((s) => s.bad_rate))
  return (
    <div className="mc-block mc-scale">
      <div className="val-block-h">
        <span className="ins-cap">{tx('Built to open-banking scale', 'مبنيّ على مقياس المصرفية المفتوحة')}</span>
        <span className="faint val-note">{tx('faithful sample of real behaviour', 'عيّنة أمينة لسلوك حقيقي')} · {corpus.generator}</span>
      </div>

      <div className="mc-scale-nums">
        <div className="mc-scale-n">
          <Num value={corpus.n_synthetic_accounts} format={intFmt} from0 duration={1.1} className="mc-scale-v" />
          <span className="mc-scale-c">{tx('synthetic accounts', 'حساب اصطناعي')}</span>
        </div>
        <div className="mc-scale-n">
          <Num value={corpus.n_transactions_extrapolated} format={intFmt} from0 duration={1.4} className="mc-scale-v" />
          <span className="mc-scale-c">{tx('transactions · extrapolated', 'معاملة · تقديريًا')}</span>
        </div>
        <div className="mc-scale-n">
          <span className="mc-scale-v">{corpus.n_segments}</span>
          <span className="mc-scale-c">{tx('borrower segments', 'شرائح عملاء')}</span>
        </div>
      </div>

      <div className="mc-scale-bridge">
        <StatDelta
          from={`${tx('Real ceiling', 'السقف الحقيقي')} ${corpus.trtr.auc.toFixed(3)}`}
          to={`${tx('Synthetic → Real', 'اصطناعي ← حقيقي')} ${corpus.tstr.auc.toFixed(3)}`}
          good
        />
        <span className="mc-swap-cap">{tx(
          `A model trained only on synthetic data scores ${corpus.tstr.auc.toFixed(2)} on real held-out defaults — ${Math.round(corpus.retention * 100)}% of the real-trained ceiling. The signal is learned, not injected.`,
          `نموذج مُدرَّب على البيانات الاصطناعية فقط يحقّق ${corpus.tstr.auc.toFixed(2)} على تعثّرات حقيقية محجوبة — ${Math.round(corpus.retention * 100)}٪ من السقف الحقيقي. الإشارة مُتعلَّمة لا محقونة.`,
        )}</span>
      </div>

      <div className="mc-seg">
        {corpus.segments.map((s) => {
          const [en, ar] = SEG_LABEL[s.key] ?? [s.label, s.label]
          return (
            <div className="mc-seg-row" key={s.key}>
              <span className="mc-seg-l">{tx(en, ar)}</span>
              <span className="mc-seg-bar">
                <span className={s.key === 'stable_salaried' ? 'good' : ''}
                  style={{ width: `${Math.max(4, (s.bad_rate / maxBad) * 100)}%` }} />
              </span>
              <span className="mc-seg-v">{pct1(s.bad_rate)}</span>
              <span className="mc-seg-n faint">{intFmt(s.n)}</span>
            </div>
          )
        })}
      </div>

      <p className="val-caveat faint">{tx(corpus.methodology, corpus.methodology)}</p>
    </div>
  )
}

// ── "Replicated on a second real dataset": Home Credit cross-check (optional) ──
function CrossCheck({ cc }: { cc: CrossCheck }) {
  const { tx } = useTx()
  return (
    <div className="mc-block">
      <div className="val-block-h">
        <span className="ins-cap">{tx('Replicated on a second real dataset', 'مُكرَّر على مجموعة بيانات حقيقية ثانية')}</span>
        <span className="faint val-note">{cc.dataset}</span>
      </div>
      <div className="mc-swap-head">
        <StatDelta
          from={`${tx('Bureau', 'المكتب')} ${cc.baseline.auc.toFixed(3)}`}
          to={`+ ${tx('Cash-flow', 'التدفق النقدي')} ${cc.full.auc.toFixed(3)}`}
          good
        />
        <span className="mc-swap-cap">+{cc.lift.auc.toFixed(2)} AUC · {cc.n_accounts.toLocaleString('en-US')} {tx('real labeled applications', 'طلب حقيقي موسوم')}</span>
      </div>
      {cc.caveats?.[0] && <p className="val-caveat faint">{cc.caveats[0]}</p>}
    </div>
  )
}
