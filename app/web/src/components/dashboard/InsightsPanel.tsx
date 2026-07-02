import { useEffect, useState } from 'react'
import { useTx } from '../../lib/tx'
import { api, type Insights, type StatementInput } from '../../lib/api'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (x: number) => `${Math.round(x * 100)}%`

const CATEGORY_LABEL: Record<string, string> = {
  grocery: 'Groceries', coffee: 'Coffee', fuel: 'Fuel', telecom: 'Telecom',
  ecommerce: 'E-commerce', restaurant: 'Dining', gig_platform: 'Gig', retail: 'Retail',
  electronics: 'Electronics', wallet: 'Wallet', loan_obligation: 'Financing',
  p2p_transfer: 'Transfers', other: 'Other',
}
const catLabel = (c: string) => CATEGORY_LABEL[c] ?? c.replace(/_/g, ' ')

/**
 * The "deep meaning" panel. Renders instantly from the deterministic insights that
 * ship with /v1/score, then upgrades in place to the Claude-narrated version from
 * /v1/insights (no-op when the server has no key — same structured signals either way).
 */
export function InsightsPanel({
  initial, conn,
}: { initial: Insights; conn: { connectionId?: string; statement?: StatementInput } }) {
  const { tx } = useTx()
  const [data, setData] = useState<Insights>(initial)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let on = true
    const p = conn.statement
      ? api.insightsStatement(conn.statement)
      : conn.connectionId ? api.insightsConnection(conn.connectionId) : null
    if (!p) return
    setLoading(true)
    p.then((d) => { if (on) setData(d) }).catch(() => { /* keep deterministic */ })
      .finally(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [conn.connectionId, conn.statement])

  const ai = data.generated_by.includes(':')
  const prov = ai ? data.generated_by.split(':')[0] : null
  const model = ai ? data.generated_by.split(':')[1] : null
  const trend = data.income_trend
  const tarrow = trend.direction === 'growing' ? '↑' : trend.direction === 'declining' ? '↓' : '→'
  const tcls = trend.direction === 'growing' ? 'pos' : trend.direction === 'declining' ? 'neg' : ''
  const maxTrend = Math.max(1, ...trend.monthly.map((m) => m.amount))
  const cats = data.spending.by_category.slice(0, 5)
  const maxCat = Math.max(1, ...cats.map((c) => c.monthly))
  const sources = data.diversification.sources.slice(0, 3)
  const health = data.health

  return (
    <div className="ins-panel">
      <div className="ins-head">
        <div className="ins-title">
          <span className="ins-spark" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
            </svg>
          </span>
          <div>
            <h3>{tx('Financial intelligence', 'الذكاء المالي')}</h3>
            <span className="ins-sub faint">{tx('What this money history actually means', 'ما الذي يعنيه هذا السجل المالي فعليًا')}</span>
          </div>
        </div>
        <span className={`ins-badge ${ai ? 'ai' : ''}`}>
          {loading ? tx('Analysing…', 'جارٍ التحليل…')
            : ai ? (prov === 'allam'
              ? `✦ ALLaM · ${tx('Saudi national model', 'النموذج الوطني السعودي')}`
              : `✦ ${tx('AI', 'ذكاء')} · ${model}`)
              : tx('Rule-based', 'قائم على القواعد')}
        </span>
      </div>

      <p className="ins-summary">{data.summary_line}</p>
      {data.narrative && <p className="ins-narrative">{data.narrative}</p>}

      <div className="ins-cols">
        {data.highlights.length > 0 && (
          <div className="ins-list">
            <span className="ins-list-h pos">{tx('Strengths', 'نقاط القوة')}</span>
            {data.highlights.map((h, i) => <div className="ins-li" key={i}><span className="ins-tick pos">✓</span>{h}</div>)}
          </div>
        )}
        <div className="ins-list">
          <span className="ins-list-h warn">{tx('Watch-outs', 'مخاطر محتملة')}</span>
          {data.risks.length > 0
            ? data.risks.map((r, i) => <div className="ins-li" key={i}><span className="ins-tick warn">!</span>{r}</div>)
            : <div className="ins-li faint"><span className="ins-tick ok">✓</span>{tx('No material risks detected', 'لا توجد مخاطر جوهرية')}</div>}
        </div>
      </div>

      <div className="ins-grid">
        {/* income trend */}
        <div className="ins-card">
          <span className="ins-cap">{tx('Income trend', 'اتجاه الدخل')}</span>
          <div className="ins-card-top">
            <span className={`ins-big ${tcls}`}>{tarrow} {tx(
              trend.direction === 'growing' ? 'Growing' : trend.direction === 'declining' ? 'Declining' : 'Stable',
              trend.direction === 'growing' ? 'متزايد' : trend.direction === 'declining' ? 'متراجع' : 'مستقر',
            )}</span>
            {trend.pct_change !== 0 && <span className={`ins-delta ${tcls}`}>{trend.pct_change > 0 ? '+' : ''}{pct(trend.pct_change)}</span>}
          </div>
          <div className="ins-spark-bars" aria-hidden>
            {trend.monthly.map((m, i) => (
              <span key={i} className={`ins-sb${i === trend.monthly.length - 1 ? ' hot' : ''}`} style={{ height: `${Math.max(14, (m.amount / maxTrend) * 100)}%` }} />
            ))}
          </div>
        </div>

        {/* savings + runway */}
        <div className="ins-card">
          <span className="ins-cap">{tx('Cushion', 'الاحتياطي')}</span>
          <div className="ins-twin">
            <div>
              <span className="ins-big">{pct(data.savings_rate)}</span>
              <span className="ins-cap2">{tx('saved / mo', 'ادخار شهري')}</span>
            </div>
            <div>
              <span className="ins-big">{data.runway_months ?? '—'}<small>{data.runway_months != null ? tx('mo', 'شهر') : ''}</small></span>
              <span className="ins-cap2">{tx('runway', 'مدى التحمّل')}</span>
            </div>
          </div>
        </div>

        {/* diversification */}
        <div className="ins-card">
          <span className="ins-cap">{tx('Income sources', 'مصادر الدخل')} · {tx(
            data.diversification.label === 'diversified' ? 'diversified' : data.diversification.label === 'concentrated' ? 'concentrated' : 'single-source',
            data.diversification.label === 'diversified' ? 'متنوّع' : data.diversification.label === 'concentrated' ? 'مركّز' : 'مصدر واحد',
          )}</span>
          <div className="ins-rows">
            {sources.map((s, i) => (
              <div className="ins-row" key={i}>
                <span className="ins-row-l">{s.label}</span>
                <span className="ins-row-bar"><span style={{ width: `${Math.round(s.share * 100)}%` }} /></span>
                <span className="ins-row-v">{pct(s.share)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* spending mix */}
        <div className="ins-card">
          <span className="ins-cap">{tx('Where it goes', 'أين يُصرف')} · {fmt(data.spending.monthly_total)}/mo</span>
          <div className="ins-rows">
            {cats.map((c, i) => (
              <div className="ins-row" key={i}>
                <span className="ins-row-l">{catLabel(c.category)}</span>
                <span className="ins-row-bar alt"><span style={{ width: `${Math.round((c.monthly / maxCat) * 100)}%` }} /></span>
                <span className="ins-row-v">{fmt(c.monthly)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* health sub-scores */}
      <div className="ins-health">
        {([['stability', tx('Stability', 'الثبات')], ['resilience', tx('Resilience', 'المرونة')], ['diversification', tx('Diversification', 'التنوّع')]] as const).map(([k, label]) => {
          const v = (health as any)[k] as number
          return (
            <div className="ins-h" key={k}>
              <div className="ins-h-top"><span>{label}</span><b>{v}</b></div>
              <div className="ins-h-bar"><span className={v >= 66 ? 'ok' : v >= 40 ? 'mid' : 'low'} style={{ width: `${v}%` }} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
