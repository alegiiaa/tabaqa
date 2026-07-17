// The bank worker's desk — what /demo IS now (user direction, Jul 17 evening):
// the website dashboard shows ONLY the lender's side — orders arriving live
// from the Tabaqa iOS app, and the applicants who applied. No offers, no
// cash-flow panels, no own-money view: those are consumer surfaces and live in
// the app. The full consumer dashboard stays parked at /demo-full untouched.

import { useEffect, useRef, useState } from 'react'
import { useTx } from '../../lib/tx'
import { listDesk, subscribeDesk, type DeskTransport } from '../../lib/ordersDesk'
import { DashboardLayout, type NavSpec, type Section } from './DashboardLayout'
import { IncomingOrders, OrderToast, type TabaqaOrder } from './IncomingOrders'
import { Applicants } from './Applicants'

type DeskSection = Extract<Section, 'orders' | 'applicants'>

export function BankDesk() {
  const { tx } = useTx()
  const [section, setSection] = useState<DeskSection>('orders')

  // ── the desk feed ──────────────────────────────────────────────────────────
  // Supabase Realtime pushes every desk change (the phone's INSERT included) →
  // instant refetch; the 5s poll stays as the self-healing fallback, and the
  // whole thing degrades to the sandbox API desk when Supabase is unreachable.
  const [orders, setOrders] = useState<TabaqaOrder[] | null>(null)
  const [via, setVia] = useState<DeskTransport>('api')
  const [live, setLive] = useState(false)
  const [toast, setToast] = useState<TabaqaOrder | null>(null)
  const seen = useRef<Set<string>>(new Set())
  const primed = useRef(false)

  async function poll() {
    try {
      const { orders: list, via: transport } = await listDesk()
      setOrders(list)
      setVia(transport)
      const fresh = list.find((o) => o.status === 'pending' && !seen.current.has(o.order_id))
      list.forEach((o) => seen.current.add(o.order_id))
      if (fresh && primed.current) setToast(fresh)
      primed.current = true
    } catch { /* desk offline — keep the last known list */ }
  }

  useEffect(() => {
    void poll()
    const t = window.setInterval(() => { void poll() }, 5000)
    const unsub = subscribeDesk(() => { void poll() }, setLive)
    return () => { window.clearInterval(t); unsub() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 12_000)
    return () => window.clearTimeout(t)
  }, [toast])

  const pending = orders?.filter((o) => o.status === 'pending').length ?? 0

  const nav: NavSpec[] = [
    {
      id: 'orders',
      label: tx('Incoming orders', 'الطلبات الواردة'),
      cap: tx('Lender desk', 'مكتب الجهة الممولة'),
      badge: pending ? String(pending) : undefined,
    },
    { id: 'applicants', label: tx('Applicants', 'المتقدمون') },
  ]

  const META: Record<DeskSection, { title: string; sub: string }> = {
    orders: {
      title: tx('Incoming orders', 'الطلبات الواردة'),
      sub: tx('Orders sent from the Tabaqa app — accept within 24 hours, the applicant’s verified report attached.',
        'طلبات وصلت من تطبيق طبقة — على الجهة اعتمادها خلال 24 ساعة، ومع كل طلب تقرير المتقدم الموثّق.'),
    },
    applicants: {
      title: tx('Applicants', 'المتقدمون'),
      sub: tx('Review the people who applied — score, reasons, and the verified income picture.',
        'راجع المتقدمين — الدرجة وأسبابها والصورة الموثّقة للدخل.'),
    },
  }

  return (
    <>
      <DashboardLayout
        active={section}
        onNavigate={(s) => { if (s === 'orders' || s === 'applicants') setSection(s) }}
        nav={nav}
        title={META[section].title}
        subtitle={META[section].sub}
      >
        {section === 'orders'
          // `live` needs BOTH: a subscribed realtime channel AND reads actually
          // served by Supabase — the channel reports SUBSCRIBED even when the
          // table doesn't exist yet, and the badge must never overclaim.
          ? <IncomingOrders orders={orders} onChanged={() => { void poll() }} live={live && via === 'supabase'} via={via} />
          : <Applicants />}
      </DashboardLayout>
      {toast && section !== 'orders' && (
        <OrderToast
          o={toast}
          onOpen={() => { setSection('orders'); setToast(null) }}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}
