import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'
import { useTx } from '../../lib/tx'
import { InfoTip } from '../ui/InfoTip'
import card from '../../data/model_card.json'

/**
 * Model-card panel — the on-screen proof for the "Data analysis" criterion.
 * Every number is the real out-of-sample result of eval/ablation.py (+ the
 * harden/saudi_anchor passes) on public data; see model_card.json.
 *
 * DESIGN LAW (restyle 2026-07-04, shadcn-concept):
 *   · white + blue only; flat cards, 1px borders, no gradients/tints
 *   · color is SEMANTIC: green = verified/pass ONLY · red = risk/fail ONLY ·
 *     amber = warning ONLY · blue = data · gray = structure
 *   · one table idiom + unified chips; exactly two charts (ROC, calibration)
 *     and one thin-bar style (IV, deciles) — everything else is numbers
 *   · long method prose lives behind <details> expanders; claims stay one-line
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
  alfabattle?: ThirdCheck | null
  champion_challenger?: ChampionChallenger | null
  lineage?: Lineage
  psi?: Psi
  performance_ledger?: PerformanceLedger
  external_validity?: ExternalValidity
  demonstration_population?: DemoPopulation
}

interface ChampionChallenger {
  dataset: string; n: number
  champion: { name: string; auc: number }
  challenger: { name: string; auc: number }
  gap_auc: number; rank_agreement: number; note: string
}
interface PsiFeature { feature: string; psi: number; status: string }
interface PsiScenario { key: string; label: string; desc: string; max_psi: number; status: string; per_feature: PsiFeature[] }
interface Psi { reference: string; method: string; note: string; scenarios: PsiScenario[] }
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
interface BureauIncremental {
  question: string; baseline_definition: string; flow_definition: string
  baseline: { auc: number; ks: number }; full: { auc: number; ks: number }
  lift: { auc: number; ci_low: number; ci_high: number; p_gt_0: number }
  strict_variant: {
    baseline_definition: string
    baseline: { auc: number }; full: { auc: number }
    lift: { auc: number; ci_low: number; ci_high: number; p_gt_0: number }
  }
  role: string; note: string
}
interface CrossCheck {
  dataset: string; n_accounts: number; n_defaults: number; bad_rate: number
  baseline: { auc: number; ks: number }; full: { auc: number; ks: number }
  lift: { auc: number; ci_low: number; ci_high: number; p_gt_0: number }
  feature_mapping: { tabaqa: string; homecredit: string }[]; caveats: string[]
  attenuation_note?: string
  bureau_incremental?: BureauIncremental | null
}
interface ThirdCheck {
  dataset: string; n_accounts: number; n_defaults: number; bad_rate: number
  n_parts_used: number; n_parts_total: number
  baseline: { label: string; auc: number }; full: { label: string; auc: number }
  lift: { auc: number; ci_low: number; ci_high: number }
  thin_file: { definition: string; n: number; baseline_auc: number; full_auc: number }
  caveats: string[]
}
interface Lineage { tiers: { tier: string; source: string; claim: string }[]; live_scorer: string }
interface LedgerRow {
  value: number; metric: string; headline: boolean
  dataset: string; features: string; model: string; split: string; role: string
}
interface PerformanceLedger { note: string; rows: LedgerRow[] }
interface EvPopulation { key: string; label: string; n: string; role: string; finding: string }
interface ExternalValidity { claim: string; populations: EvPopulation[]; transfers: string; deployment_plan: string[] }
interface DemoPopulation {
  name: string; no_accuracy_claim: boolean; n_accounts: number
  method: string; scale_factor: number
  priors_used: { prior: string; source: string }[]
  income_deciles_sar: { decile: number; sar_month: number }[]
  gosi_wage_bands: { band_sar: string; contributors: number; share: number }[]
  expense_shares: { category: string; share: number }[]
  segments_sar: { segment: string; n: number; bad_rate: number; median_min_balance_sar: number; median_avg_balance_sar: number }[]
  caveats: string[]
}

const c = card as ModelCard

const intFmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`
const pct0 = (x: number) => `${Math.round(x * 100)}%`

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
const FEATURE_LABEL: Record<string, [string, string]> = {
  balance_volatility: ['Balance volatility', 'تقلّب الرصيد'],
  income_regularity: ['Income regularity', 'انتظام الدخل'],
  recurring_obligation_load: ['Obligation load', 'عبء الالتزامات'],
  min_balance: ['Minimum balance', 'أدنى رصيد'],
  income_expense_ratio: ['Income ÷ expense', 'الدخل ÷ المصروف'],
  avg_balance: ['Average balance', 'متوسط الرصيد'],
  nsf_count: ['Overdraft events', 'السحب على المكشوف'],
}

// ── primitives ───────────────────────────────────────────────────────────────
// Chip: THE status idiom. variant encodes meaning — ok=verified/pass, bad=risk/fail,
// warn=warning, default=neutral fact. Nothing else on the page may use these colors.
function Chip({ variant = '', children }: { variant?: '' | 'ok' | 'warn' | 'bad'; children: React.ReactNode }) {
  return <span className={`chip${variant ? ` ${variant}` : ''}`}>{variant === 'ok' ? '✓ ' : ''}{children}</span>
}

function Num({
  value, digits = 3, className, format, from0 = false, duration = 0.6,
}: {
  value: number; digits?: number; className?: string
  format?: (n: number) => string; from0?: boolean; duration?: number
}) {
  const [d, setD] = useState(from0 ? 0 : value)
  const from = useRef(from0 ? 0 : value)
  useEffect(() => {
    const ctrl = animate(from.current, value, { duration, ease: 'easeOut', onUpdate: (v) => setD(v) })
    from.current = value
    return () => ctrl.stop()
  }, [value, duration])
  return <span className={className}>{format ? format(d) : d.toFixed(digits)}</span>
}

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
      <rect x={P} y={P} width={span} height={span} className="roc-frame" />
      <line x1={P} y1={size - P} x2={size - P} y2={P} className="roc-diag" />
      <path d={d(baseline)} className="roc-base" />
      <path key={showFull ? 'on' : 'off'} d={d(full)} className={`roc-full${showFull ? ' show' : ''}`}
        style={{ transition: 'opacity .4s ease' }} />
      <text x={size / 2} y={size - 4} className="roc-ax">False positives →</text>
      <text x={4} y={P - 6} className="roc-ax">True positives ↑</text>
    </svg>
  )
}

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

function StatDelta({ from, to, good }: { from: string; to: string; good: boolean }) {
  return (
    <span className="mc-delta-row">
      <span className="mc-from">{from}</span>
      <span className={`mc-arrow ${good ? 'good' : 'bad'}`}>→</span>
      <span className={`mc-to ${good ? 'good' : 'bad'}`}>{to}</span>
    </span>
  )
}

// one-line claim stays visible; method prose folds away
function Method({ label, children }: { label?: string; children: React.ReactNode }) {
  const { tx } = useTx()
  return (
    <details className="mv-details">
      <summary>{label ?? tx('Method & caveats', 'المنهجية والمحاذير')}</summary>
      <div className="mv-details-body">{children}</div>
    </details>
  )
}

function SectionHead({ en, ar, note }: { en: string; ar: string; note?: React.ReactNode }) {
  const { tx } = useTx()
  return (
    <div className="val-block-h">
      <span className="ins-cap">{tx(en, ar)}</span>
      {note && <span className="faint val-note">{note}</span>}
    </div>
  )
}

// ── the panel ────────────────────────────────────────────────────────────────
type TabKey = 'perf' | 'repl' | 'saudi' | 'gov'

export function ModelCardPanel() {
  const { tx } = useTx()
  const [tab, setTab] = useState<TabKey>('perf')

  const TABS: { key: TabKey; en: string; ar: string }[] = [
    { key: 'perf', en: 'Performance', ar: 'الأداء' },
    { key: 'repl', en: 'Replication', ar: 'التكرار' },
    { key: 'saudi', en: 'Saudi population', ar: 'العيّنة السعودية' },
    { key: 'gov', en: 'Governance', ar: 'الحوكمة' },
  ]

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
              <h3>{tx('Model validation', 'التحقق من النموذج')}</h3>
              <span className="ins-sub faint">{tx(
                'Real out-of-sample results on real default outcomes — nothing on this page pretends.',
                'نتائج حقيقية خارج العينة على تعثّرات حقيقية — لا شيء في هذه الصفحة يتظاهر.',
              )}</span>
            </div>
          </div>
          <Chip variant="ok">{tx('Real data', 'بيانات حقيقية')} · <span dir="ltr">Berka {intFmt(c.n_accounts)} · {pct1(c.bad_rate)}</span> {tx('default', 'تعثّر')}<InfoTip k="bad_rate" /></Chip>
        </div>

        {/* ── the 30-second layer: what a skimming judge must walk away with ── */}
        <div className="mv-lede">
          <p>{tx(
            'The Tabaqa score predicts real loan defaults. It was proven on real default outcomes in two different countries, and it is re-calibrated on each lender’s own portfolio at go-live.',
            'درجة طبقة تتنبأ بالتعثّر الفعلي عن السداد. أُثبتت على نتائج تعثّر حقيقية في بلدين مختلفين، وتُعاير على محفظة كل مموِّل عند الإطلاق.',
          )}</p>
        </div>

        {/* ── KPI row: the four numbers that matter, always visible ────── */}
        <div className="kpi-grid">
          <div className="kpi-card hot">
            <span className="kpi-label">{tx('Out-of-sample AUC', 'AUC خارج العينة')}<InfoTip k="auc" /></span>
            <span className="kpi-value" dir="ltr">{c.full.auc.toFixed(3)}</span>
            <Chip variant="ok"><span dir="ltr">+{c.lift.auc.toFixed(2)}</span> {tx('vs bureau', 'مقابل المكتب')}</Chip>
            <span className="kpi-cap">{tx('5-fold CV · 95% CI excludes zero', 'تحقّق خماسي · فاصل الثقة لا يشمل الصفر')}<InfoTip k="ci" /></span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">{tx('Thin-file lift', 'رفع محدودي السجل')}<InfoTip k="thin_file" /></span>
            <span className="kpi-value" dir="ltr">{c.thin_file.baseline_auc.toFixed(2)}→{c.thin_file.full_auc.toFixed(2)}</span>
            <span className="kpi-cap">{tx('where the bureau is nearly blind', 'حيث يكاد المكتب لا يرى')}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">{tx('Replication', 'التكرار')}<InfoTip k="lift" /></span>
            <span className="kpi-value" dir="ltr">+{(c.cross_check?.lift.auc ?? 0).toFixed(3)}</span>
            <span className="kpi-cap">{tx('UCI Taiwan · 30,000 real accounts', 'تايوان UCI · ٣٠ ألف حساب حقيقي')}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">{tx('Synthesizer fidelity', 'أمانة المولِّد')}<InfoTip k="tstr" /></span>
            <span className="kpi-value" dir="ltr">{pct0(c.corpus?.retention ?? 0)}</span>
            <span className="kpi-cap">{tx('train-synthetic → test-real', 'تدريب اصطناعي ← اختبار حقيقي')}</span>
          </div>
        </div>

        {/* ── tabs ─────────────────────────────────────────────────────── */}
        <div className="mv-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key}
              className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
              {tx(t.en, t.ar)}
            </button>
          ))}
        </div>

        {tab === 'perf' && <PerformanceTab />}
        {tab === 'repl' && <ReplicationTab />}
        {tab === 'saudi' && <SaudiTab />}
        {tab === 'gov' && <GovernanceTab />}
      </div>
    </div>
  )
}

// ── ① Performance ────────────────────────────────────────────────────────────
function PerformanceTab() {
  const { tx } = useTx()
  const [walletOn, setWalletOn] = useState(true)
  const cur = walletOn ? c.full : c.baseline
  const maxIv = Math.max(...c.information_value.map((f) => f.iv))
  const maxRate = Math.max(...c.score_bands.map((b) => b.rate))
  const reduction = (c.swap_set.baseline_approved_bad_rate - c.swap_set.full_approved_bad_rate) /
    c.swap_set.baseline_approved_bad_rate

  return (
    <>
      {/* hero: the ablation toggle — the page's one big chart */}
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
            <span className="mc-lift-v" dir="ltr">+<Num value={c.lift.auc} /> AUC</span>
            <span className="mc-lift-sub">
              {tx('95% CI', 'فاصل ثقة ٩٥٪')} <span dir="ltr">+{c.lift.ci_low.toFixed(2)}…+{c.lift.ci_high.toFixed(2)}</span> ·{' '}
              {tx('significant in', 'دالّ في')} <span dir="ltr">{pct0(c.lift.p_gt_0)}</span> {tx('of bootstraps', 'من العيّنات')}
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
            <span><i className="dot base" /> {tx('Bureau', 'المكتب')} <span dir="ltr">{c.baseline.auc.toFixed(2)}</span></span>
            <span className={walletOn ? '' : 'off'}><i className="dot full" /> {tx('+ Wallet', '+ المحفظة')} <span dir="ltr">{c.full.auc.toFixed(2)}</span></span>
          </div>
        </div>
      </div>
      <p className="mc-read faint">{tx(
        `Same ${intFmt(c.n_accounts)} accounts, same folds — the only change is adding the 7 cash-flow features.`,
        `نفس ${intFmt(c.n_accounts)} حسابًا — الفرق الوحيد هو إضافة ميزات التدفق النقدي السبع.`,
      )}</p>

      {/* thin-file */}
      <div className="mc-block">
        <SectionHead en="Thin-file borrowers — where the bureau is blind" ar="العملاء محدودو السجل — حيث يعجز المكتب"
          note={<>{c.thin_file.n} {tx('accounts', 'حسابًا')} · <span dir="ltr">{c.thin_file.definition}</span></>} />
        <div className="mc-thin">
          <div className="mc-thin-nums">
            <StatDelta from={`${tx('Bureau', 'المكتب')} ${c.thin_file.baseline_auc.toFixed(3)}`} to={`+ ${tx('Wallet', 'المحفظة')} ${c.thin_file.full_auc.toFixed(3)}`} good />
            <p className="faint">{tx(
              `On the thinnest-history third of the book the bureau scores ${c.thin_file.baseline_auc.toFixed(2)} — barely above a coin-flip. The wallet layer lifts it to ${c.thin_file.full_auc.toFixed(2)}.`,
              `على الثلث الأقل سجلًّا يحقّق المكتب ${c.thin_file.baseline_auc.toFixed(2)} — بالكاد أفضل من العشوائية. طبقة المحفظة ترفعه إلى ${c.thin_file.full_auc.toFixed(2)}.`,
            )}</p>
          </div>
          <Roc baseline={c.thin_file.baseline_roc} full={c.thin_file.full_roc} showFull size={170} />
        </div>
      </div>

      {/* swap-set: flat cards, semantic chips only */}
      <div className="mc-block">
        <SectionHead en="Same approvals, real outcomes" ar="نفس الموافقات، نتائج حقيقية"
          note={<>{tx('at equal approval volume', 'عند نفس حجم الموافقات')} ({pct0(c.swap_set.approval_rate)})</>} />
        <div className="mc-swap-head">
          <StatDelta from={pct1(c.swap_set.baseline_approved_bad_rate)} to={pct1(c.swap_set.full_approved_bad_rate)} good />
          <span className="mc-swap-cap">{tx('realized default rate in the approved pool', 'معدل التعثّر الفعلي في المقبولين')} · <b dir="ltr">−{pct0(reduction)}</b><InfoTip k="swap_set" /></span>
        </div>
        <div className="mc-swap">
          <div className="mc-swap-card">
            <span className="mc-swap-n">{c.swap_set.swap_in_n}</span>
            <span className="mc-swap-t">{tx('rescued by the wallet layer', 'أنقذتهم طبقة المحفظة')}</span>
            <Chip variant="ok">{pct1(c.swap_set.swap_in_bad_rate)} {tx('realized default', 'تعثّر فعلي')}</Chip>
            <span className="mc-swap-x faint">{tx('good borrowers the bureau declined', 'عملاء جيّدون رفضهم المكتب')}</span>
          </div>
          <div className="mc-swap-card">
            <span className="mc-swap-n">{c.swap_set.swap_out_n}</span>
            <span className="mc-swap-t">{tx('rejected by the wallet layer', 'رفضتهم طبقة المحفظة')}</span>
            <Chip variant="bad">{pct1(c.swap_set.swap_out_bad_rate)} {tx('realized default', 'تعثّر فعلي')}</Chip>
            <span className="mc-swap-x faint">{tx('risky borrowers the bureau approved', 'عملاء متعثّرون وافق عليهم المكتب')}</span>
          </div>
        </div>
      </div>

      {/* calibration + IV: the calibration chart + the one thin-bar idiom */}
      <div className="mc-two">
        <div className="mc-block">
          <SectionHead en="Calibration" ar="المعايرة"
            note={tx('on the diagonal = accurate PD', 'على القطر = احتمال دقيق')} />
          <Calib bins={c.calibration.bins} />
          <div className="mc-brier">
            <StatDelta from={`Brier ${c.calibration.brier_baseline.toFixed(3)}`} to={c.calibration.brier_full.toFixed(3)} good />
          </div>
        </div>
        <div className="mc-block">
          <SectionHead en="Feature strength · Information Value" ar="قوة الميزات · قيمة المعلومات"
            note={<>{tx('IV > 0.1 = useful', 'IV > 0.1 = مفيدة')}<InfoTip k="iv" /></>} />
          <div className="ins-rows">
            {c.information_value.map((f) => {
              const [en, ar] = FEATURE_LABEL[f.name] ?? [f.name, f.name]
              return (
                <div className="ins-row" key={f.name}>
                  <span className="ins-row-l val-feat">{tx(en, ar)}</span>
                  <span className="ins-row-bar"><span style={{ width: `${Math.max(1.5, (f.iv / maxIv) * 100)}%` }} /></span>
                  <span className="ins-row-v" dir="ltr">{f.iv.toFixed(2)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* score bands: all-blue — monotonicity needs no red */}
      <div className="mc-block">
        <SectionHead en="Default rate by score band" ar="معدل التعثّر حسب شريحة الدرجة"
          note={tx('monotonic — default falls as the score rises', 'متناقص — التعثّر ينخفض كلما ارتفعت الدرجة')} />
        <div className="val-bands">
          {c.score_bands.map((b) => (
            <div className="val-band" key={b.band}>
              <span className="val-band-v" dir="ltr">{pct1(b.rate)}</span>
              <span className="val-bar-wrap">
                <span className="val-bar" style={{ height: `${Math.max(2, (b.rate / maxRate) * 100)}%` }} />
              </span>
              <span className="val-band-l">{b.band}</span>
            </div>
          ))}
        </div>
      </div>

      <TrustFoot />
    </>
  )
}

// ── ② Replication ────────────────────────────────────────────────────────────
function ReplicationTab() {
  const { tx } = useTx()
  const cc = c.cross_check
  const ac = c.alfabattle
  const ch = c.champion_challenger
  const ev = c.external_validity
  return (
    <>
      {cc && (
        <div className="mc-block first">
          <SectionHead en="Replicated on a second real dataset" ar="مُكرَّر على مجموعة بيانات حقيقية ثانية" note={cc.dataset} />
          <div className="mc-swap-head">
            <StatDelta from={`${tx('App-only', 'الطلب فقط')} ${cc.baseline.auc.toFixed(3)}`} to={`+ ${tx('Cash-flow', 'التدفق النقدي')} ${cc.full.auc.toFixed(3)}`} good />
            <span className="mc-swap-cap"><span dir="ltr">+{cc.lift.auc.toFixed(2)} AUC · {intFmt(cc.n_accounts)}</span> {tx('real labeled applications', 'طلب حقيقي موسوم')} · {tx('vs the application-only view — a no-file applicant’s real baseline', 'مقابل رؤية الطلب فقط — خط الأساس الفعلي لمن لا سجل له')}</span>
          </div>
          {/* P4 — the attenuation, stated before anyone asks (stays visible, never folded) */}
          {cc.attenuation_note && <p className="mv-claim">{cc.attenuation_note}</p>}
          <Method>{cc.caveats?.[0]}</Method>
        </div>
      )}

      {cc?.bureau_incremental && (
        <div className="mc-block">
          <SectionHead en="The negative control — we asked the bureau question ourselves" ar="الضابط السلبي — طرحنا سؤال المكتب على أنفسنا"
            note={tx('what if the baseline already sees the delinquency history?', 'ماذا لو كان خط الأساس يرى سجلّ التأخر أصلًا؟')} />
          <div className="mc-swap-head">
            <span className="mc-delta-row">
              <span className="mc-from">{tx('Bureau-like', 'شبيه المكتب')} {cc.bureau_incremental.baseline.auc.toFixed(3)}</span>
              <span className="mc-arrow">→</span>
              <span className="mc-to">+ {tx('Amount dynamics', 'ديناميكا المبالغ')} {cc.bureau_incremental.full.auc.toFixed(3)}</span>
            </span>
            <span className="mc-swap-cap"><span dir="ltr">{cc.bureau_incremental.lift.auc >= 0 ? '+' : ''}{cc.bureau_incremental.lift.auc.toFixed(3)} AUC</span> — {tx('zero, and that is the point', 'صفر، وهذا هو المقصود')}<InfoTip k="negative_control" /></span>
          </div>
          <p className="mv-claim">
            {tx(
              'On single-source data (every feature from the same card account a bureau sees) the ablation finds nothing — proof the machinery doesn’t manufacture lift. Bureau-incremental lift needs a second data source: that is Berka (+0.203, checking-account cash-flow over a credit-file baseline) and, against real bureau scores, the independent literature: BIS 0.76 vs 0.64, FinRegLab.',
              'على بيانات من مصدر واحد (كل الميزات من حساب البطاقة نفسه الذي يراه المكتب) لا تجد المنهجية شيئًا — دليل أنها لا تُصنّع رفعًا من العدم. الرفع فوق المكتب يتطلب مصدر بيانات ثانيًا: وهذا هو Berka ‏(+0.203، تدفق الحساب الجاري فوق خط أساس الملف الائتماني)، وأمام درجات مكاتب حقيقية: أدبيات مستقلة — بنك التسويات الدولية 0.76 مقابل 0.64، وFinRegLab.',
            )}
          </p>
          <Method>{cc.bureau_incremental.note}</Method>
        </div>
      )}

      {ac && (
        <div className="mc-block">
          <SectionHead en="…and a third real population — at scale" ar="…وعلى مجتمع حقيقي ثالث — وبالحجم"
            note={<>{ac.dataset} · {tx(`first ${ac.n_parts_used} of ${ac.n_parts_total} public parts`, `أول ${ac.n_parts_used} من ${ac.n_parts_total} جزءًا عامًا`)}</>} />
          <div className="mc-swap-head">
            <StatDelta from={`${tx('App-only', 'الطلب فقط')} ${ac.baseline.auc.toFixed(3)}`} to={`+ ${tx('Behaviour', 'السلوك')} ${ac.full.auc.toFixed(3)}`} good />
            <span className="mc-swap-cap"><span dir="ltr">+{ac.lift.auc.toFixed(2)} AUC · {intFmt(ac.n_accounts)}</span> {tx('real labeled applications', 'طلب حقيقي موسوم')} · <span dir="ltr">{intFmt(ac.n_defaults)}</span> {tx('real defaults', 'تعثّر حقيقي')}</span>
          </div>
          <p className="mv-claim">
            {(() => {
              const series = `+${c.lift.auc.toFixed(3)} → +${(cc?.lift.auc ?? 0).toFixed(3)} → +${ac.lift.auc.toFixed(3)}`
              return tx(
                `Three real populations, three decades, three scales — the behaviour lift is always positive and always significant: ${series}. Each answers the one question it is identified to answer: Berka isolates the mechanism (two independent sources — cash-flow over a credit-file view), UCI is the falsification test (zero when single-source — the negative control above), AlfaBattle proves scoreability at production scale. The variation across populations is the honest finding, not a footnote.`,
                `ثلاثة مجتمعات حقيقية، عبر ثلاثة عقود وثلاثة أحجام — رفعُ السلوك موجبٌ ودالٌّ إحصائيًا دائمًا: ‎${series.replace(/→/g, '←')}‎. وكلٌّ منها يجيب عن السؤال الوحيد الذي صُمّم للإجابة عنه: Berka يعزل الآلية (مصدران مستقلان — التدفق النقدي فوق رؤية الملف الائتماني)، وUCI هو اختبار الدحض (صفر عند المصدر الواحد — الضابط السلبي أعلاه)، وAlfaBattle يثبت قابلية التسجيل على نطاق الإنتاج. والتفاوت عبر المجتمعات هو النتيجة الصادقة، لا هامشًا.`,
              )
            })()}
          </p>
          <Method>{ac.caveats?.[1] ?? ac.caveats?.[0]}</Method>
        </div>
      )}

      {ch && (
        <div className="mc-block">
          <SectionHead en="Transparency has no accuracy cost" ar="الشفافية دون كلفة في الدقة"
            note={<>{ch.dataset} · {intFmt(ch.n)} {tx('real accounts', 'حساب حقيقي')}</>} />
          <div className="mvt">
            <div className="mvt-row">
              <span className="mvt-num" dir="ltr">{ch.champion.auc.toFixed(3)}</span>
              <span className="mvt-main">{tx('Transparent scorecard', 'بطاقة تسجيل شفافة')} <span className="faint">{tx('(the family Tabaqa deploys — re-fit here)', '(العائلة التي تنشرها Tabaqa — أعيد تدريبها هنا)')}</span></span>
            </div>
            <div className="mvt-row">
              <span className="mvt-num" dir="ltr">{ch.challenger.auc.toFixed(3)}</span>
              <span className="mvt-main">{tx('Gradient-boosted black box', 'صندوق أسود معزّز')}</span>
            </div>
          </div>
          <p className="mv-claim">
            {tx('AUC gap', 'فارق AUC')} <b dir="ltr">{ch.gap_auc.toFixed(3)}</b> · {tx('rank agreement', 'توافق الترتيب')} <b dir="ltr">ρ {ch.rank_agreement.toFixed(2)}</b>
          </p>
          <Method>{ch.note}</Method>
        </div>
      )}

      {ev && (
        <div className="mc-block">
          <SectionHead en="External validity — stated, not discovered" ar="الصلاحية الخارجية — نُصرّح بها قبل أن تُكتشف"
            note={tx('what transfers, what is re-fit locally', 'ما ينتقل وما يُعاد تدريبه محليًا')} />
          <p className="mv-claim">{ev.claim}</p>
          <div className="ev-grid">
            {ev.populations.map((p) => (
              <div className="ev-card" key={p.key}>
                <span className="ev-title">{p.label}</span>
                {p.key === 'saudi'
                  ? <Chip>{tx('Calibrated on the bank’s book at go-live', 'تُعاير على بيانات البنك عند الإطلاق')}</Chip>
                  : <Chip variant="ok">{p.key === 'berka' ? tx('Primary validation', 'التحقق الأساسي') : tx('Independent replication', 'تكرار مستقل')}</Chip>}
                <span className="ev-n faint">{p.n}</span>
                <span className="ev-finding">{p.finding}</span>
              </div>
            ))}
          </div>
          <Method label={tx('What transfers + the deployment plan', 'ما ينتقل + خطة النشر')}>
            <p>{ev.transfers}</p>
            <ol className="mv-plan">
              {ev.deployment_plan.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </Method>
        </div>
      )}
    </>
  )
}

// ── ③ Saudi population ───────────────────────────────────────────────────────
function SaudiTab() {
  const { tx } = useTx()
  const corpus = c.corpus
  const dp = c.demonstration_population
  const maxDecile = dp ? Math.max(...dp.income_deciles_sar.map((d) => d.sar_month)) : 1
  const sar = (v: number) => `${tx('SAR', 'ر.س')} ${intFmt(v)}`
  return (
    <>
      {corpus && (
        <div className="mc-block first">
          <SectionHead en="Built to open-banking scale" ar="مبنيّ على مقياس المصرفية المفتوحة" note={corpus.generator} />
          <div className="kpi-grid three">
            <div className="kpi-card">
              <span className="kpi-label">{tx('Synthetic accounts', 'حسابات اصطناعية')}</span>
              <Num value={corpus.n_synthetic_accounts} format={intFmt} from0 duration={1.1} className="kpi-value" />
            </div>
            <div className="kpi-card">
              <span className="kpi-label">{tx('Transactions · extrapolated', 'معاملات · تقديريًا')}</span>
              <Num value={corpus.n_transactions_extrapolated} format={intFmt} from0 duration={1.4} className="kpi-value" />
            </div>
            <div className="kpi-card">
              <span className="kpi-label">{tx('Synthetic → real AUC', 'اصطناعي ← حقيقي AUC')}</span>
              <span className="kpi-value" dir="ltr">{corpus.tstr.auc.toFixed(2)}</span>
              <span className="kpi-cap">{tx(`${pct0(corpus.retention)} of the real-trained ceiling ${corpus.trtr.auc.toFixed(2)}`, `${pct0(corpus.retention)} من السقف الحقيقي ${corpus.trtr.auc.toFixed(2)}`)}</span>
            </div>
          </div>
          <p className="mv-claim">{tx(
            'A model trained only on synthetic data still ranks real held-out defaults — the signal is learned, not injected.',
            'نموذج مُدرَّب على البيانات الاصطناعية فقط لا يزال يرتّب تعثّرات حقيقية محجوبة — الإشارة مُتعلَّمة لا محقونة.',
          )}</p>
          <Method>{corpus.methodology}</Method>
        </div>
      )}

      {dp && (
        <div className="mc-block">
          <SectionHead en="Saudi demonstration population — scale anchored, shape disclosed" ar="عيّنة العرض السعودية — المقياس مُثبّت والشكل مُفصح عنه"
            note={<>{intFmt(dp.n_accounts)} {tx('accounts · SAR', 'حساب · ريال')}</>} />
          <div className="mv-chiprow">
            <Chip variant="ok">{tx('Every prior cited', 'كل مرجع مُوثّق')}</Chip>
            <Chip variant="ok">{tx('No accuracy claims', 'دون ادعاءات دقة')}</Chip>
            <Chip>{tx('One scale factor', 'معامل واحد')} ×{dp.scale_factor}</Chip>
          </div>

          <SectionHead en="Saudi income deciles" ar="أعشار الدخل السعودية"
            note={tx('GASTAT HIES cube 2024 · SAR/month', 'الهيئة العامة للإحصاء ٢٠٢٤ · ر.س/شهر')} />
          <div className="val-bands short">
            {dp.income_deciles_sar.map((d) => (
              <div className="val-band" key={d.decile}>
                <span className="val-band-v" dir="ltr">{d.sar_month >= 10000 ? `${Math.round(d.sar_month / 1000)}k` : intFmt(d.sar_month)}</span>
                <span className="val-bar-wrap">
                  <span className="val-bar" style={{ height: `${Math.max(2, (d.sar_month / maxDecile) * 100)}%` }} />
                </span>
                <span className="val-band-l">D{d.decile}</span>
              </div>
            ))}
          </div>

          <div className="mvt">
            {dp.segments_sar.map((s) => {
              const [en, ar] = SEG_LABEL[s.segment] ?? [s.segment, s.segment]
              return (
                <div className="mvt-row" key={s.segment}>
                  <span className="mvt-num" dir="ltr">{sar(s.median_avg_balance_sar)}</span>
                  <span className="mvt-main">{tx(en, ar)} <span className="faint">· {tx('median balance', 'وسيط الرصيد')} · {intFmt(s.n)}</span></span>
                </div>
              )
            })}
          </div>

          <Method label={tx('Priors & sources', 'المراجع والمصادر')}>
            <div className="mvt tight">
              {dp.priors_used.map((p, i) => (
                <div className="mvt-row" key={i}>
                  <span className="mvt-main">{p.prior}<span className="faint block">{p.source}</span></span>
                </div>
              ))}
            </div>
            <p>{dp.method}</p>
            <p>{dp.caveats[0]}</p>
          </Method>
        </div>
      )}
    </>
  )
}

// ── ④ Governance ─────────────────────────────────────────────────────────────
function GovernanceTab() {
  const { tx } = useTx()
  const lineage = c.lineage
  const psi = c.psi
  const ledger = c.performance_ledger
  const statusChip = (st: string) =>
    st === 'stable' ? <Chip variant="ok">{tx('stable', 'مستقر')}</Chip>
      : st === 'shift' ? <Chip variant="warn">{tx('shift', 'انزياح')}</Chip>
        : <Chip variant="bad">{tx('significant', 'كبير')}</Chip>

  return (
    <>
      {lineage && (
        <div className="mc-block first">
          <SectionHead en="Evidence lineage" ar="سلسلة الأدلة" note={tx('every claim, one source', 'لكل ادعاء مصدر واحد')} />
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
          <Method label={tx('What the live score is (and is not)', 'ما هي الدرجة الحيّة (وما ليست)')}>
            {lineage.live_scorer}
          </Method>
        </div>
      )}

      {psi && (
        <div className="mc-block">
          <SectionHead en="Population stability — drift-monitor demonstration" ar="استقرار التوزيع — عرض مراقب الانزياح" note={<>{psi.method}<InfoTip k="psi" /></>} />
          <div className="drift-scroll">
          <div className="drift-grid" style={{ gridTemplateColumns: `1.4fr repeat(${psi.scenarios.length}, 1fr)` }}>
            <span className="drift-h" />
            {psi.scenarios.map((s) => (
              <span className="drift-h" key={s.key}>{s.label}<span className="drift-h-desc faint">{s.desc}</span></span>
            ))}
            {(psi.scenarios[0]?.per_feature.map((f) => f.feature) ?? []).map((feat) => {
              const [en, ar] = FEATURE_LABEL[feat] ?? [feat, feat]
              const cell = (s: PsiScenario) => s.per_feature.find((f) => f.feature === feat)
              return (
                <div key={feat} style={{ display: 'contents' }}>
                  <span className="drift-feat">{tx(en, ar)}</span>
                  {psi.scenarios.map((s) => {
                    const c2 = cell(s)
                    return (
                      <span className="drift-cell flat" key={s.key}>
                        <b dir="ltr">{c2?.psi.toFixed(2)}</b>
                        {statusChip(c2?.status ?? 'stable')}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
          </div>
          <Method>{psi.note}</Method>
        </div>
      )}

      {ledger && (
        <div className="mc-block">
          <SectionHead en="Performance ledger — one headline, every number tagged" ar="سجل الأداء — رقم رئيسي واحد، وكل رقم موسوم"
            note={tx('no number soup', 'لا حساء أرقام')} />
          <div className="mvt">
            {ledger.rows.map((r, i) => (
              <div className={`mvt-row${r.headline ? ' headline' : ''}`} key={i}>
                <span className="mvt-num" dir="ltr">{r.headline ? '★ ' : ''}{r.value.toFixed(3)}</span>
                <span className="mvt-main">
                  {r.dataset} · {r.features} · {r.model} · {r.split}
                  <span className="faint block">{r.role}</span>
                </span>
              </div>
            ))}
          </div>
          <Method>{ledger.note}</Method>
        </div>
      )}

      <div className="mc-block">
        <SectionHead en="Caveats — stated in full" ar="المحاذير — كاملة" />
        <Method label={tx('Read the caveats', 'اقرأ المحاذير')}>
          {c.caveats.map((cv, i) => <p key={i}>{cv}</p>)}
        </Method>
      </div>

      <TrustFoot />
    </>
  )
}

function TrustFoot() {
  const { tx } = useTx()
  return (
    <div className="val-foot">
      <Foot icon="🔒" title={tx('No leakage', 'دون تسريب')} body={tx('Cash-flow features use strictly pre-loan transactions — measured before the outcome exists.', 'تُحسب ميزات التدفق النقدي من معاملات ما قبل القرض فقط — قبل وجود النتيجة.')} />
      <Foot icon="📏" title={tx('Honest statistics', 'إحصاء أمين')} body={tx('Out-of-sample 5-fold CV; the AUC lift carries a bootstrap 95% confidence interval.', 'تحقّق تقاطعي خماسي خارج العينة؛ ولفرق AUC فاصل ثقة ٩٥٪ بالتحميل الذاتي.')} />
      <Foot icon="↻" title={tx('Reproducible', 'قابل للتكرار')} body={tx('Generated by eval/ablation.py on the public Berka data — no login, fixed seed.', 'مُولّد عبر eval/ablation.py على بيانات Berka العامة — دون تسجيل وببذرة ثابتة.')} />
    </div>
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
