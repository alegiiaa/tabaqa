// One orders desk, two transports — the live wire between تطبيق طبقة (the
// phone) and the bank-worker dashboard.
//
//   1) Supabase `loan_orders` (primary): a real shared store + Realtime — the
//      phone INSERTs, the desk sees it the same second; the worker decides or
//      extends, the phone gets the change pushed live. Survives serverless
//      cold starts (the in-memory desk never did).
//   2) The sandbox API's in-memory desk (fallback + mirror): keeps the
//      offline-LAN rehearsal working (local uvicorn, no internet) and keeps
//      the uvicorn-log demo beat — every order is still POSTed there.
//
// Every reader tries Supabase first and falls back to the API; every writer
// writes Supabase and mirrors to the API best-effort — both desks tell the
// same story, and nothing here ever throws at the caller.

import { supabase, isSupabaseConfigured } from './supabase'
import { annuityFactor } from './lenders'
import { API_BASE } from './api'

export type OrderStatus = 'pending' | 'accepted' | 'declined' | 'expired'
export type DeskTransport = 'supabase' | 'api'

export interface OrderEvent {
  at: string // ISO timestamp
  type: 'submitted' | 'accepted' | 'declined' | 'extended'
  tenor_months?: number
  installment?: number
}

export interface DeskOrder {
  order_id: string
  status: OrderStatus
  created_at: string
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
  original_tenor_months: number | null
  events: OrderEvent[]
  report_d: string // empty in list views over Supabase (fetched per-order)
}

const TABLE = 'loan_orders'
const TTL_S = 24 * 3600
const SUPA_TIMEOUT_MS = 6_000
// list views skip report_d (the encoded statement can be ~300KB per row)
const LIGHT_COLS =
  'id,created_at,updated_at,status,national_id,applicant_ar,lender_id,lender_ar,product_ar,' +
  'amount,tenor_months,installment,apr,total,score,risk,eligible_income,obligations,' +
  'original_tenor_months,extended_at,decided_at,events'

const nowIso = () => new Date().toISOString()

export function newOrderId(): string {
  const bytes = new Uint8Array(5)
  crypto.getRandomValues(bytes)
  return `ord_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

/** The same murabaha annuity the offers were priced with (lib/lenders.ts). */
export function installmentFor(amount: number, apr: number, months: number): number {
  if (months <= 0) return 0
  if (apr <= 0) return amount / months
  return amount / annuityFactor(apr, months)
}

// ── row mapping ──────────────────────────────────────────────────────────────

function deriveStatus(status: string, createdAtMs: number): { status: OrderStatus; remaining_s: number } {
  const remaining = Math.max(0, Math.round((createdAtMs + TTL_S * 1000 - Date.now()) / 1000))
  const st = status === 'pending' && remaining === 0 ? 'expired' : (status as OrderStatus)
  return { status: st, remaining_s: remaining }
}

function fromSupabase(row: Record<string, any>): DeskOrder {
  const createdAtMs = Date.parse(String(row.created_at ?? '')) || Date.now()
  return {
    order_id: String(row.id ?? ''),
    ...deriveStatus(String(row.status ?? 'pending'), createdAtMs),
    created_at: String(row.created_at ?? ''),
    national_id: String(row.national_id ?? ''),
    applicant_ar: String(row.applicant_ar ?? ''),
    lender_id: String(row.lender_id ?? ''),
    lender_ar: String(row.lender_ar ?? ''),
    product_ar: String(row.product_ar ?? ''),
    amount: Number(row.amount ?? 0),
    tenor_months: Number(row.tenor_months ?? 0),
    installment: Number(row.installment ?? 0),
    apr: Number(row.apr ?? 0),
    total: Number(row.total ?? 0),
    score: Number(row.score ?? 0),
    risk: String(row.risk ?? ''),
    eligible_income: Number(row.eligible_income ?? 0),
    obligations: Number(row.obligations ?? 0),
    original_tenor_months: row.original_tenor_months == null ? null : Number(row.original_tenor_months),
    events: Array.isArray(row.events) ? (row.events as OrderEvent[]) : [],
    report_d: String(row.report_d ?? ''),
  }
}

function fromApi(o: Record<string, any>): DeskOrder {
  const createdAtMs = Number(o.received_at ?? 0) * 1000 || Date.now()
  return {
    order_id: String(o.order_id ?? ''),
    status: String(o.status ?? 'pending') as OrderStatus,
    remaining_s: Number(o.remaining_s ?? 0),
    created_at: new Date(createdAtMs).toISOString(),
    national_id: String(o.national_id ?? ''),
    applicant_ar: String(o.applicant_ar ?? ''),
    lender_id: String(o.lender_id ?? ''),
    lender_ar: String(o.lender_ar ?? ''),
    product_ar: String(o.product_ar ?? ''),
    amount: Number(o.amount ?? 0),
    tenor_months: Number(o.tenor_months ?? 0),
    installment: Number(o.installment ?? 0),
    apr: Number(o.apr ?? 0),
    total: Number(o.total ?? 0),
    score: Number(o.score ?? 0),
    risk: String(o.risk ?? ''),
    eligible_income: Number(o.eligible_income ?? 0),
    obligations: Number(o.obligations ?? 0),
    original_tenor_months: o.original_tenor_months == null ? null : Number(o.original_tenor_months),
    events: Array.isArray(o.events) ? (o.events as OrderEvent[]) : [],
    report_d: String(o.report_d ?? ''),
  }
}

// ── the API fallback (the pre-Supabase desk, kept verbatim) ──────────────────

async function apiJson(path: string, init?: RequestInit): Promise<Record<string, any>> {
  // cache-bust + no-store: a stale edge copy of desk state is how orders vanish
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${API_BASE}/sandbox/v1${path}${sep}t=${Date.now()}`, {
    cache: 'no-store',
    ...init,
  })
  if (!res.ok) throw new Error(`desk HTTP ${res.status}`)
  return (await res.json()) as Record<string, any>
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function listDesk(): Promise<{ orders: DeskOrder[]; via: DeskTransport }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(LIGHT_COLS)
        .order('created_at', { ascending: false })
        .limit(50)
        .abortSignal(AbortSignal.timeout(SUPA_TIMEOUT_MS))
      if (!error && data) return { orders: data.map(fromSupabase), via: 'supabase' }
    } catch { /* fall back to the sandbox desk */ }
  }
  const env = await apiJson('/orders')
  return { orders: ((env.orders ?? []) as Record<string, any>[]).map(fromApi), via: 'api' }
}

export async function getDeskOrder(
  id: string,
  opts?: { withReport?: boolean },
): Promise<{ order: DeskOrder; via: DeskTransport } | null> {
  if (isSupabaseConfigured) {
    try {
      const cols = opts?.withReport ? `${LIGHT_COLS},report_d` : LIGHT_COLS
      const { data, error } = await supabase
        .from(TABLE)
        .select(cols)
        .eq('id', id)
        .abortSignal(AbortSignal.timeout(SUPA_TIMEOUT_MS))
        .maybeSingle()
      if (!error && data) return { order: fromSupabase(data), via: 'supabase' }
    } catch { /* fall back to the sandbox desk */ }
  }
  try {
    const env = await apiJson(`/orders/${encodeURIComponent(id)}`)
    return { order: fromApi(env), via: 'api' }
  } catch {
    return null
  }
}

// ── writes ───────────────────────────────────────────────────────────────────

export interface NewOrder {
  id: string
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

/** Insert on Supabase (primary), mirror to the sandbox desk (log beat + LAN
 *  fallback). Returns the id the desks actually agreed on. */
export async function createDeskOrder(o: NewOrder): Promise<{ ok: boolean; orderId: string | null }> {
  let supaOk = false
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from(TABLE)
        .insert({ ...o, events: [{ at: nowIso(), type: 'submitted' }] })
        .abortSignal(AbortSignal.timeout(SUPA_TIMEOUT_MS))
      supaOk = !error
    } catch { supaOk = false }
  }
  const mirror = apiJson('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...o, order_id: o.id, id: undefined }),
  })
  if (supaOk) {
    mirror.catch(() => {}) // fire-and-forget — Supabase already holds the truth
    return { ok: true, orderId: o.id }
  }
  try {
    const env = await mirror
    // an older API deploy generates its own id — track whichever id it answered with
    return { ok: true, orderId: String(env.order_id ?? '') || o.id }
  } catch {
    return { ok: false, orderId: null }
  }
}

export async function decideDeskOrder(o: DeskOrder, verb: 'accept' | 'decline'): Promise<boolean> {
  const type = verb === 'accept' ? 'accepted' : 'declined'
  const apiCall = () => apiJson(`/orders/${encodeURIComponent(o.order_id)}/${verb}`, { method: 'POST' })
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from(TABLE)
        .update({
          status: type,
          decided_at: nowIso(),
          events: [...o.events, { at: nowIso(), type }],
        })
        .eq('id', o.order_id)
        .abortSignal(AbortSignal.timeout(SUPA_TIMEOUT_MS))
      if (!error) {
        apiCall().catch(() => {}) // keep the mirror roughly in step
        return true
      }
    } catch { /* fall back to the sandbox desk */ }
  }
  try { await apiCall(); return true } catch { return false }
}

/** The bank worker's extension: more months, the SAME murabaha pricing —
 *  installment recomputed with the offer's annuity, admin fee carried over. */
export async function extendDeskOrder(o: DeskOrder, addMonths: number): Promise<boolean> {
  const add = Math.max(1, Math.min(36, Math.round(addMonths)))
  const newTenor = Math.min(96, o.tenor_months + add)
  if (newTenor === o.tenor_months) return false
  const fee = Math.max(0, o.total - o.installment * o.tenor_months)
  const newInstallment = Math.round(installmentFor(o.amount, o.apr, newTenor))
  const newTotal = Math.round(newInstallment * newTenor + fee)
  const event: OrderEvent = { at: nowIso(), type: 'extended', tenor_months: newTenor, installment: newInstallment }
  const apiCall = () => apiJson(`/orders/${encodeURIComponent(o.order_id)}/extend?add=${add}`, { method: 'POST' })
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from(TABLE)
        .update({
          tenor_months: newTenor,
          installment: newInstallment,
          total: newTotal,
          original_tenor_months: o.original_tenor_months ?? o.tenor_months,
          extended_at: nowIso(),
          events: [...o.events, event],
        })
        .eq('id', o.order_id)
        .abortSignal(AbortSignal.timeout(SUPA_TIMEOUT_MS))
      if (!error) {
        apiCall().catch(() => {})
        return true
      }
    } catch { /* fall back to the sandbox desk */ }
  }
  try { await apiCall(); return true } catch { return false }
}

/** Reset between demo runs — clears BOTH desks (Supabase + sandbox API). */
export async function clearDesk(): Promise<void> {
  const jobs: Promise<unknown>[] = [
    apiJson('/orders', { method: 'DELETE' }).catch(() => {}),
  ]
  if (isSupabaseConfigured) {
    jobs.push(
      Promise.resolve(
        supabase.from(TABLE).delete().neq('id', '').abortSignal(AbortSignal.timeout(SUPA_TIMEOUT_MS)),
      ).catch(() => {}),
    )
  }
  await Promise.all(jobs)
}

// ── realtime ─────────────────────────────────────────────────────────────────

/** Desk-wide stream: any INSERT/UPDATE/DELETE → onChange (callers refetch —
 *  events are treated as pings, so oversized payloads can never bite). */
export function subscribeDesk(onChange: () => void, onLive?: (live: boolean) => void): () => void {
  if (!isSupabaseConfigured) return () => {}
  const ch = supabase
    .channel('loan-orders-desk')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange())
    .subscribe((status) => onLive?.(status === 'SUBSCRIBED'))
  return () => { void supabase.removeChannel(ch) }
}

/** One order's stream — the phone watches its submitted order this way. */
export function subscribeDeskOrder(id: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {}
  const ch = supabase
    .channel(`loan-orders-${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${id}` }, () => onChange())
    .subscribe()
  return () => { void supabase.removeChannel(ch) }
}
