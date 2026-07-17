// الطلبات الواردة — orders pushed by تطبيق طبقة (TEAM SPEC stages 8–10).
//
// The consumer app writes the chosen offer to the SHARED desk (Supabase
// `loan_orders`, sandbox API fallback — lib/ordersDesk.ts); this panel is the
// lender's desk inside the Tabaqa dashboard: each order arrives live (Realtime
// push + poll), carries a 24-hour acceptance window and the SAME applicant's
// encoded fused statement, so "عرض تقرير المتقدم" opens /report?o= — the exact
// person from the phone journey, re-scored live by the engine.
//
// The worker can قبول / رفض — or تمديد الأجل: pick +6/+12/+24 months, the
// installment is re-priced with the offer's own annuity, and the change lands
// on the applicant's phone the moment it is saved.

import { useState } from 'react'
import {
  clearDesk, decideDeskOrder, extendDeskOrder, installmentFor, listDesk,
  type DeskOrder, type DeskTransport,
} from '../../lib/ordersDesk'
import { useTx } from '../../lib/tx'

// the desk row shape, as consumed by BankDesk + the full Dashboard
export type TabaqaOrder = DeskOrder

/** Newest-first desk list over whichever transport is alive right now. */
export async function fetchOrders(): Promise<TabaqaOrder[]> {
  return (await listDesk()).orders
}

const nf = (n: number) => Math.round(n).toLocaleString('en-US')
const maskNin = (nin: string) => (nin.length === 10 ? `${nin[0]}•••••${nin.slice(6)}` : nin)

function countdown(s: number, tx: (en: string, ar: string) => string): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return tx(`${h}h ${m}m left`, `متبقٍ ${h} س ${m} د`)
}

/** تمديد الأجل — the bank worker's restructure, with the new installment shown
 *  on each choice BEFORE committing (same annuity the offer was priced with). */
function ExtendControl({ o, busy, onExtend, tx }: {
  o: TabaqaOrder
  busy: boolean
  onExtend: (add: number) => void
  tx: (en: string, ar: string) => string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ord-extend">
      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setOpen((v) => !v)}>
        {tx('Extend tenor', 'تمديد الأجل')} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="ord-extend-pop">
          <span className="ord-extend-cap">
            {tx('New tenor — the installment is re-priced automatically and reaches the applicant instantly:',
              'مدة جديدة — يُعاد تسعير القسط تلقائيًا ويصل التعديل للمتقدم فورًا:')}
          </span>
          <div className="ord-extend-chips">
            {[6, 12, 24].map((add) => {
              const nt = Math.min(96, o.tenor_months + add)
              const ni = Math.round(installmentFor(o.amount, o.apr, nt))
              return (
                <button key={add} className="ord-extend-chip" disabled={busy || nt === o.tenor_months}
                  onClick={() => { setOpen(false); onExtend(add) }}>
                  <b>+{add} {tx('mo', 'أشهر')}</b>
                  <i>{nt} {tx('mo', 'شهرًا')} · {nf(ni)} {tx('SAR/mo', 'ر.س/شهر')}</i>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function IncomingOrders({ orders, onChanged, live, via }: {
  orders: TabaqaOrder[] | null
  onChanged: () => void
  live?: boolean
  via?: DeskTransport
}) {
  const { tx } = useTx()
  const [busy, setBusy] = useState<string | null>(null)

  async function act(o: TabaqaOrder, verb: 'accept' | 'decline') {
    setBusy(o.order_id)
    try { await decideDeskOrder(o, verb) } catch { /* the poll will tell the truth */ }
    onChanged()
    setBusy(null)
  }

  async function extend(o: TabaqaOrder, add: number) {
    setBusy(o.order_id)
    try { await extendDeskOrder(o, add) } catch { /* the poll will tell the truth */ }
    onChanged()
    setBusy(null)
  }

  async function reset() {
    if (!window.confirm(tx('Clear the whole orders desk? (demo reset)', 'مسح مكتب الطلبات بالكامل؟ (إعادة تهيئة العرض)'))) return
    setBusy('__reset__')
    await clearDesk()
    onChanged()
    setBusy(null)
  }

  if (orders === null) {
    return (
      <div className="ord-empty">
        <b>{tx('Connecting to the orders desk…', 'جارٍ الاتصال بمكتب الطلبات…')}</b>
        <p>{tx('The desk lives on Supabase (with the Tabaqa Sandbox API as fallback) — check your connection.',
          'مكتب الطلبات يعمل عبر Supabase (و Tabaqa Sandbox API احتياطيًا) — تأكد من الاتصال.')}</p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="ord-list">
        <div className="ord-empty">
          <span className="ord-empty-ic" aria-hidden="true">📥</span>
          <b>{tx('No incoming orders yet', 'لا طلبات واردة بعد')}</b>
          <p>{tx('Complete a journey in the Tabaqa app — the order lands here the moment it is sent, with the applicant’s report attached.',
            'أكمل رحلة تمويل في تطبيق طبقة — يظهر الطلب هنا لحظة إرساله، ومعه تقرير المتقدم نفسه.')}</p>
        </div>
        <DeskFooter live={live} via={via} onReset={() => { void reset() }} busy={busy === '__reset__'} tx={tx} />
      </div>
    )
  }

  return (
    <div className="ord-list">
      {orders.map((o) => {
        const fresh = o.status === 'pending' && Date.now() - Date.parse(o.created_at) < 12_000
        return (
          <div key={o.order_id} className={`ord-card ${o.status}${fresh ? ' fresh' : ''}`}>
            <div className="ord-top">
              <span className={`ord-status ${o.status}`}>
                {o.status === 'pending' ? tx('NEW — accept within 24h', 'طلب جديد — اقبله خلال 24 ساعة')
                  : o.status === 'accepted' ? tx('Accepted', 'مقبول ✓')
                    : o.status === 'declined' ? tx('Declined', 'مرفوض')
                      : tx('Expired', 'انتهت المهلة')}
              </span>
              {o.original_tenor_months != null && (
                <span className="ord-status ext">
                  {tx(`Extended → ${o.tenor_months} mo`, `ممدد → ${o.tenor_months} شهرًا`)}
                </span>
              )}
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
              <div>
                <small>{tx('Installment', 'القسط')}</small>
                <b>{nf(o.installment)} <i>× {o.tenor_months}</i></b>
                {o.original_tenor_months != null && (
                  <em className="ord-was">{tx(`was × ${o.original_tenor_months}`, `كانت × ${o.original_tenor_months}`)}</em>
                )}
              </div>
              <div><small>{tx('APR', 'النسبة السنوية')}</small><b>{(o.apr * 100).toFixed(1)}٪</b></div>
              <div><small>{tx('Tabaqa score', 'درجة طبقة')}</small><b>{o.score}<i>/99</i></b></div>
              <div><small>{tx('Verified income', 'الدخل المعتمد')}</small><b>{nf(o.eligible_income)} <i>ر.س</i></b></div>
              <div><small>{tx('Obligations', 'الالتزامات')}</small><b>{nf(o.obligations)} <i>ر.س</i></b></div>
            </div>

            <div className="ord-actions">
              {o.status === 'pending' && (
                <>
                  <button className="btn btn-primary btn-sm" disabled={busy === o.order_id}
                    onClick={() => { void act(o, 'accept') }}>
                    {tx('Accept order', 'قبول الطلب')}
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={busy === o.order_id}
                    onClick={() => { void act(o, 'decline') }}>
                    {tx('Decline', 'رفض')}
                  </button>
                </>
              )}
              {(o.status === 'pending' || o.status === 'accepted') && (
                <ExtendControl o={o} busy={busy === o.order_id} onExtend={(add) => { void extend(o, add) }} tx={tx} />
              )}
              <button className="btn btn-ghost btn-sm"
                onClick={() => window.open(`/report?o=${encodeURIComponent(o.order_id)}`, '_blank')}>
                {tx('Open applicant report', 'عرض تقرير المتقدم')} ↗
              </button>
            </div>
          </div>
        )
      })}
      <DeskFooter live={live} via={via} onReset={() => { void reset() }} busy={busy === '__reset__'} tx={tx} />
    </div>
  )
}

function DeskFooter({ live, via, onReset, busy, tx }: {
  live?: boolean
  via?: DeskTransport
  onReset: () => void
  busy: boolean
  tx: (en: string, ar: string) => string
}) {
  return (
    <div className="ord-foot">
      <p className="ord-note">
        {live
          ? <><span className="ord-live-dot" aria-hidden="true" />{tx('Live — Supabase Realtime: orders and updates land the moment they happen.',
            'مباشر — Supabase Realtime: تصل الطلبات والتحديثات لحظة حدوثها.')}</>
          : via === 'supabase'
            ? tx('Connected to the shared Supabase desk — refreshed every few seconds.',
              'متصل بمكتب الطلبات المشترك على Supabase — يُحدَّث كل بضع ثوانٍ.')
            : tx('Simulated desk — orders arrive over the Tabaqa Sandbox API from the consumer app.',
              'مكتب محاكاة — تصل الطلبات عبر Tabaqa Sandbox API من تطبيق طبقة مباشرة.')}
      </p>
      <button className="ord-reset" disabled={busy} onClick={onReset}>
        {busy ? tx('Clearing…', 'جارٍ المسح…') : tx('Reset desk (demo)', 'مسح مكتب الطلبات (للعرض)')}
      </button>
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
