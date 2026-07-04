# طبقة · Tabaqa — Competitive Landscape & the Innovation Claim (verified 2026-07-04)

> Two adversarially-verified research passes (~90 global + ~60 GCC sources, EN+AR, refutation
> agents included). This file exists so the innovation claim is **exact** — the dead claims below
> are one judge-Google away from killing a sloppier pitch. AMAD's host is **Alinma**; Lean's case
> studies are public; assume the judges know the KSA landscape.
> Companions: [`EVIDENCE.md`](./EVIDENCE.md) · [`JUDGE_SCRIPT.md`](./JUDGE_SCRIPT.md)

---

## ☠️ DEAD CLAIMS — never say these

| Claim | Killed by (verified) |
|---|---|
| "Nobody does cash-flow underwriting in KSA" | **Tamara** ×Lean: live, **"+32% approval rates"**, gig workers (Lean case study, Apr 2026) · **Tamam** (Zain): live OB risk scoring via Lean · **Tabby**: Lean-enhanced + SAMA consumer/SME licences (Jun 29, 2026) |
| "Nobody parses Arabic bank statements with AI" | **Abwab.ai** (Riyadh): Arabic/EN/mixed-RTL statement parsing, SAR 1B+ MSME loans, 12+ lenders, integrates Lean+Tarabut |
| "First AI credit model on open banking in Saudi" | **Tamam×ZainTECH×FICO×Lean** claimed that title publicly (Oct 2024; announced) — Tamam's basic OB scoring is live regardless |
| "First cash-flow score" (globally) | Commodity: **next-gen UltraFICO GA May 2026** on Plaid rails · Experian Cashflow Score (Mar 2025) · Prism CashScore ("millions of decisions") · Nova NSCF (Chase, PayPal) |
| "First transparent score shown to the person" | **SCHUFA (Germany, live Mar 17, 2026)**: 12 named criteria, published points, consumer-recomputable — *bureau data only, zero cash flow* |
| "First improvement coaching" | Zopa Borrowing Power · Path to Apple Card · TotallyMoney — all band/task-level, none numeric-counterfactual, none on cash-flow |
| "First signed decision document" | **RBI India mandates PKI-signed sanction letters** for all digital loans since Sept 2022. Say ours is "designed for third-party QR verification" |
| "Recourse guarantees approval" | Never — LendUp/Credit Karma enforcement precedents. Always "indicative, re-scored on verified data" |

## ✅ THE WHITE SPACE — survived ~15 refutation passes (EN+AR, all six GCC states)

Nobody found, anywhere in KSA/GCC — and for #2–#4 almost nowhere on earth — a product shipping:

1. **Decision-linked transparency + recourse on cash-flow data.** Every KSA implementation is a black box inside one lender's book (Tamam's own FAQ: rejections "based on the product policy"; Tamara's "second look" = one-shot opaque re-score). Regional applicant-facing inventory tops out at AECB's bureau-data score simulator (generic tips) and MOLIM's disputes page.
2. **Bank + wallet fusion.** Zero vendors ingest wallet/stored-value transactions — not Tabby (owns Tweeq), not stc bank (owns stc pay). Bank AIS only, everywhere.
3. **A consumer-facing data-sufficiency band on the score.** Zero consumer precedent globally. (Nova Credit's `LIMITED_DATA_AVAILABLE_INDICATOR` is lender-API-only — validates the concept, proves nobody shows the human.)
4. **In-product model governance** (model card + drift monitor + validation metrics rendered in the product). Nobody. Nearest: Belvo's marketing page ("AUC of 74%"), VantageScore's annual PDFs — all off-product.
5. **An independent consumer scoring layer any lender can consume.** Abwab owns the SME lender-side version; the consumer equivalent exists only as dormant announcements (Qarar×Tarabut, May 2023 — nothing shipped in 3+ years; Lean×Synapse/Konan, Sept 2025 — no KSA deployment named). Watch: **Tarabut acquired Servable (Jan 2026)** explicitly to add credit-risk assessment — the most likely future platform rival.

## 🎯 THE LOCKED INNOVATION CLAIM

> **"تمارا أثبتت أن التدفق النقدي يرفع الموافقات ٣٢٪ — ونحترم ذلك. لكن كل تطبيق في المملكة صندوق أسود
> داخل دفتر مقرضٍ واحد. لا أحد في السعودية أو الخليج — بل بعد فحص أربعين منتجًا عالميًا، لا أحد تقريبًا
> في العالم — يوجّه الدرجة نحو المتقدّم نفسه: لماذا، وماذا يغيّر القرار، وكم من البيانات تكفي.
> التقييم يُمارَس على الناس منذ خمسين عامًا. طبقة تمارسه معهم."**

EN: "Tamara proved cash-flow lifts approvals 32% — we respect that. But every implementation in
the Kingdom is a black box inside one lender's book. Nobody in Saudi or the Gulf — and after
checking ~40 products across four continents, almost nobody on earth — turns the score toward the
applicant: the why, the what-would-change-it, the how-much-data-is-enough. Scoring has been done
TO people for fifty years. Tabaqa does it WITH them."

**Why this framing is strong:** competitors doing the mechanism = market validation (Tamara's +32%
becomes OUR evidence); the inversion (lender-facing → applicant-facing) is the innovation; and SAMA's
own Open Banking Policy promises open banking "will expand access to credit" — we ship the layer the
regulator described and nobody delivered.

## Key intel

- **AMAD edition 2: July 16–18, 2026** (Alinma × Tuwaiq), SAR 500K prizes, official **Open Banking track** ("integrating and analyzing financial data from multiple sources"). No prior credit-scoring winner found.
- The Financial Academy (SAMA/CMA) hackathon lists "integrating non-traditional data … into credit assessment models" as a sanctioned use case — the ecosystem officially asked for this.
- **Re-check the week of the hackathon:** Tamam×FICO launch status · Tarabut/Servable news · Qarar (qarar.ai) — a quiet Arabic-only launch cannot be 100% excluded (simah.com/molim.sa are bot-walled).

*Created 2026-07-04. Sources: Lean case studies & blog, Arab News, Zawya, Abwab.ai, SCHUFA (via Verbraucherzentrale/Finanztip), RBI/2022-23/111, prismdata.com, plaid.com/check, Experian PR, docs.novacredit.com, tarabut.com, synapse-analytics.io, getfocal.ai, tamam.life. Primary URLs preserved in the research transcripts.*
