// Realistic sample exports for the universal adapter demo — one Arabic bank
// e-statement + one English wallet export, deliberately in DIFFERENT formats
// (headers, digits, date styles, sign conventions) to show the adapter
// normalizing both into one canonical ledger. Economics mirror the Fahd story:
// 4,000 SAR visible bank salary + ~6,000 SAR/month of wallet gig income.
import { SAMPLE_IBAN } from './csv'

// Alinma-style e-statement: Arabic headers, preamble lines before the header,
// debit/credit columns, DD/MM/YYYY with mixed Arabic-Indic digits, quoted
// thousands separators, and a post-transaction running balance (opening 8,000
// is backed out from the first row: 7,200 + 800).
export const SAMPLE_ALINMA_CSV = `كشف حساب - مصرف الإنماء
رقم الحساب:,SA4405000068200000001234
التاريخ,البيان,مدين,دائن,الرصيد,الآيبان المقابل
٠٥/٠٣/٢٠٢٦,قسط تمويل عقاري,800,,"7,200",
12/03/2026,مدى - بنده الرياض,600,,"6,600",
27/03/2026,راتب - شركة الأفق للتجارة,,"4,000","10,600",${SAMPLE_IBAN}
05/04/2026,قسط تمويل عقاري,800,,"9,800",
12/04/2026,مدى - بنده الرياض,600,,"9,200",
27/04/2026,راتب - شركة الأفق للتجارة,,"4,000","13,200",${SAMPLE_IBAN}
05/05/2026,قسط تمويل عقاري,800,,"12,400",
12/05/2026,مدى - بنده الرياض,600,,"11,800",
27/05/2026,راتب - شركة الأفق للتجارة,,"4,000","15,800",${SAMPLE_IBAN}
`

// urpay-style wallet export: English headers, textual dates, all-positive
// amounts signed by a Type column, plus an extra Status column the adapter
// must ignore.
export const SAMPLE_URPAY_CSV = `urpay Wallet Statement
Date,Transaction Details,Amount (SAR),Type,Status
15 Mar 2026,JAHEZ-RYD دفعة,"2,600.00",Credit,Completed
18 Mar 2026,تحويل من عبدالله,800.00,Credit,Completed
22 Mar 2026,HUNGERSTATION SA,"2,600.00",Credit,Completed
15 Apr 2026,JAHEZ-RYD دفعة,"2,700.00",Credit,Completed
18 Apr 2026,تحويل من عبدالله,800.00,Credit,Completed
22 Apr 2026,HUNGERSTATION SA,"2,500.00",Credit,Completed
15 May 2026,JAHEZ-RYD دفعة,"2,550.00",Credit,Completed
18 May 2026,تحويل من عبدالله,800.00,Credit,Completed
22 May 2026,HUNGERSTATION SA,"2,650.00",Credit,Completed
`

/** The two files as they'd arrive from a file picker. */
export const SAMPLE_EXPORTS: { fileName: string; text: string }[] = [
  { fileName: 'alinma-estatement.csv', text: SAMPLE_ALINMA_CSV },
  { fileName: 'urpay-wallet-export.csv', text: SAMPLE_URPAY_CSV },
]

/** Verification context matching the sample exports (unlocks the Masdr tiers). */
export const SAMPLE_EXPORT_CONTEXT = {
  name: 'Fahd A. (sample)',
  employer: 'شركة الأفق للتجارة',
  salaryIban: SAMPLE_IBAN,
  monthlyWage: '4000',
  gigPlatforms: 'Jahez, HungerStation',
  bankOpening: '8000',
  walletOpening: '300',
}
