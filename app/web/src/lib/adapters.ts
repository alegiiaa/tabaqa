// Universal statement adapter — parse ANY bank/wallet export into the canonical
// `StatementRowInput` shape the API scores. This is the open-banking ingestion
// layer: one declarative profile per institution, plus a format detector that
// handles the real-world mess of Saudi statement exports —
//
//   · Arabic OR English headers (التاريخ/البيان/مدين/دائن ↔ date/details/debit/credit)
//   · preamble lines before the header row (account no., customer name, totals)
//   · comma / semicolon / tab / pipe delimiters
//   · Arabic-Indic digits (٠١٢٣) in dates and amounts
//   · signed amounts, debit/credit columns, or amount + type (دائن/مدين, CR/DR)
//   · DD/MM/YYYY, MM/DD/YYYY, ISO, "15 Mar 2026", Arabic month names
//   · Hijri years (1447/09/15 → Gregorian via the tabular Islamic calendar)
//   · thousands separators (1,000 / ١٬٠٠٠), currency tokens (SAR / ر.س), (500) negatives
//
// Pure functions, no React. The backend (`pipeline/ingest_csv.py`) receives only
// normalized rows: ISO dates, signed SAR amounts, fully-qualified sources.
import type { StatementRowInput } from './api'

export type CanonField =
  | 'date' | 'description' | 'amount' | 'debit' | 'credit'
  | 'balance' | 'type' | 'source' | 'counterparty_iban' | 'currency'

export interface DetectedStatement {
  rows: StatementRowInput[]
  /** Matched institutions.ts id ("alinma", "urpay", …) or null when unknown. */
  institutionId: string | null
  kind: 'bank' | 'wallet' | null
  /** Human-readable format fingerprint, e.g. "Arabic headers · debit/credit · DD/MM/YYYY". */
  formatLabel: string
  /** canonical field → the original header it was matched from. */
  mapping: Partial<Record<CanonField, string>>
  warnings: string[]
  skipped: number
  dateRange: [string, string] | null
  fileName?: string
}

// ── digit + header normalization ─────────────────────────────────────────────

/** Arabic-Indic (٠-٩) and Eastern Arabic (۰-۹) digits → ASCII. */
export function toAsciiDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
}

const normHeader = (h: string): string =>
  toAsciiDigits(h)
    .toLowerCase()
    .replace(/[_.:#()[\]"'،؛]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Synonym table — the format knowledge base. Extending coverage to a new
// institution's export is adding strings here (or a fingerprint below).
const SYNONYMS: Record<CanonField, string[]> = {
  date: [
    'date', 'transaction date', 'trans date', 'value date', 'posting date',
    'post date', 'datetime', 'timestamp', 'time',
    'التاريخ', 'تاريخ', 'تاريخ العملية', 'تاريخ الحركة', 'تاريخ المعاملة', 'التاريخ الميلادي',
  ],
  description: [
    'description', 'details', 'transaction details', 'statement details',
    'narrative', 'narration', 'memo', 'particulars', 'remarks', 'raw_desc', 'merchant',
    'البيان', 'الوصف', 'التفاصيل', 'تفاصيل العملية', 'وصف العملية', 'الشرح',
  ],
  debit: [
    'debit', 'debit amount', 'withdrawal', 'withdrawals', 'money out', 'paid out',
    'مدين', 'سحب', 'خصم', 'مسحوبات', 'مبلغ مدين',
  ],
  credit: [
    'credit', 'credit amount', 'deposit', 'deposits', 'money in', 'paid in',
    'دائن', 'إيداع', 'ايداع', 'إضافة', 'اضافة', 'مبلغ دائن',
  ],
  balance: [
    'balance', 'running balance', 'available balance', 'closing balance',
    'الرصيد', 'رصيد', 'الرصيد المتاح', 'الرصيد المتوفر',
  ],
  type: [
    'type', 'transaction type', 'txn type', 'dr cr', 'cr dr', 'debit credit',
    'نوع', 'نوع العملية', 'نوع الحركة', 'نوع المعاملة',
  ],
  source: ['source', 'account', 'account type', 'channel', 'المصدر', 'الحساب', 'القناة'],
  counterparty_iban: [
    'counterparty_iban', 'counterparty iban', 'iban', 'beneficiary iban', 'sender iban',
    'آيبان', 'ايبان', 'الآيبان', 'الايبان',
  ],
  currency: ['currency', 'ccy', 'العملة', 'عملة'],
  // amount is matched LAST (see order below) so "debit amount" wins as debit.
  amount: [
    'amount', 'transaction amount', 'txn amount', 'value', 'amount sar',
    'المبلغ', 'مبلغ', 'مبلغ العملية', 'القيمة', 'المبلغ ر س',
  ],
}
// includes-matching order: specific fields before the generic `amount`.
const MATCH_ORDER: CanonField[] = [
  'counterparty_iban', 'debit', 'credit', 'balance', 'type', 'date',
  'description', 'source', 'currency', 'amount',
]

// ── institution fingerprints (wallets before banks: most-specific tokens win) ─
const FINGERPRINTS: { id: string; kind: 'bank' | 'wallet'; re: RegExp }[] = [
  { id: 'urpay', kind: 'wallet', re: /urpay|يورباي/i },
  { id: 'stcpay', kind: 'wallet', re: /stc[ _-]?pay/i },
  { id: 'barq', kind: 'wallet', re: /\bbarq\b|محفظة برق/i },
  { id: 'stcbank', kind: 'bank', re: /stc[ _-]?bank|بنك stc/i },
  { id: 'alinma', kind: 'bank', re: /alinma|الإنماء|الانماء/i },
  { id: 'alrajhi', kind: 'bank', re: /rajhi|الراجحي/i },
  { id: 'snb', kind: 'bank', re: /\bsnb\b|alahli|الأهلي|الاهلي/i },
  { id: 'riyad', kind: 'bank', re: /riyad ?bank|بنك الرياض/i },
  { id: 'sab', kind: 'bank', re: /\bsab\b|saudi awwal|البنك الأول/i },
  { id: 'albilad', kind: 'bank', re: /albilad|بنك البلاد/i },
  { id: 'anb', kind: 'bank', re: /\banb\b|العربي الوطني/i },
  { id: 'bsf', kind: 'bank', re: /\bbsf\b|alfransi|السعودي الفرنسي/i },
  { id: 'd360', kind: 'bank', re: /d360|دي ?360/i },
]

// ── low-level CSV mechanics ───────────────────────────────────────────────────

/** Split one line on `delim`, honoring quoted fields and "" escapes. */
function splitLine(line: string, delim: string): string[] {
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
    else if (ch === delim) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

function countOutsideQuotes(line: string, ch: string): number {
  let n = 0
  let q = false
  for (const c of line) {
    if (c === '"') q = !q
    else if (c === ch && !q) n++
  }
  return n
}

/** Pick the delimiter with the highest consistent count across the first lines. */
function detectDelimiter(lines: string[]): string {
  const cands = [',', ';', '\t', '|']
  let best = ','
  let bestScore = 0
  for (const d of cands) {
    const score = lines.slice(0, 8).reduce((s, l) => s + countOutsideQuotes(l, d), 0)
    if (score > bestScore) { bestScore = score; best = d }
  }
  return best
}

// ── header-row discovery ─────────────────────────────────────────────────────

function matchHeaderCells(cells: string[]): Partial<Record<CanonField, number>> {
  const map: Partial<Record<CanonField, number>> = {}
  const used = new Set<number>()
  const normed = cells.map(normHeader)
  // pass 1 — exact synonym match
  for (const field of MATCH_ORDER) {
    for (let i = 0; i < normed.length; i++) {
      if (used.has(i) || !normed[i]) continue
      if (SYNONYMS[field].includes(normed[i])) { map[field] = i; used.add(i); break }
    }
  }
  // pass 2 — substring match (handles "Transaction Date (Gregorian)", "Amount (SAR)")
  for (const field of MATCH_ORDER) {
    if (map[field] !== undefined) continue
    for (let i = 0; i < normed.length; i++) {
      if (used.has(i) || !normed[i]) continue
      if (SYNONYMS[field].some((syn) => normed[i].includes(syn))) { map[field] = i; used.add(i); break }
    }
  }
  return map
}

const headerScore = (map: Partial<Record<CanonField, number>>): number => {
  let s = Object.keys(map).length
  // a real header row has a date and some money column
  if (map.date === undefined) s -= 2
  if (map.amount === undefined && map.debit === undefined && map.credit === undefined) s -= 2
  return s
}

// ── date parsing ─────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'ابريل': 4, 'مايو': 5, 'يونيو': 6,
  'يوليو': 7, 'أغسطس': 8, 'اغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'اكتوبر': 10,
  'نوفمبر': 11, 'ديسمبر': 12,
}

const monthFromName = (name: string): number | undefined =>
  MONTHS[name.toLowerCase().slice(0, 3)] ?? MONTHS[name]

/** Tabular Islamic (civil) → Gregorian, via Julian Day. Accurate to ±1 day —
 *  immaterial for monthly cash-flow features. */
function hijriToGregorian(hy: number, hm: number, hd: number): { y: number; m: number; d: number } {
  const jd =
    Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm -
    Math.floor((hm - 1) / 2) + hd + 1948440 - 385
  let l = jd + 68569
  const n = Math.floor((4 * l) / 146097)
  l = l - Math.floor((146097 * n + 3) / 4)
  const i = Math.floor((4000 * (l + 1)) / 1461001)
  l = l - Math.floor((1461 * i) / 4) + 31
  const j = Math.floor((80 * l) / 2447)
  const d = l - Math.floor((2447 * j) / 80)
  l = Math.floor(j / 11)
  const m = j + 2 - 12 * l
  const y = 100 * (n - 49) + i + l
  return { y, m, d }
}

const isHijriYear = (y: number): boolean => y >= 1300 && y < 1500

interface ParsedDate { y: number; m: number; d: number; ambiguous?: boolean; a?: number; b?: number }

/** First-pass parse of one date cell — numeric triples stay order-ambiguous. */
function parseDateCell(raw: string): ParsedDate | null {
  const s = toAsciiDigits(String(raw ?? '')).trim()
  if (!s) return null
  let m: RegExpMatchArray | null
  // ISO / year-first: 2026-03-15, 2026/03/15, 1447-09-15
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)))
    return { y: +m[1], m: +m[2], d: +m[3] }
  if ((m = s.match(/^(\d{4})-(\d{1,2})$/)))                      // YYYY-MM → first of month
    return { y: +m[1], m: +m[2], d: 1 }
  // numeric triple: 15/03/2026, 03-15-26, 15.03.1447 — order resolved later
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    let y = +m[3]
    if (y < 100) y += y < 70 ? 2000 : 1900
    return { y, m: 0, d: 0, ambiguous: true, a: +m[1], b: +m[2] }
  }
  // textual: "15 Mar 2026" / "15 مارس 2026"
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z؀-ۿ]+),?\s+(\d{2,4})$/))) {
    const mon = monthFromName(m[2])
    if (mon) return { y: +m[3] < 100 ? 2000 + +m[3] : +m[3], m: mon, d: +m[1] }
  }
  // textual: "Mar 15, 2026"
  if ((m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/))) {
    const mon = monthFromName(m[1])
    if (mon) return { y: +m[3] < 100 ? 2000 + +m[3] : +m[3], m: mon, d: +m[2] }
  }
  return null
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

// ── amount parsing ───────────────────────────────────────────────────────────

/** Parse a money cell: Arabic digits, ر.س/SAR tokens, ١٬٠٠٠ separators, ٫ decimal,
 *  (500) and trailing-minus negatives, CR/DR suffixes. */
export function parseAmountCell(raw: unknown): number | undefined {
  let s = toAsciiDigits(String(raw ?? '')).trim()
  if (!s) return undefined
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  if (/(^|\s)dr\.?$/i.test(s)) neg = true
  s = s.replace(/(^|\s)(dr|cr)\.?$/i, '')
  s = s.replace(/sar|sr\b|ر\.?\s?س\.?|ريال/gi, '')
  s = s.replace(/[٬,\s]/g, '').replace(/٫/g, '.').replace(/−/g, '-')
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1) }
  if (s === '' || s === '-') return undefined
  const v = parseFloat(s)
  if (!Number.isFinite(v)) return undefined
  return neg ? -Math.abs(v) : v
}

const CREDIT_WORDS = new Set(['credit', 'cr', 'in', 'deposit', 'incoming', 'دائن', 'إيداع', 'ايداع', 'وارد', 'إضافة', 'اضافة'])
const DEBIT_WORDS = new Set(['debit', 'dr', 'out', 'withdrawal', 'outgoing', 'purchase', 'مدين', 'سحب', 'خصم', 'صادر', 'شراء'])

// ── the detector ─────────────────────────────────────────────────────────────

export function detectStatement(
  text: string,
  opts: { fileName?: string; fallbackSource?: string } = {},
): DetectedStatement {
  const warnings: string[] = []
  const empty: DetectedStatement = {
    rows: [], institutionId: null, kind: null, formatLabel: '', mapping: {},
    warnings, skipped: 0, dateRange: null, fileName: opts.fileName,
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!lines.length) { warnings.push('empty file'); return empty }

  const delim = detectDelimiter(lines)

  // find the header row: best-scoring line among the first 12 (skips preambles)
  let headerIdx = 0
  let headerMap: Partial<Record<CanonField, number>> = {}
  let bestScore = -Infinity
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const map = matchHeaderCells(splitLine(lines[i], delim))
    const score = headerScore(map)
    if (score > bestScore) { bestScore = score; headerIdx = i; headerMap = map }
  }
  const headerCells = splitLine(lines[headerIdx], delim)
  if (bestScore < 2) warnings.push('header row not confidently identified')
  if (headerMap.date === undefined) { warnings.push('no date column found'); return empty }
  if (headerMap.description === undefined) warnings.push('no description column found')
  if (headerMap.amount === undefined && headerMap.debit === undefined && headerMap.credit === undefined) {
    warnings.push('no amount / debit / credit column found')
    return empty
  }

  // institution fingerprint — filename + preamble + header only (never txn rows,
  // so a "تحويل إلى برق" transaction can't mislabel the whole file)
  const fpTarget = `${opts.fileName ?? ''}\n${lines.slice(0, headerIdx + 1).join('\n')}`
  const fp = FINGERPRINTS.find((f) => f.re.test(fpTarget))
  const institutionId = fp?.id ?? null
  const kind = fp?.kind ?? null

  const mapping: Partial<Record<CanonField, string>> = {}
  for (const [field, idx] of Object.entries(headerMap) as [CanonField, number][])
    mapping[field] = (headerCells[idx] ?? '').trim()

  const dataLines = lines.slice(headerIdx + 1)
  const cellRows = dataLines.map((l) => splitLine(l, delim))
  const cell = (cells: string[], field: CanonField): string =>
    headerMap[field] !== undefined ? (cells[headerMap[field]!] ?? '').trim() : ''

  // resolve DD/MM vs MM/DD across the whole file (Saudi default: day-first)
  const parsed = cellRows.map((c) => parseDateCell(cell(c, 'date')))
  let dayFirst = true
  const ambiguous = parsed.filter((p): p is ParsedDate => !!p?.ambiguous)
  if (ambiguous.some((p) => p.a! > 12)) dayFirst = true
  else if (ambiguous.some((p) => p.b! > 12)) dayFirst = false

  let usedHijri = false
  const toIso = (p: ParsedDate | null): string | null => {
    if (!p) return null
    let { y, m, d } = p
    if (p.ambiguous) { d = dayFirst ? p.a! : p.b!; m = dayFirst ? p.b! : p.a! }
    if (isHijriYear(y)) { ({ y, m, d } = hijriToGregorian(y, m, d)); usedHijri = true }
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    return `${y}-${pad2(m)}-${pad2(d)}`
  }

  const defaultSource =
    institutionId ? `${kind}:${institutionId}` : (opts.fallbackSource ?? 'bank')
  const normSourceCell = (raw: string): string => {
    const s = toAsciiDigits(raw).trim().toLowerCase()
    if (!s) return defaultSource
    if (s.startsWith('bank:') || s.startsWith('wallet:')) return s
    if (s === 'bank' || s === 'b' || s === 'بنك') return institutionId && kind === 'bank' ? `bank:${institutionId}` : 'bank'
    if (s === 'wallet' || s === 'w' || s === 'محفظة') return institutionId && kind === 'wallet' ? `wallet:${institutionId}` : 'wallet'
    return defaultSource
  }

  // convention: explicit debit/credit columns > type column > signed amount
  const hasDC = headerMap.debit !== undefined || headerMap.credit !== undefined
  const hasType = headerMap.type !== undefined && headerMap.amount !== undefined

  const rows: StatementRowInput[] = []
  let skipped = 0
  cellRows.forEach((cells, i) => {
    const date = toIso(parsed[i])
    const description = cell(cells, 'description')
    if (!date || !description) { skipped++; return }

    let amount: number | undefined
    if (hasDC) {
      const credit = parseAmountCell(cell(cells, 'credit'))
      const debit = parseAmountCell(cell(cells, 'debit'))
      if (credit) amount = Math.abs(credit)
      else if (debit) amount = -Math.abs(debit)
    } else {
      amount = parseAmountCell(cell(cells, 'amount'))
      if (amount !== undefined && hasType) {
        const t = cell(cells, 'type').toLowerCase()
        if (CREDIT_WORDS.has(t)) amount = Math.abs(amount)
        else if (DEBIT_WORDS.has(t)) amount = -Math.abs(amount)
      }
    }
    if (amount === undefined || amount === 0) { skipped++; return }

    const balance = parseAmountCell(cell(cells, 'balance'))
    const iban = toAsciiDigits(cell(cells, 'counterparty_iban')).replace(/\s/g, '') || undefined
    rows.push({
      date, description, amount,
      source: normSourceCell(cell(cells, 'source')),
      counterparty_iban: iban,
      ...(balance !== undefined ? { balance } : {}),
    })
  })

  if (skipped) warnings.push(`${skipped} row(s) skipped (unparseable date/amount or blank description)`)
  if (!hasDC && !hasType && rows.length > 2 && rows.every((r) => (r.amount ?? 0) > 0))
    warnings.push('all amounts are positive — add a debit column or type column if some rows are outflows')

  // format fingerprint for the UI chip
  const arabicHeaders = Object.values(mapping).some((h) => /[؀-ۿ]/.test(h ?? ''))
  const convention = hasDC ? 'debit/credit' : hasType ? 'amount + type' : 'signed amount'
  const dateStyle = ambiguous.length
    ? (dayFirst ? 'DD/MM/YYYY' : 'MM/DD/YYYY')
    : parsed.some((p) => p && !p.ambiguous) ? 'ISO/textual dates' : ''
  const bits = [
    arabicHeaders ? 'Arabic headers' : 'English headers',
    convention,
    dateStyle,
    usedHijri ? 'Hijri→Gregorian' : '',
    delim !== ',' ? (delim === '\t' ? 'tab-separated' : `"${delim}"-separated`) : '',
  ].filter(Boolean)

  const dates = rows.map((r) => r.date).sort()
  return {
    rows,
    institutionId,
    kind,
    formatLabel: bits.join(' · '),
    mapping,
    warnings,
    skipped,
    dateRange: dates.length ? [dates[0], dates[dates.length - 1]] : null,
    fileName: opts.fileName,
  }
}

/** Merge several detected files into one chronologically-sorted row set —
 *  the multi-source fusion input (each row already carries its own source). */
export function mergeStatements(files: DetectedStatement[]): StatementRowInput[] {
  return files
    .flatMap((f) => f.rows)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
