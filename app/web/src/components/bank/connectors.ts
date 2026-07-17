// Data Connector Service (PRODUCT_SPEC §16.3) — one connector per consented
// source on the consent screen. Each retrieves its RAW payload over REAL HTTP
// from the Tabaqa Sandbox (api/sandbox.py → /sandbox/v1/*): the provider behind
// the URL is simulated, the transport is not. When the API is unreachable the
// connector falls back to the bundled payload at the same pacing (offline mode),
// so the demo never depends on one layer. Either way the engine derives from
// identical bytes: the sandbox serves the SAME files raw.ts bundles
// (web/src/data/<persona>/*.json) — nothing downstream is hardcoded, including
// the decision itself.

import { deriveProfile, decide, eligibleIncomeOf, installmentRoomOf, Decision, Profile, PROFILE } from './derive'
import { ahmedRaw, khalidRaw, PersonaId, RawSet, RAW_SETS, saraRaw } from './raw'
import { API_BASE } from '../../lib/api'

export type { RawTx, AccountPayload, RawSet, PersonaId } from './raw'

/** Ahmed's raw sources — the default applicant behind the تمويل journey (spec §21). */
export const RAW = ahmedRaw

const latency = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── The sandbox transport ─────────────────────────────────────────────────────

/** Test identities living in the sandbox — Luhn-valid national IDs that match the
 *  masked digits in each persona's employment record (Ahmed's file says 1•••••4821). */
export const SANDBOX_NINS: Record<PersonaId, string> = {
  ahmed: '1084634821',
  sara: '2047183377',
  khalid: '1069127734',
}

export type SourceId = 'bank' | 'openbanking' | 'wallet' | 'employment' | 'credit'

/** source key → sandbox provider route (api/sandbox.py PROVIDERS). */
const SOURCE_ROUTE: Record<SourceId, string> = {
  bank: 'bank-core',
  openbanking: 'open-banking',
  wallet: 'wallet',
  employment: 'employment',
  credit: 'credit-bureau',
}

/** Offline pacing — mirrors the sandbox's per-provider latency profile
 *  (api/sandbox.py PROVIDERS, restated in bankdash/appdata.ts CONNECTOR_LATENCY_MS). */
const LOCAL_LATENCY_MS: Record<SourceId, number> = {
  bank: 420,
  openbanking: 650,
  wallet: 380,
  employment: 300,
  credit: 340,
}

export type Transport = 'sandbox' | 'local'

export interface Retrieval<T> {
  payload: T
  /** 'sandbox' = served by the API over HTTP · 'local' = bundled fallback */
  transport: Transport
  /** the sandbox's request id (sbx_…) — null in offline mode */
  requestId: string | null
  ms: number
}

// Generous because prod is a serverless lambda: a COLD start (imports + persona
// synthesis) can take several seconds and must not flip the run to the offline
// fallback. A genuinely dead network still fails fast (connection error, not
// timeout), so the fallback remains immediate when it matters.
const FETCH_TIMEOUT_MS = 10_000

async function sandboxGet(path: string): Promise<Record<string, any>> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/sandbox/v1${path}`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`sandbox HTTP ${res.status}`)
    return (await res.json()) as Record<string, any>
  } finally {
    clearTimeout(timer)
  }
}

/** Fire-and-forget lambda warm-up — call when the financing flow opens so the
 *  serverless API is hot before the processing screen's real retrievals begin.
 *  The home route carries no artificial latency; failures are silently ignored
 *  (the per-call fallback handles a dead network on its own). */
export function warmSandbox(): void {
  sandboxGet('').catch(() => {})
}

/** One consented source over real HTTP; bundled fallback keeps the same pacing. */
export async function retrieveSource<S extends SourceId>(
  id: PersonaId, source: S,
): Promise<Retrieval<RawSet[S]>> {
  const t0 = performance.now()
  try {
    const env = await sandboxGet(`/${SOURCE_ROUTE[source]}/${SANDBOX_NINS[id]}`)
    return {
      payload: env.data as RawSet[S],
      transport: 'sandbox',
      requestId: (env.request_id as string) ?? null,
      ms: Math.round(performance.now() - t0),
    }
  } catch {
    await latency(LOCAL_LATENCY_MS[source])
    return { payload: RAW_SETS[id][source], transport: 'local', requestId: null, ms: Math.round(performance.now() - t0) }
  }
}

/** Identity verification — the journey's first real call (KYC-shaped, not underwriting). */
export async function verifyIdentity(id: PersonaId): Promise<Retrieval<{ verified: boolean }>> {
  const t0 = performance.now()
  try {
    const env = await sandboxGet(`/identities/${SANDBOX_NINS[id]}`)
    return {
      payload: { verified: Boolean(env.verified) },
      transport: 'sandbox',
      requestId: (env.request_id as string) ?? null,
      ms: Math.round(performance.now() - t0),
    }
  } catch {
    await latency(240)
    return { payload: { verified: true }, transport: 'local', requestId: null, ms: Math.round(performance.now() - t0) }
  }
}

/** The five connectors for one applicant, callable independently (spec §16.3).
 *  A known persona's set goes through the sandbox; an arbitrary RawSet stays local. */
export function connectorsFor(raw: RawSet) {
  const id = (Object.keys(RAW_SETS) as PersonaId[]).find((k) => RAW_SETS[k] === raw)
  const via = <S extends SourceId>(source: S): Promise<RawSet[S]> =>
    id ? retrieveSource(id, source).then((r) => r.payload)
       : latency(LOCAL_LATENCY_MS[source]).then(() => raw[source])
  return {
    bank: () => via('bank'),
    openbanking: () => via('openbanking'),
    wallet: () => via('wallet'),
    employment: () => via('employment'),
    credit: () => via('credit'),
  }
}

/** The five connectors, callable independently (spec §16.3 "independent data connectors"). */
export const connectors = connectorsFor(RAW)

function countsFor(raw: RawSet) {
  return {
    bank: raw.bank.transactions.length,
    openbanking: raw.openbanking.transactions.length,
    wallet: raw.wallet.transactions.length,
    accounts: 3,
    total: raw.bank.transactions.length + raw.openbanking.transactions.length + raw.wallet.transactions.length,
  }
}

/** Row counts for the processing screen annotations. */
export const RAW_COUNTS = countsFor(RAW)

// ── The three demo applicants (spec §10) ─────────────────────────────────────

export interface Persona {
  id: PersonaId
  nameAr: string
  nameEn: string
  /** the five raw connector payloads, unprocessed */
  raw: RawSet
  /** the five connectors bound to this applicant's payloads */
  connectors: ReturnType<typeof connectorsFor>
  /** what derive.ts computed from `raw` */
  profile: Profile
  /** §10 verdict — COMPUTED from the profile, never assigned */
  decision: Decision
  reasonAr: string
  reasonEn: string
  /** 100% salary + 50% stable side income (spec §7) */
  eligibleIncome: number
  /** what this bank's own account can see on its own — the thin picture */
  bankOnlyIncome: number
  /** SAMA employee-cap room, unclamped: ≤ 0 is the decline signal itself */
  installmentRoom: number
  counts: ReturnType<typeof countsFor>
  /** one-line demo caption — why this applicant exists in the deck */
  noteAr: string
}

function persona(id: PersonaId, nameEn: string, noteAr: string): Persona {
  const raw = RAW_SETS[id]
  // Ahmed reuses the PROFILE derive.ts already computed — the same object
  // financeMath.ts serves the offers screen from — so `PERSONAS.ahmed.profile ===
  // AHMED` holds downstream instead of being a deeply-equal twin.
  const profile = raw === ahmedRaw ? PROFILE : deriveProfile(raw, nameEn)
  const verdict = decide(profile)
  return {
    id,
    nameAr: profile.name,
    nameEn,
    raw,
    connectors: connectorsFor(raw),
    profile,
    decision: verdict.decision,
    reasonAr: verdict.reasonAr,
    reasonEn: verdict.reasonEn,
    eligibleIncome: eligibleIncomeOf(profile),
    bankOnlyIncome: eligibleIncomeOf(profile, false),
    installmentRoom: installmentRoomOf(profile),
    counts: countsFor(raw),
    noteAr,
  }
}

/**
 * The three outcomes of §10, each DERIVED from its own raw datasets:
 *   ahmed  → approved — the fused picture covers the full 150,000 ask.
 *   sara   → declined — verified and stable, but 4,800 of obligations leave no
 *            room under the cap. The fusion still helped her (11,000 → 12,000);
 *            it just did not lie about the outcome.
 *   khalid → review — the employment source claims 16,000, the transactions show
 *            2 salary months out of 6 (9,500 and 17,600). Unreconcilable → human.
 */
export const PERSONAS: Record<PersonaId, Persona> = {
  ahmed: persona('ahmed', 'Ahmed Al-Qahtani', 'موافقة تلقائية — الصورة الكاملة تغطّي كامل المبلغ المطلوب'),
  sara: persona('sara', 'Sara Al-Shammari', 'رفض تلقائي — الالتزامات القائمة تتجاوز حد الاستقطاع النظامي'),
  khalid: persona('khalid', 'Khalid Al-Otaibi', 'مراجعة يدوية — بيانات التوظيف لا تطابق حركات الراتب'),
}

/** Stable order for any persona switcher: approved → declined → review. */
export const PERSONA_LIST: Persona[] = [PERSONAS.ahmed, PERSONAS.sara, PERSONAS.khalid]

/** `?persona=sara` — rehearsal/dev shortcut, defaults to Ahmed (spec §21). */
export function personaFromQuery(search: string = window.location.search): Persona {
  const q = new URLSearchParams(search).get('persona')
  return (q && (PERSONAS as Record<string, Persona | undefined>)[q]) || PERSONAS.ahmed
}

// Kept as named exports so a raw payload can be imported directly where needed.
export { ahmedRaw, saraRaw, khalidRaw, RAW_SETS }
