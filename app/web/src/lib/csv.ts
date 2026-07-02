// Shared CSV helpers for statement upload — used by the Applicants "new" flow
// and the Connect "use my own data" flow. Pure functions, no React.
import type { StatementRowInput } from './api'

export const SAMPLE_IBAN = 'SA0380000000608010167519'
export const SAMPLE_CSV = `date,description,amount,source,counterparty_iban
2026-03-05,قسط تمويل عقاري,-800,bank,
2026-03-12,مدى - بنده الرياض,-600,bank,
2026-03-27,راتب - شركة الأفق للتجارة,4000,bank,${SAMPLE_IBAN}
2026-03-15,JAHEZ-RYD دفعة,2600,wallet,
2026-03-18,تحويل من عبدالله,800,wallet,
2026-03-22,HUNGERSTATION SA,2600,wallet,
2026-04-05,قسط تمويل عقاري,-800,bank,
2026-04-12,مدى - بنده الرياض,-600,bank,
2026-04-27,راتب - شركة الأفق للتجارة,4000,bank,${SAMPLE_IBAN}
2026-04-15,JAHEZ-RYD دفعة,2700,wallet,
2026-04-18,تحويل من عبدالله,800,wallet,
2026-04-22,HUNGERSTATION SA,2500,wallet,
2026-05-05,قسط تمويل عقاري,-800,bank,
2026-05-12,مدى - بنده الرياض,-600,bank,
2026-05-27,راتب - شركة الأفق للتجارة,4000,bank,${SAMPLE_IBAN}
2026-05-15,JAHEZ-RYD دفعة,2550,wallet,
2026-05-18,تحويل من عبدالله,800,wallet,
2026-05-22,HUNGERSTATION SA,2650,wallet,
`

/** Split one CSV line, honoring quoted fields and "" escapes (RFC 4180-ish). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else q = false
      } else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

/** Parse raw CSV text into row objects keyed by lowercased header. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length)
  if (!lines.length) return []
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()))
    return row
  })
}

/** Parse a numeric cell, tolerating thousands separators; undefined if blank/NaN. */
export const num = (s?: string): number | undefined => {
  if (s === undefined || s === '') return undefined
  const v = parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(v) ? v : undefined
}

/** Map parsed CSV rows → the StatementRowInput shape the API expects. */
export function rowsToStatement(rows: Record<string, string>[]): StatementRowInput[] {
  return rows.map((r) => ({
    date: r.date || r.timestamp || '',
    description: r.description || r.raw_desc || '',
    amount: num(r.amount),
    debit: num(r.debit),
    credit: num(r.credit),
    source: r.source || '',
    counterparty_iban: r.counterparty_iban || undefined,
    balance: num(r.balance),
  }))
}
