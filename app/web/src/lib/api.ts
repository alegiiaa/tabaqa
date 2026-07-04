// Typed client for the Tabaqa scoring API.
// In dev, VITE_API_BASE is empty → calls hit "/v1/*" and Vite proxies to :8000.
// In prod, set VITE_API_BASE=https://<api-host> so the browser calls it directly.

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

// ── response shapes (mirror api/models.py) ────────────────────────────────
export interface IncomeComponent {
  label: string
  monthly_amount: number
  txn_type: string
  verification: 'amount_verified' | 'source_verified' | 'inferred' | string
  verified_via: string
}

export interface Income {
  true_monthly_income: number
  bank_only_income: number
  verified_income: number
  verified_share: number
  reveal_delta: number
  components: IncomeComponent[]
}

export interface ReasonCode {
  code: string
  label: string
  points: number
  polarity: 'positive' | 'negative'
  feature?: string             // the cash-flow feature this bin reads
  iv?: number | null           // validated Information Value (Berka fit), if known
}

// D2 · actionable recourse — the fewest changes that lift the score into the next band.
export interface RecourseStep {
  feature: string
  from_points: number
  to_points: number
  gain: number
  comparator: '>=' | '<=' | string
  target_value: number
  current_value?: number | null
}
export interface Recourse {
  current_score: number
  current_band: 'low' | 'medium' | 'high' | string
  target_band: string
  target_score: number
  target_decision: 'REVIEW' | 'APPROVE' | string
  gap: number
  reachable: boolean
  projected_score: number
  already_prime: boolean
  steps: RecourseStep[]
}

// Real-data provenance stamped on every score: the Berka fit the weights are locked to.
export interface Validation {
  validated: boolean
  auc?: number | null
  ks?: number | null
  cv_auc?: number | null
  dataset?: string | null
  accounts?: number | null
  bad_rate?: number | null
  note?: string | null
}

export interface Features {
  income_regularity: number
  income_expense_ratio: number
  avg_balance: number
  min_balance: number
  nsf_count: number
  recurring_obligation_load: number
  balance_volatility: number
  months_observed: number
  verified_income_share: number
}

export interface Transaction {
  source: string
  timestamp: string
  amount: number
  direction: 'inflow' | 'outflow' | string
  raw_desc: string
  merchant?: string | null
  category?: string | null
  txn_type: string
  verification: string
  verified_via: string
  pfc_primary?: string | null      // Plaid PFC primary category
  pfc_detailed?: string | null
}

export interface Account {
  source: string            // "bank:alinma" | "wallet:barq"
  kind: 'bank' | 'wallet' | string
  provider: string          // "alinma" | "barq" | …
  opening_balance: number
  current_balance: number
  inflow: number
  outflow: number
  txn_count: number
  currency: string
}

// ── financial-intelligence layer (the "deep meaning") ─────────────────────
export interface IncomeTrend {
  direction: 'growing' | 'declining' | 'stable' | string
  pct_change: number
  monthly: { month: string; amount: number }[]
}

export interface DiversificationSource {
  label: string
  txn_type: string
  monthly: number
  share: number
}

export interface Diversification {
  label: 'single-source' | 'concentrated' | 'diversified' | string
  concentration: number
  sources: DiversificationSource[]
}

export interface Spending {
  monthly_total: number
  by_category: { category: string; monthly: number; share: number }[]
  top_merchants: { merchant: string; monthly: number }[]
}

export interface Recurring {
  obligation_load: number
  items: { label: string; kind: 'obligation' | 'subscription' | string; monthly: number }[]
}

export interface Insights {
  summary_line: string
  narrative: string
  highlights: string[]
  risks: string[]
  generated_by: string            // "claude:<model>" | "rules"
  income_trend: IncomeTrend
  diversification: Diversification
  spending: Spending
  savings_rate: number
  runway_months: number | null
  recurring: Recurring
  health: { stability: number; resilience: number; diversification: number }
  flags: string[]
}

export interface ScoreResult {
  tabaqa_score: number
  base_points?: number             // additive-scorecard base; score = base + Σ reason_codes.points
  pd: number
  risk_flag: 'low' | 'medium' | 'high' | string
  verified_income: number
  reasons: string[]
  income: Income
  reason_codes: ReasonCode[]
  recourse?: Recourse | null       // D2 — path to the next risk band
  validation?: Validation | null   // real-data provenance (Berka fit, AUC 0.890)
  applicant: Record<string, any>
  features?: Features | null
  transactions: Transaction[]
  accounts?: Account[]
  insights?: Insights | null      // fast deterministic insights (from /v1/score)
}

export interface AffordabilityResult {
  installment: number
  dbr_before: number
  dbr_after: number
  dbr_cap: number
  max_installment: number
  max_financing: number
  decision: 'APPROVE' | 'REVIEW' | 'DECLINE' | string
  annuity_factor: number
  pd?: number | null
  reasons: string[]
  verified_income: number
  bank_only_income?: number | null
  bank_only?: {
    verified_income: number
    dbr_after: number
    max_financing: number
    decision: string
  } | null
  dbr_policy?: {
    cap: number
    code: string
    label: string
    total_obligations_ceiling: number
    citation: string
  } | null
}

export interface Persona {
  id: string
  connection_id: string
  name: string
  role: string
  true_monthly_income: number
  bank_only_income: number
  reveal_delta: number
  tabaqa_score: number
  risk_flag: string
}

// ── form / statement request payloads ─────────────────────────────────────
export interface ApplicantFormInput {
  name?: string
  months?: number
  bank?: { name?: string; opening_balance?: number }
  wallet?: { name?: string; opening_balance?: number }
  salary?: { monthly?: number; employer?: string } | null
  gigs?: { platform: string; monthly: number }[]
  p2p?: { from: string; monthly: number }[]
  obligations?: { label: string; monthly: number }[]
  monthly_spending?: number
}

export interface StatementRowInput {
  date: string
  description: string
  amount?: number
  debit?: number
  credit?: number
  source: string
  counterparty_iban?: string
  balance?: number
}

export interface StatementInput {
  name?: string
  rows: StatementRowInput[]
  context?: {
    bank_name?: string
    wallet_name?: string
    opening_balances?: Record<string, number>
    amount_convention?: 'signed' | 'debit_credit'
    employer?: string
    salary_iban?: string
    monthly_wage?: number
    gig_platforms?: string[]
  }
}

export interface AffordabilityInput {
  connection_id?: string
  verified_income?: number
  amount: number
  tenor_months: number
  annual_rate: number
  existing_obligations?: number
  dbr_cap?: number
  bank_only_income?: number
  risk_flag?: string
  customer_type?: 'employee' | 'retiree'   // SAMA preset; drives the regulator cap
  redf_beneficiary?: boolean
}

// ── assistant ──────────────────────────────────────────────────────────────
export interface AssistantMessage { role: 'user' | 'assistant'; content: string }
export interface AssistantAction { type: 'navigate' | 'open' | 'none'; section?: string | null; target?: string | null }
export interface AssistantReply { reply: string; suggestions: string[]; source: string; action?: AssistantAction | null }

// ── transport ──────────────────────────────────────────────────────────────
// One classified error type so the UI can show a friendly, bilingual message
// (and a Retry) instead of the browser's raw "Failed to fetch". `kind` tells the
// difference between "your wifi blinked", "the lambda is cold-starting", and
// "the server genuinely errored".
export type ApiErrorKind = 'network' | 'timeout' | 'server' | 'client'
export class ApiError extends Error {
  kind: ApiErrorKind
  status?: number
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

// Generous ceiling: longer than the API lambda could ever run (so we never abort
// a slow-but-working score), short enough to end a genuine hang.
const REQUEST_TIMEOUT_MS = 30_000

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
      signal: ctrl.signal,
    })
  } catch (e: unknown) {
    // fetch() rejects on network failure or on our abort (timeout).
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('timeout', `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
    }
    throw new ApiError('network', e instanceof Error ? e.message : 'Network request failed')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status >= 500 ? 'server' : 'client', detail, res.status)
  }
  return res.json() as Promise<T>
}

const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })

// ── endpoints ────────────────────────────────────────────────────────────
export const api = {
  scoreConnection: (connection_id: string) =>
    postJson<ScoreResult>('/v1/score', { connection_id }),
  scoreForm: (form: ApplicantFormInput) =>
    postJson<ScoreResult>('/v1/score', { form }),
  scoreStatement: (statement: StatementInput) =>
    postJson<ScoreResult>('/v1/score', { statement }),
  affordability: (input: AffordabilityInput) =>
    postJson<AffordabilityResult>('/v1/affordability', input),
  personas: () => request<Persona[]>('/v1/personas'),
  // /v1/insights mirrors /v1/score's inputs and returns the Claude-narrated read.
  insightsConnection: (connection_id: string) =>
    postJson<Insights>('/v1/insights', { connection_id }),
  insightsStatement: (statement: StatementInput) =>
    postJson<Insights>('/v1/insights', { statement }),
  assistant: (messages: AssistantMessage[], context?: Record<string, unknown>) =>
    postJson<AssistantReply>('/v1/assistant', { messages, context }),
}
