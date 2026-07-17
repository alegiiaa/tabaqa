// الطلبات الواردة — orders pushed by تطبيق طبقة (TEAM SPEC stages 8–10).
//
// The consumer app POSTs the chosen offer to /sandbox/v1/orders; this panel is
// the lender's desk inside the Tabaqa dashboard: each order arrives with a
// 24-hour acceptance window and carries the SAME applicant's encoded fused
// statement, so "عرض تقرير المتقدم" opens /report?d= — the exact person from
// the phone journey, re-scored live by the engine.

import { useState } from 'react'
import { API_BASE } from '../../lib/api'
import { useTx } from '../../lib/tx'

export interface TabaqaOrder {
  order_id: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  remaining_s: number
  national_id: string
  applicant_ar: string
  lender_id: string
  lender_ar: string
  product_ar: string
  amount: number
  tenor_months: number
  installment: number
  apr: number
  total: number
  score: number
  risk: string
  eligible_income: number
  obligations: number
  report_d: string
}

export async function fetchOrders(): Promise<TabaqaOrder[]> {
  const res = await fetch(`${API_BASE}/sandbox/v1/orders`)
  if (!res.ok) throw new Error(`orders HTTP ${res.status}`)
  const env = (await res.json()) as Record<string, any>
  return (env.orders ?? []) as TabaqaOrder[]
}

export async function decideOrder(id: string, verb: 'accept' | 'decline'): Promise<void> {
  await fetch(`${API_BASE}/sandbox/v1/orders/${encodeURIComponent(id)}/${verb}`, { method: 'POST' })
}

const nf = (n: number) => Math.round(n).toLocaleString('en-US')
const maskNin = (nin: string) => (nin.length === 10 ? `${nin[0]}•••••${nin.slice(6)}` : nin)

function countdown(s: number, tx: (en: string, ar: string) => string): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return tx(`${h}h ${m}m left`, `متبقٍ ${h} س ${m} د`)
}

export function IncomingOrders({ orders, onChanged }: {
  orders: TabaqaOrder[] | null
  onChanged: () => void
}) {
  const { tx } = useTx()
  const [busy, setBusy] = useState<string | null>(null)

  async function act(id: string, verb: 'accept' | 'decline') {
    setBusy(id)
    try { await decideOrder(id, verb) } catch { /* the poll will tell the truth */ }
    onChanged()
    setBusy(null)
  }

  if (orders === null) {
    return (
      <div className="ord-empty">
        <b>{tx('Connecting to the orders desk…', 'جارٍ الاتصال بمكتب الطلبات…')}</b>
        <p>{tx('The desk lives on the Tabaqa Sandbox API — make sure the API is running.',
          'مكتب الطلبات يعمل عبر Tabaqa Sandbox API — تأكد من تشغيل الخادم.')}</p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="ord-empty">
        <span className="ord-empty-ic" aria-hidden="true">📥</span>
        <b>{tx('No incoming orders yet', 'لا طلبات واردة بعد')}</b>
        <p>{tx('Complete a journey in the Tabaqa app — the order lands here the moment it is sent, with the applicant’s report attached.',
          'أكمل رحلة تمويل في تطبيق طبقة — يظهر الطلب هنا لحظة إرساله، ومعه تقرير المتقدم نفسه.')}</p>
      </div>
    )
  }

  return (
    <div className="ord-list">
      {orders.map((o) => (
        <div key={o.order_id} className={`ord-card ${o.status}`}>
          <div className="ord-top">
            <span className={`ord-status ${o.status}`}>
              {o.status === 'pending' ? tx('NEW — accept within 24h', 'طلب جديد — اقبله خلال 24 ساعة')
                : o.status === 'accepted' ? tx('Accepted', 'مقبول ✓')
                  : o.status === 'declined' ? tx('Declined', 'مرفوض')
                    : tx('Expired', 'انتهت المهلة')}
            </span>
            {o.status === 'pending' && <span className="ord-count">{countdown(o.remaining_s, tx)}</span>}
            <span className="ord-id" dir="ltr">{o.order_id}</span>
          </div>

          <div className="ord-who">
            <b>{o.applicant_ar}</b>
            <span dir="ltr">{maskNin(o.national_id)}</span>
            <span className="ord-sep">·</span>
            <span>{o.product_ar}</span>
            <span className="ord-sep">·</span>
            <span>{tx('via', 'لدى')} <b>{o.lender_ar}</b></span>
          </div>

          <div className="ord-figs">
            <div><small>{tx('Amount', 'المبلغ')}</small><b>{nf(o.amount)} <i>ر.س</i></b></div>
            <div><small>{tx('Installment', 'القسط')}</small><b>{nf(o.installment)} <i>× {o.tenor_months}</i></b></div>
            <div><small>{tx('APR', 'النسبة السنوية')}</small><b>{(o.apr * 100).toFixed(1)}٪</b></div>
            <div><small>{tx('Tabaqa score', 'درجة طبقة')}</small><b>{o.score}<i>/99</i></b></div>
            <div><small>{tx('Verified income', 'الدخل المعتمد')}</small><b>{nf(o.eligible_income)} <i>ر.س</i></b></div>
            <div><small>{tx('Obligations', 'الالتزامات')}</small><b>{nf(o.obligations)} <i>ر.س</i></b></div>
          </div>

          <div className="ord-actions">
            {o.status === 'pending' && (
              <>
                <button className="btn btn-primary btn-sm" disabled={busy === o.order_id}
                  onClick={() => { void act(o.order_id, 'accept') }}>
                  {tx('Accept order', 'قبول الطلب')}
                </button>
                <button className="btn btn-ghost btn-sm" disabled={busy === o.order_id}
                  onClick={() => { void act(o.order_id, 'decline') }}>
                  {tx('Decline', 'رفض')}
                </button>
              </>
            )}
            {o.report_d && (
              <button className="btn btn-ghost btn-sm"
                onClick={() => window.open(`/report?o=${encodeURIComponent(o.order_id)}`, '_blank')}>
                {tx('Open applicant report', 'عرض تقرير المتقدم')} ↗
              </button>
            )}
          </div>
        </div>
      ))}
      <p className="ord-note">
        {tx('Simulated desk — orders arrive over the Tabaqa Sandbox API from the consumer app.',
          'مكتب محاكاة — تصل الطلبات عبر Tabaqa Sandbox API من تطبيق طبقة مباشرة.')}
      </p>
    </div>
  )
}

/** The "you have a new order" moment — fixed banner, click-through to the desk. */
export function OrderToast({ o, onOpen, onClose }: {
  o: TabaqaOrder
  onOpen: () => void
  onClose: () => void
}) {
  const { tx } = useTx()
  return (
    <div className="ord-toast" role="status">
      <span className="ord-toast-bell" aria-hidden="true">🔔</span>
      <div className="ord-toast-txt">
        <b>{tx('New order from the Tabaqa app', 'طلب جديد من تطبيق طبقة')}</b>
        <span>
          {o.applicant_ar} — {nf(o.amount)} ر.س {tx('via', 'لدى')} {o.lender_ar}.{' '}
          {tx('Accept within 24 hours.', 'اقبله خلال 24 ساعة.')}
        </span>
      </div>
      <button className="btn btn-primary btn-sm" onClick={onOpen}>{tx('View order', 'عرض الطلب')}</button>
      <button className="ord-toast-x" onClick={onClose} aria-label={tx('Dismiss', 'إغلاق')}>✕</button>
    </div>
  )
}
