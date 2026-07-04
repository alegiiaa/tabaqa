// Dual-calendar dates for the ledger — Gregorian + Hijri (Umm al-Qura), the way a
// real Saudi bank statement reads. Latin digits in both languages (Saudi banking
// convention; matches the app's tabular numerals).
//
// Formatters are module-level singletons — Intl.DateTimeFormat construction is
// expensive and the ledger renders hundreds of rows.

const GREG_EN = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const GREG_AR = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' })
const HIJRI_EN = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'short', year: 'numeric' })
const HIJRI_AR = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })

export interface DualDate {
  greg: string
  hijri: string
}

/** Format an ISO date (or timestamp) as Gregorian + Hijri in the active language. */
export function dualDate(iso: string, arabic: boolean): DualDate {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { greg: iso.slice(0, 10), hijri: '' }
  return arabic
    ? { greg: GREG_AR.format(d), hijri: HIJRI_AR.format(d) }
    : { greg: GREG_EN.format(d), hijri: HIJRI_EN.format(d) }
}
