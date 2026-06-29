// Self-contained Credit Report links.
//
// The /report and /verify pages work for ANY scored input by carrying the data in the
// link itself, so no server-side registry is needed. That matters on serverless: an
// in-memory "connection_id → profile" cache wouldn't survive across function instances,
// so a report minted on one request could 404 on the verify request. Instead:
//   • demo connections  → /report?c=<connection_id>   (re-fetched from the fixtures)
//   • uploaded/own data → /report?d=<base64url(StatementInput)>  (re-scored live)
// Both paths re-hit the live engine, so the document always matches the scorer.
import type { StatementInput } from './api'

function b64urlEncode(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeStatement(s: StatementInput): string {
  return b64urlEncode(JSON.stringify(s))
}

/** Throws if the payload is malformed — callers should catch and show an error. */
export function decodeStatement(p: string): StatementInput {
  return JSON.parse(b64urlDecode(p)) as StatementInput
}

/**
 * A compact, self-contained verification token — just the issued headline values.
 * Small enough (~190 chars) to ALWAYS fit a scannable QR, so the verify QR never
 * overflows no matter how large the uploaded statement is (a full statement in the
 * QR would throw and blank the report). Demo reports verify by re-fetching ?c=; own
 * data carries these issued facts via ?v=.
 */
export interface VerifyFacts {
  r: string   // reference
  n: string   // applicant name
  s: number   // tabaqa score
  pd: number  // probability of default
  rf: string  // risk flag
  ti: number  // true monthly income
  bo: number  // bank-only income
  vs: number  // verified income share
}

export function encodeFacts(f: VerifyFacts): string {
  return b64urlEncode(JSON.stringify(f))
}

export function decodeFacts(p: string): VerifyFacts {
  return JSON.parse(b64urlDecode(p)) as VerifyFacts
}

export interface ReportSource {
  connectionId?: string
  statement?: StatementInput
}

/** Where the "Verified report" button points — by connection (demo) or carried data (own). */
export function reportHref(src: ReportSource): string {
  if (src.connectionId) return `/report?c=${encodeURIComponent(src.connectionId)}`
  if (src.statement) return `/report?d=${encodeStatement(src.statement)}`
  return '/report'
}

/** Stable 6-char code (FNV-1a) from a string — the document reference for own-data reports. */
export function shortHash(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6)
}
