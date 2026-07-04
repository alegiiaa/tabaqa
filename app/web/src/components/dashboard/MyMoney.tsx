import { useTx } from '../../lib/tx'
import type { ScoreResult, StatementInput, Transaction } from '../../lib/api'
import { resolveMerchant, CATEGORY_LABELS } from '../../lib/merchants'
import { sourceLabel } from '../../lib/institutions'
import { MerchantLogo } from './MerchantLogo'
import { AccountCard } from './AccountCard'
import { InsightsPanel } from './InsightsPanel'
import { useTierTag, FeedDate } from './Result'
import { reportHref } from '../../lib/reportlink'
import type { Section } from './DashboardLayout'

export interface InsightsConn { connectionId?: string; statement?: StatementInput }

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (x: number) => `${(x * 100).toFixed(0)}%`

/** Monthly verified-income series (salary + gig + p2p inflows), oldest → newest. */
function monthlyIncome(txns: Transaction[]): number[] {
  const map = new Map<string, number>()
  for (const t of txns) {
    if (t.direction === 'inflow' && ['salary', 'gig_income', 'p2p'].includes(t.txn_type)) {
      const k = t.timestamp.slice(0, 7)
      map.set(k, (map.get(k) ?? 0) + t.amount)
    }
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v)
}

export function MyMoney({ result, onNavigate, conn }: { result: ScoreResult; onNavigate: (s: Section) => void; conn: InsightsConn }) {
  const { tx, dir } = useTx()
  const arabic = dir === 'rtl'
  const tierTag = useTierTag()
  const inc = result.income
  const SAR = tx('SAR', 'ر.س')
  const accounts = result.accounts ?? []
  const holder = (result.applicant?.name as string) || tx('Card holder', 'حامل البطاقة')
  const first = holder.split(' ')[0]

  const series = monthlyIncome(result.transactions)
  const maxv = Math.max(1, ...series)

  const riskLabel =
    result.risk_flag === 'low' ? tx('Low risk', 'مخاطر منخفضة')
      : result.risk_flag === 'medium' ? tx('Medium risk', 'مخاطر متوسطة')
        : tx('High risk', 'مخاطر مرتفعة')

  const recent = result.transactions.slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, 6)
  const pos = result.reason_codes.filter((r) => r.polarity === 'positive').slice(0, 4)

  // compact score ring
  const R = 79
  const C = 2 * Math.PI * R
  const offset = C * (1 - Math.max(1, Math.min(99, result.tabaqa_score)) / 99)
  const riskCls = result.risk_flag === 'low' ? 'ok' : result.risk_flag === 'medium' ? 'warn' : 'bad'

  return (
    <div className="screen">
      {/* ── welcome hero ── */}
      <div className="mm-hero">
        <div className="mm-hero-top"><span className="dot" /> {tx('Verified by Tabaqa · live', 'موثّق من Tabaqa · مباشر')}</div>
        <h1>{tx(`Welcome back, ${first}`, `أهلًا بعودتك، ${first}`)}</h1>
        <p className="mm-hero-sub">
          {tx(
            'Your full money picture — bank and wallet together. This is the income a lender can actually see and trust.',
            'صورتك المالية الكاملة — البنك والمحفظة معًا. هذا هو الدخل الذي يستطيع المموّل رؤيته والوثوق به.',
          )}
        </p>

        <div className="mm-hero-reveal">
          <div className="mm-rev-cell">
            <span className="mm-rev-cap">{tx('Bank-only view', 'رؤية البنك فقط')}</span>
            <span className="mm-rev-num dim">{fmt(inc.bank_only_income)} <small>{SAR}</small></span>
          </div>
          <span className="mm-rev-arrow">→</span>
          <div className="mm-rev-cell">
            <span className="mm-rev-cap">{tx('Tabaqa true income', 'دخل Tabaqa الحقيقي')}</span>
            <span className="mm-rev-num">{fmt(inc.true_monthly_income)} <small>{SAR}</small></span>
          </div>
        </div>

        <div className="mm-hero-cta">
          <button className="btn btn-white" onClick={() => onNavigate('financing')}>{tx('How much can I borrow?', 'كم يمكنني أن أقترض؟')}</button>
          <button className="btn btn-clear" onClick={() => onNavigate('income')}>{tx('See income breakdown', 'تفصيل الدخل')}</button>
          {(conn.connectionId || conn.statement) && (
            <a className="btn btn-clear" href={reportHref(conn)} target="_blank" rel="noreferrer">{tx('Verified report ⤓', 'تقرير موثّق ⤓')}</a>
          )}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="mm-kpis">
        <div className="mm-kpi">
          <span className="mm-kpi-cap">
            <span className="mm-kpi-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7h-5M21 7v5" /></svg></span>
            {tx('True monthly income', 'الدخل الشهري الحقيقي')}
          </span>
          <span className="mm-kpi-val">{fmt(inc.true_monthly_income)} <small>{SAR}</small></span>
          <div className="mm-bars" aria-hidden>
            {series.map((v, i) => (
              <span key={i} className={`mm-bar${i === series.length - 1 ? ' hot' : ''}`} style={{ height: `${Math.max(12, (v / maxv) * 100)}%` }} />
            ))}
          </div>
        </div>

        <div className="mm-kpi">
          <span className="mm-kpi-cap">
            <span className="mm-kpi-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" /></svg></span>
            {tx('Tabaqa score', 'درجة Tabaqa')}
          </span>
          <span className="mm-kpi-val"><span dir="ltr">{result.tabaqa_score} <small>/ 99</small></span></span>
          <div className={`mm-kpi-foot ${riskCls === 'ok' ? 'pos' : ''}`}>{riskLabel} · <span dir="ltr">PD {(result.pd * 100).toFixed(1)}%</span></div>
        </div>

        <div className="mm-kpi">
          <span className="mm-kpi-cap">
            <span className="mm-kpi-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7-7 7 7" /></svg></span>
            {tx('Revealed income', 'الدخل المكشوف')}
          </span>
          <span className="mm-kpi-val"><span dir="ltr">+{fmt(inc.reveal_delta)}</span> <small>{SAR}</small></span>
          <div className="mm-kpi-foot pos">{tx('the bank could not see this', 'لم يكن البنك يرى هذا')}</div>
        </div>

        <div className="mm-kpi">
          <span className="mm-kpi-cap">
            <span className="mm-kpi-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z" /><path d="M9 12l2 2 4-4" /></svg></span>
            {tx('Verified share', 'النسبة الموثّقة')}
          </span>
          <span className="mm-kpi-val"><span dir="ltr">{pct(inc.verified_share)}</span></span>
          <div className="mm-kpi-foot">{tx('of income is proven', 'من الدخل مُثبت')}</div>
        </div>
      </div>

      {/* ── account cards ── */}
      {accounts.length > 0 && (
        <div className="acct-strip" style={{ marginTop: 18 }}>
          {accounts.map((a) => <AccountCard key={a.source} account={a} holder={holder} />)}
        </div>
      )}

      {/* ── income breakdown + score ── */}
      <div className="mm-grid">
        <div className="mm-panel">
          <div className="mm-panel-head">
            <span className="h">{tx('Income breakdown · 3-tier verification', 'تفصيل الدخل · تحقّق ثلاثي')}</span>
            <button className="mm-link" onClick={() => onNavigate('income')}>{tx('Details', 'التفاصيل')} <span className="fwd">→</span></button>
          </div>
          <div className="rc">
            {inc.components.map((c, i) => {
              const tag = tierTag(c.verification)
              return (
                <div className="row2" key={i}>
                  <span>{c.label}</span>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <b>{fmt(c.monthly_amount)}</b>
                    <span className={`tag ${tag.cls}`}>{tag.label}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mm-panel">
          <div className="mm-panel-head">
            <span className="h">{tx('Why this score', 'لماذا هذه الدرجة')}</span>
            <button className="mm-link" onClick={() => onNavigate('income')}>{tx('Full report', 'التقرير الكامل')} <span className="fwd">→</span></button>
          </div>
          <div className="mm-score-row">
            <div className="gauge">
              <svg width="188" height="188" viewBox="0 0 188 188" aria-label={`Tabaqa score ${result.tabaqa_score}`}>
                <circle cx="94" cy="94" r={R} stroke="rgba(12,18,38,.08)" strokeWidth="12" fill="none" />
                <circle cx="94" cy="94" r={R} stroke="url(#mmsg)" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
                <defs><linearGradient id="mmsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient></defs>
              </svg>
              <div className="ctr"><div className="num">{result.tabaqa_score}</div><div className="lab">{tx('Score', 'الدرجة')}</div></div>
            </div>
            <div className="rc" style={{ flex: 1 }}>
              {pos.map((r, i) => (
                <div className="row2" key={i}>
                  <span>{r.label}</span>
                  <b className="pts-pos" dir="ltr">+{r.points}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── financial intelligence (the deep meaning) ── */}
      {result.insights && (
        <div style={{ marginTop: 16 }}>
          <InsightsPanel initial={result.insights} conn={conn} />
        </div>
      )}

      {/* ── recent activity ── */}
      <div className="mm-panel" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
        <div className="mm-panel-head" style={{ padding: '18px 20px 0' }}>
          <span className="h">{tx('Recent activity · bank + wallet', 'أحدث العمليات · البنك + المحفظة')}</span>
          <button className="mm-link" onClick={() => onNavigate('ledger')}>{tx('View all', 'عرض الكل')} <span className="fwd">→</span></button>
        </div>
        <div className="mm-mini-feed">
          {recent.map((t, i) => {
            const r = resolveMerchant(t)
            const isWallet = t.source.startsWith('wallet:')
            const inflow = t.direction === 'inflow'
            const cat = CATEGORY_LABELS[r.category]
            return (
              <div className="feed-row" key={i}>
                <MerchantLogo r={r} />
                <div className="feed-main">
                  <div className="feed-title">
                    {r.title}
                    <span className={`feed-src ${isWallet ? 'w' : 'b'}`}>{sourceLabel(t.source, tx)}</span>
                  </div>
                  <div className="feed-sub faint">{cat ? tx(cat[0], cat[1]) : t.txn_type} · <FeedDate iso={t.timestamp} arabic={arabic} /></div>
                </div>
                <div className={`feed-amt ${inflow ? 'pos' : 'neg'}`}><span dir="ltr">{inflow ? '+' : '−'}{fmt(t.amount)}</span> <small>{SAR}</small></div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
