// Scale Explorer — the 1,000,000-account corpus, browsable. Slide from 1 to 1M:
// portfolio stats recompute analytically for the selected N, and ANY individual
// applicant inside it can be inspected (deterministically derived from their
// index — applicant #550,000 is always the same person, engine-decided by the
// same §20-style rules). Sits below ModelCardPanel: the card proves the score,
// this makes the scale claim something a judge can touch.

import { useMemo, useState } from 'react'
import { useTx } from '../../lib/tx'
import {
  CORPUS_TOTAL, applicantAt, portfolioFor,
  SEGMENT_AR, SEGMENT_EN, type CorpusApplicant,
} from '../../lib/corpusExplorer'

const fmtN = (n: number) => Math.round(n).toLocaleString('en-US')
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`

const PRESETS = [1, 1_000, 50_000, 550_000, CORPUS_TOTAL]

/** slider is log-scale: v ∈ [0, 600] ↦ 10^(v/100) ∈ [1, 1M] */
const toN = (v: number) => Math.min(CORPUS_TOTAL, Math.round(Math.pow(10, v / 100)))
const toV = (n: number) => Math.round(Math.log10(Math.max(1, n)) * 100)

const SEG_COLORS: Record<string, string> = {
  thin_file: '#8b5cf6',
  high_obligation: '#f59e0b',
  irregular_income: '#06b6d4',
  stable_salaried: '#10b981',
}

export function ScaleExplorer() {
  const { tx, lang } = useTx()
  const [n, setN] = useState(550_000)
  const [idxRaw, setIdxRaw] = useState(550_000)

  const idx = Math.max(1, Math.min(idxRaw, n))
  const p = useMemo(() => portfolioFor(n), [n])
  const a = useMemo(() => applicantAt(idx), [idx])

  const straightThrough = (p.approved + p.declined) / Math.max(1, p.n)
  const segName = (key: string) => (lang === 'ar' ? SEGMENT_AR[key] : SEGMENT_EN[key])

  return (
    <section className="scx">
      <header className="scx-head">
        <h3>{tx('Explore the portfolio — 1 to 1,000,000', 'استكشف المحفظة — من ١ إلى ١,٠٠٠,٠٠٠')}</h3>
        <p>
          {tx(
            'Pick any portfolio size. Stats recompute from the corpus’ real segment mix; every applicant inside is individually inspectable and engine-decided.',
            'اختر أي حجم للمحفظة. الإحصاءات تُحسب من التركيبة الفعلية للمجتمع الاصطناعي، وكل عميل بداخلها قابل للفحص فرديًا — والقرار من المحرك نفسه.',
          )}
        </p>
      </header>

      {/* ── size control ── */}
      <div className="scx-ctl">
        <input
          type="range" min={0} max={600} value={toV(n)} dir="ltr"
          onChange={(e) => { const v = toN(Number(e.target.value)); setN(v); setIdxRaw((i) => Math.min(i, v)) }}
          aria-label={tx('Portfolio size', 'حجم المحفظة')}
        />
        <div className="scx-ctl-row">
          <input
            className="scx-num" type="number" dir="ltr" min={1} max={CORPUS_TOTAL} value={n}
            onChange={(e) => {
              const v = Math.max(1, Math.min(CORPUS_TOTAL, Number(e.target.value) || 1))
              setN(v); setIdxRaw((i) => Math.min(i, v))
            }}
          />
          <div className="scx-presets">
            {PRESETS.map((v) => (
              <button key={v} className={`scx-chip${n === v ? ' on' : ''}`} onClick={() => { setN(v); setIdxRaw(v) }} dir="ltr">
                {fmtN(v)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── portfolio stats ── */}
      <div className="scx-stats">
        <Stat label={tx('Applications', 'الطلبات')} value={fmtN(p.n)} />
        <Stat label={tx('Auto-approved', 'موافقة تلقائية')} value={fmtN(p.approved)} cap={pct1(p.approved / Math.max(1, p.n))} tone="ok" />
        <Stat label={tx('Auto-declined', 'رفض تلقائي')} value={fmtN(p.declined)} cap={pct1(p.declined / Math.max(1, p.n))} tone="bad" />
        <Stat label={tx('Manual review', 'مراجعة يدوية')} value={fmtN(p.review)} cap={pct1(p.review / Math.max(1, p.n))} tone="warn" />
        <Stat label={tx('Straight-through', 'معالجة مباشرة')} value={pct1(straightThrough)} cap={tx('no human touch', 'دون تدخل بشري')} tone="ok" />
        <Stat
          label={tx('Approved volume', 'حجم التمويل المعتمد')}
          value={p.approvedVolume >= 1e9 ? `${(p.approvedVolume / 1e9).toFixed(1)} ${tx('bn', 'مليار')}` : fmtN(p.approvedVolume)}
          cap={tx('SAR', 'ر.س')}
        />
      </div>

      {/* ── segment composition ── */}
      <div className="scx-bar" dir="ltr">
        {p.segments.map(({ segment, count }) => (
          <span
            key={segment.key}
            style={{ width: `${segment.share * 100}%`, background: SEG_COLORS[segment.key] }}
            title={`${segName(segment.key)} — ${fmtN(count)}`}
          />
        ))}
      </div>
      <div className="scx-legend">
        {p.segments.map(({ segment, count }) => (
          <span key={segment.key} className="scx-leg">
            <i style={{ background: SEG_COLORS[segment.key] }} />
            {segName(segment.key)} · <b dir="ltr">{fmtN(count)}</b>
          </span>
        ))}
      </div>

      {/* ── individual applicant inspector ── */}
      <div className="scx-insp">
        <div className="scx-insp-nav">
          <span className="scx-insp-title">{tx('Inspect applicant', 'افحص عميلًا')}</span>
          <button className="scx-chip" onClick={() => setIdxRaw(Math.max(1, idx - 1))} aria-label={tx('Previous', 'السابق')}>‹</button>
          <input
            className="scx-num scx-idx" type="number" dir="ltr" min={1} max={n} value={idx}
            onChange={(e) => setIdxRaw(Number(e.target.value) || 1)}
          />
          <button className="scx-chip" onClick={() => setIdxRaw(Math.min(n, idx + 1))} aria-label={tx('Next', 'التالي')}>›</button>
          <span className="scx-of" dir="ltr">/ {fmtN(n)}</span>
        </div>
        <ApplicantCard a={a} segName={segName} />
      </div>

      <p className="scx-honest">
        {tx(
          'Synthetic population of 1,000,000 accounts, learned from real Berka bank data (TSTR 96% of the real-trained ceiling) — no real customers. Individuals are derived deterministically from the corpus’ segment distributions.',
          'مجتمع اصطناعي من ١,٠٠٠,٠٠٠ حساب، مُتعلَّم من بيانات بيركا المصرفية الحقيقية (TSTR ‏96٪ من السقف الحقيقي) — لا يضم عملاء حقيقيين. الأفراد مشتقّون حتميًا من توزيعات شرائح المجتمع.',
        )}
      </p>
    </section>
  )
}

function Stat({ label, value, cap, tone }: { label: string; value: string; cap?: string; tone?: 'ok' | 'bad' | 'warn' }) {
  return (
    <div className={`scx-stat${tone ? ` ${tone}` : ''}`}>
      <span className="scx-stat-v" dir="ltr">{value}</span>
      <span className="scx-stat-l">{label}{cap ? <small> · {cap}</small> : null}</span>
    </div>
  )
}

function ApplicantCard({ a, segName }: { a: CorpusApplicant; segName: (k: string) => string }) {
  const { tx, lang } = useTx()
  const DEC: Record<CorpusApplicant['decision'], { ar: string; en: string; cls: string }> = {
    approved: { ar: 'موافقة تلقائية', en: 'Auto-approved', cls: 'ok' },
    declined: { ar: 'رفض تلقائي', en: 'Auto-declined', cls: 'bad' },
    review: { ar: 'مراجعة يدوية', en: 'Manual review', cls: 'warn' },
  }
  const d = DEC[a.decision]
  return (
    <div className="scx-card">
      <div className="scx-card-top">
        <div>
          <b>{lang === 'ar' ? a.nameAr : a.nameEn}</b>
          <small dir="ltr">#{a.index.toLocaleString('en-US')}</small>
        </div>
        <span className={`scx-dec ${d.cls}`}>{lang === 'ar' ? d.ar : d.en}</span>
      </div>
      <div className="scx-card-meta">
        <span style={{ color: SEG_COLORS[a.segment.key] }}>● {segName(a.segment.key)}</span>
        <span>{tx('Age', 'العمر')} {a.age}</span>
        <span>{tx('Grade', 'الدرجة')} <b dir="ltr">{a.grade}</b></span>
      </div>
      <div className="scx-facts">
        <Fact l={tx('Income regularity', 'انتظام الدخل')} v={pct1(a.incomeRegularity)} />
        <Fact l={tx('Obligation load', 'عبء الالتزامات')} v={pct1(a.obligationLoad)} />
        <Fact l={tx('Income ÷ expenses', 'الدخل ÷ المصروفات')} v={a.incomeExpenseRatio.toFixed(2)} />
        <Fact l={tx('Avg balance', 'متوسط الرصيد')} v={`${fmtN(a.avgBalance)} ${tx('SAR', 'ر.س')}`} />
        <Fact l={tx('Financing ask', 'طلب التمويل')} v={`${fmtN(a.loanAsk)} ${tx('SAR', 'ر.س')}`} />
      </div>
      <p className="scx-reason">{lang === 'ar' ? a.reasonAr : a.reasonEn}</p>
    </div>
  )
}

function Fact({ l, v }: { l: string; v: string }) {
  return (
    <div className="scx-fact">
      <small>{l}</small>
      <b dir="ltr">{v}</b>
    </div>
  )
}
