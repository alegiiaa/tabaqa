# طبقة · Tabaqa — UI Spec

**Brand:** primary **violet/purple** + gold accents. Motif = **layers peeling back to reveal** (the "Tabaqa/Layer"). **Arabic-first, RTL**, EN toggle (`AR | EN`). Dashboard style — clean cards, generous whitespace, lender-grade (not consumer-cute).

Four screens. Screen ② is the demo climax.

---

## ① Connect accounts · ربط الحسابات

```
┌────────────────────────────────────────────┐
│  طبقة · Tabaqa                    [AR | EN]  │
│                                              │
│   لنبنِ صورة مالية كاملة لك                   │
│   (Let's build a complete financial picture) │
│   ┌──────────────┐   ┌──────────────┐        │
│   │ 🏦 الحساب البنكي│   │ 👛 المحفظة الرقمية│   │
│   │  ربط (AIS)    │   │  ربط محفظة برق  │      │
│   │  [ربط الحساب →]│   │  [ربط المحفظة →]│     │
│   └──────────────┘   └──────────────┘        │
│   ● تم ربط البنك      ○ جاري ربط المحفظة…     │
│   بياناتك آمنة ومشفّرة — نستخدم موافقتك فقط    │
└────────────────────────────────────────────┘
```
- Left: the layered-crystal motif (3D violet layers).
- Trust line at the bottom (consent-based).
- ⚠️ The Barq connect is the **gated assumption** — for the demo it's consented/sandbox data.

## ② The Reveal · الكشف (المال الحقيقي) — the money screen

```
┌────────────────────────────────────────────┐
│  فهد ال…   ****1234        الدخل الحقيقي ✓ مُتحقق│
│                                              │
│   العرض البنكي فقط        عرض طبقة            │
│   ┌─────────────┐  ──▶  ┌─────────────┐       │
│   │ SAR 4,000   │       │ SAR 10,000  │ ✓     │
│   │ الراتب فقط   │       │ +6,000 اكتُشفت│      │
│   └─────────────┘       └─────────────┘       │
│                                              │
│   من أين جاءت الـ 6,000 الخفية؟               │
│   • Jahez      دخل عمل حر  2,800  ✓ مصدر-موثّق │
│   • HungerStn  دخل عمل حر  2,400  ✓ مصدر-موثّق │
│   • تحويل P2P   متكرر        800  ~ مُستنتج    │
│                                              │
│   تحويل "برق" الذي رآه البنك = أموال انتقلت    │
│   داخل المحفظة، وليست إنفاقًا — تمت مطابقته     │
│   ولم يُحتسب مرتين.                            │
└────────────────────────────────────────────┘
```

**Corrected Arabic strings (drop-in — fixes the garbled mockup text):**
- Reconciliation caption:
  > «تحويل "برق" الذي رآه البنك = أموال انتقلت **داخل المحفظة**، وليست إنفاقًا — تمت مطابقته ولم يُحتسب مرتين.»
- Verification tags (use the 3 tiers, **not** a blanket "✓Masdr"):
  - Salary → `✓ مبلغ موثّق` (amount-verified)
  - Gig (Jahez/HungerStation) → `✓ مصدر موثّق` (source-verified — the payer is a real Masdr establishment)
  - P2P → `~ مُستنتج` (inferred)

## ③ Unified transactions · المعاملات الموحّدة

Bank + wallet merged into one Arabic-cleaned table; each row provenance-tagged; hover shows raw→clean.

| التحقق | التصنيف | المبلغ (SAR) | المنبع | الوصف المنظّف | التاجر/الجهة | التاريخ |
|---|---|---|---|---|---|---|
| ✓ مصدر موثّق | دخل عمل حر | +2,800.00 | Wallet (Barq) | دخل عمل حر — جاهز | Jahez | 2025-06-18 |
| ✓ مصدر موثّق | دخل عمل حر | +2,400.00 | Wallet (Barq) | دخل عمل حر — هنقرستيشن | HungerStation | 2025-06-17 |
| ~ مُستنتج | تحويل شخصي | +800.00 | Wallet (Barq) | تحويل شخصي وارد | — | 2025-06-16 |
| ✓ مطابَق | تحويل داخلي | −3,000.00 | Bank (Alinma) | تحويل إلى برق (داخلي) | Barq 8842 | 2025-06-15 |
| تصنيف فقط | مشتريات | −156.25 | Bank (Alinma) | شراء — سوبر ماركت | سوبر ماركت | 2025-06-14 |

- Footer legend: `✓ مبلغ/مصدر موثّق = تم التحقق عبر Masdr` · `~ مُستنتج = بدون تحقق خارجي` · «مرّر الماوس لرؤية الوصف الأصلي».
- ⚠️ The supermarket row is **`تصنيف فقط`** (category-only) — **not** Masdr-verified. Masdr doesn't verify retail spend.

## ④ Profile API view · واجهة الـ API (ملف العميل)

What a lender actually consumes — proves "real product, not slideshow."

- **Donut: income summary** — راتب 4,000 (40%) · دخل عمل حر 5,200 (52%) · تحويلات شخصية 800 (8%) = **10,000**. (Numbers must stay consistent across all screens.)
- **Linked accounts** — Alinma (bank, active) · Barq (wallet, active).
- **Unified profile JSON:**
```json
{
  "user_id": "1234567890",
  "profile_date": "2025-06-18",
  "income_summary": {
    "total_monthly_income": 10000,
    "salary":     { "amount": 4000, "verification": "amount_verified", "via": "masdr:payslip",      "confidence": 0.98 },
    "gig_income": { "amount": 5200, "verification": "source_verified", "via": "masdr:establishment", "confidence": 0.92 },
    "p2p_inflows":{ "amount": 800,  "verification": "inferred",        "via": "none",                "confidence": 0.70 }
  },
  "accounts": [
    { "type": "bank",   "name": "Alinma", "status": "active" },
    { "type": "wallet", "name": "Barq",   "status": "active" }
  ],
  "metrics": { "affordability_score": 82, "verification_rate": 0.93, "data_confidence": 0.89 }
}
```
- **cURL** sample + "copy" button:
```
curl -X GET 'https://api.tabaqa.ai/v1/profile/1234567890' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Accept: application/json'
```
- Footer badge: **Open Banking Ready** · واجهات آمنة للمنشآت المالية وشركات التمويل.

---

## Cross-screen consistency rules (don't break these)
1. **The numbers reconcile everywhere:** 4,000 salary + 5,200 gig (2,800+2,400) + 800 P2P = **10,000** on the reveal, the table, the donut, and the JSON.
2. **Three verification tiers only** — `amount-verified` / `source-verified` / `inferred`. Never blanket-"Masdr". Never tag retail purchases as Masdr.
3. **"Mofeed" = Masdr's product** — never use it as the label for unverified rows.
4. Positioning stays on **wallet economy / data**, never **payment initiation**.
