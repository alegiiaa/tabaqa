// The bank worker's desk — what /demo IS now (user direction, Jul 17 evening):
// the website dashboard shows ONLY the lender's side — orders arriving live
// from the Tabaqa iOS app, and the applicants who applied. No offers, no
// cash-flow panels, no own-money view: those are consumer surfaces and live in
// the app. The full consumer dashboard stays parked at /demo-full untouched.

import { useEffect, useRef, useState } from 'react'
import { useTx } from '../../lib/tx'
import type { AssistantAction, ScoreResult } from '../../lib/api'
import { DashboardLayout, type NavSpec, type Section } from './DashboardLayout'
import { IncomingOrders, OrderToast, fetchOrders, type TabaqaOrder } from './IncomingOrders'
import { Applicants } from './Applicants'
import { CommandBar } from './CommandBar'

type DeskSection = Extract<Section, 'orders' | 'applicants'>

/** Ask-Tabaqa fact set for the applicant the worker is looking at — same
 *  grounding contract as the full dashboard (the firewall's allowed numbers). */
function buildCopilotFacts(r: ScoreResult) {
  return {
    score: r.tabaqa_score,
    score_scale: 'score is 1-99, higher is better',
    risk_flag: r.risk_flag,
    bank_only_income_sar: r.income.bank_only_income,
    true_verified_income_sar: r.income.true_monthly_income,
    hidden_income_revealed_sar: r.income.reveal_delta,
    verified_income_share: r.income.verified_share,
    months_observed: r.confidence?.months_observed,
    top_reasons: r.reason_codes.slice(0, 5).map((c) => ({ label: c.label, points: c.points, polarity: c.polarity })),
    recourse: r.recourse ?? undefined,
    sama_dbr_cap_pct: { employee: 33.33, retiree: 25 },
  }
}

export function BankDesk() {
  const { tx } = useTx()
  const [section, setSection] = useState<DeskSection>('orders')

  // ── the desk feed: poll the sandbox orders, toast live arrivals ────────────
  const [orders, setOrders] = useState<TabaqaOrder[] | null>(null)
  const [toast, setToast] = useState<TabaqaOrder | null>(null)
  const seen = useRef<Set<string>>(new Set())
  const primed = useRef(false)

  async function poll() {
    try {
      const list = await fetchOrders()
      setOrders(list)
      const fresh = list.find((o) => o.status === 'pending' && !seen.current.has(o.order_id))
      list.forEach((o) => seen.current.add(o.order_id))
      if (fresh && primed.current) setToast(fresh)
      primed.current = true
    } catch { /* desk offline — keep the last known list */ }
  }

  useEffect(() => {
    void poll()
    const t = window.setInterval(() => { void poll() }, 5000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 12_000)
    return () => window.clearTimeout(t)
  }, [toast])

  const pending = orders?.filter((o) => o.status === 'pending').length ?? 0

  // Ask-Tabaqa grounds on whoever the worker is reviewing in المتقدمون.
  const [applicantResult, setApplicantResult] = useState<ScoreResult | null>(null)
  const facts = section === 'applicants' && applicantResult ? buildCopilotFacts(applicantResult) : null

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

  function handleAction(a: AssistantAction) {
    if (a.type === 'navigate' && (a.section === 'orders' || a.section === 'applicants')) setSection(a.section)
    else if (a.type === 'open' && a.target === 'developers') window.open('/developers', '_blank')
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
          ? <IncomingOrders orders={orders} onChanged={() => { void poll() }} />
          : <Applicants onActiveResult={setApplicantResult} />}
      </DashboardLayout>
      <CommandBar section={section} connected onAction={handleAction} facts={facts} />
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
