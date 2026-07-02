# طبقة · Tabaqa — Proof & Evidence Pack

> **The judge-facing answer to "How is this a real problem, how big is it, and are you moving in the right direction?"**
>
> Every claim below is labelled **✅ Verified · 🟡 Partially verified · ❌ Refuted (do not use)**, with a source and date. KSA-first, with global studies used only to prove the underlying mechanism works. Generated from a multi-source deep-research pass with adversarial 3-vote fact-checking (23 of 25 claims survived; 2 were killed — they are in §6 so we never say them by accident).

**Companion docs:** [`README.md`](./README.md) (engineering reference) · [`PRD.md`](./PRD.md) (pitch) · [`VS_LEAN.md`](./VS_LEAN.md) (battle-card) · [`RESOURCES.md`](./RESOURCES.md) (OSS).

---

## 0. TL;DR — the five strongest, best-sourced proof points

Use these on stage. Each is verified to a primary or strong-secondary source.

1. **The gap is official, measured, and *behind target*.** Saudi Arabia's own Financial Sector Development Program (FSDP, under Vision 2030) set SME lending to reach **20% of bank credit by 2030**. The latest reported figure is **~9.4%** — and the program **missed its own 2025 interim milestone of 11%** (baseline was 5.7% in 2019). The constraint isn't ambition; it's the ability to *assess weak-file borrowers*. — *SAMA / FSDP 2024 Annual Report.* ✅

2. **Cash-flow data predicts default — this is independently proven, not a vendor pitch.** FinRegLab's multi-lender empirical study found cash-flow metrics are **as predictive of credit risk as traditional bureau scores**, and **adding cash-flow data to bureau data improves prediction**. Their 2025 follow-up showed models using machine learning + cash-flow data **expanded approvals by ~4% without raising defaults**. — *FinRegLab (independent non-profit).* ✅

3. **The income we unlock is real and enormous.** Saudi Arabia's freelance economy alone has **2.25M+ registered individuals** and contributed **~SAR 72.5bn (~USD 19bn)** — exactly the gig/freelance income that lands in wallets and outside traditional payroll. — *Saudi Press Agency / GASTAT.* ✅

4. **The regulatory rail just went live — we're early, not speculative.** SAMA granted its **first full open-banking Account Information (AIS) licenses on 26 March 2026** (Lean Technologies + New Tech Software), and SAMA's **Responsible Lending Principles codify income-based DBR caps** — which legally *require* a verified-income number to lend. Verified income is the input regulation now demands. — *SAMA Rulebook / SPA, Mar 2026.* ✅

5. **No one in KSA ships this yet — the closest players sell *data*, not a *decision*.** Tarabut and Drahim (65%-acquired by Al Rajhi, Sept 2024) return **verified-income / enrichment data**; SIMAH owns the **bureau** PD score. **None ships a productized cash-flow PD score.** (Watch-out: Tarabut's Jan 2026 Servable acquisition signals they're moving toward decisioning — the window is open, not infinite.) — *Tarabut docs, Al Rajhi, SAMA.* ✅

---

## 1. The problem is real, official, and quantified (KSA SME / thin-file gap)

| # | Claim | Status | Source (date) |
|---|---|---|---|
| 1.1 | The FSDP (Vision 2030) sets an **official target to raise SME financing to 20% of total bank credit by 2030**. | ✅ Verified | [SAMA FSDP 2024 Annual Report](https://www.sama.gov.sa/en-US/Documents/Financial_Sector_Development_Program_Annual_Report-2024-EN.pdf); [Vision 2030 FSDP Charter](https://www.vision2030.gov.sa/media/jxxnxpya/program-charter-2020-2025-fsdp-en.pdf) |
| 1.2 | The FSDP's **interim 2025 commitment was 11%** of bank credit to SMEs. | ✅ Verified | SAMA FSDP 2024 Annual Report |
| 1.3 | **As of end-2019 the baseline was 5.7%**, and the latest reported figure is **~9.4%** — i.e. the program is **behind its own interim target** (9.4% < 11%). | ✅ Verified | SAMA FSDP 2024 Annual Report; [Arab News](https://www.arabnews.com/node/2595556/business-economy) |
| 1.4 | The **SME finance gap across the Arab world / MENA is estimated at ~USD 123 billion**. | 🟡 Partially verified (2–1 vote; widely-cited IFC/SME Finance Forum estimate, regional not KSA-only) | [CGAP](https://www.cgap.org/blog/how-are-fintechs-tackling-arab-worlds-123b-sme-finance-gap) |
| 1.5 | SMEs are **~99% of registered Saudi establishments**. | 🟡 Widely cited (Monsha'at); not independently re-verified in this pass | Monsha'at / commonly reported |

**Why this framing wins:** the most powerful version of the problem is *not* "banks are mean to small businesses." It's **"the Saudi government wrote a number into law (20% by 2030), is measuring it, and is missing it — because lenders can't cheaply assess weak-file borrowers."** That is an institutional buyer with budget and a deadline. Tabaqa is the assessment layer that moves that KPI.

---

## 2. The mechanism works — cash-flow underwriting predicts default (global proof)

This is the part judges quietly doubt: *"does transaction data actually predict repayment, or is it hand-waving?"* The answer is independently established by **FinRegLab**, a non-profit research org (not a vendor), across real lenders.

| # | Claim | Status | Source |
|---|---|---|---|
| 2.1 | Cash-flow metrics are **at least as predictive of credit risk as traditional credit-bureau scores**. | ✅ Verified | [FinRegLab — Empirical Research Findings](https://finreglab.org/research/the-use-of-cash-flow-data-in-underwriting-credit-empirical-research-findings/) |
| 2.2 | **Adding cash-flow data to bureau data improves predictive performance** (the two are complementary, not redundant). | ✅ Verified | FinRegLab — Empirical Research Findings |
| 2.3 | FinRegLab's 2025 study: models using **machine learning + cash-flow data are the two strongest contributors** to better underwriting. | ✅ Verified | [FinRegLab — ML + Cash-Flow press release](https://finreglab.org/press-releases/finreglab-study-finds-improvements-in-consumer-underwriting-and-credit-access-from-models-using-machine-learning-and-cash-flow-data/) |
| 2.4 | The gains **expand credit access (~4% higher approvals) without increasing defaults** for tested populations. | ✅ Verified — *with honest nuance: the lift is attributed mainly to the ML modelling combined with cash-flow data, across six lenders.* | [FinRegLab — Advancing the Credit Ecosystem](https://finreglab.org/research/advancing-the-credit-ecosystem-machine-learning-cash-flow-data-in-consumer-underwriting/) |
| 2.5 | **Experian's Cashflow Score is a live, commercial product** that predicts the likelihood of serious delinquency (60+ dpd) using bank-transaction data. | ✅ Verified (product exists & predicts delinquency) | [Experian Cashflow Score](https://www.experian.com/business/products/cashflow-score) |

**Reusable lines:** *"This isn't our theory. FinRegLab — an independent non-profit — tested it across real lenders and found cash-flow data predicts default as well as a bureau score, and adds signal on top of it. Experian and FICO now sell cash-flow scores in the US. We're applying a proven mechanism to a market (KSA) where the bureau is even thinner."*

---

## 3. The wedge is material — invisible wallet & gig income is huge (KSA)

The differentiator isn't "score cash flow" (others could). It's **seeing income that lands in wallets and gig platforms, which no bank-only view captures.** That income is not marginal:

| # | Claim | Status | Source |
|---|---|---|---|
| 3.1 | Saudi Arabia's freelance economy has **2.25M+ registered individuals**. | ✅ Verified | [SPA](https://spa.gov.sa/en/N2232537) |
| 3.2 | **Freelancing contributed ~SAR 72.5bn (~USD 19bn)** to the Saudi economy. | ✅ Verified | [SPA](https://www.spa.gov.sa/en/N2546774) |
| 3.3 | Digital wallet **Barq surpassed 1 million users** (rapid EMI/e-money adoption). | ✅ Verified (secondary) | [MENAbytes](https://www.menabytes.com/barq-1-million-users/); [Arab Founders](https://arabfounders.net/en/barq-saudi-fintech-startup-story-ahmed-alenazi/) |
| 3.4 | **E-money institutions (EMIs) are not yet open-banking AIS data providers** under SAMA — open banking went live for *banks* first; wallet ledgers remain outside AIS scope. | 🟡 Partially verified — directionally confirmed by the open-banking framework/timeline; the exact "32 payment companies vs 0 EMIs" head-count was **not** independently confirmed, so **don't quote the precise count on stage**. | [Fiskil SAMA OB tracker](https://www.fiskil.com/open-finance-tracker/standard/sama-open-banking); [Arab News](https://www.arabnews.com/node/2204706/business-economy) |

**Why this matters:** §3.1–3.2 prove the *income* we reveal is real and large; §3.3 proves the *rail* (wallets) is already mass-adopted; §3.4 proves that rail is **invisible to incumbents today** — which is precisely the wedge. Frame the wallet-data dependency honestly (see §7).

---

## 4. Regulatory tailwinds — we're moving in the right direction

| # | Claim | Status | Source |
|---|---|---|---|
| 4.1 | SAMA granted its **first full open-banking AIS licenses on 26 March 2026** (Lean Technologies + New Tech Software). | ✅ Verified | [Wamda](https://www.wamda.com/2026/03/saudi-arabia-issues-open-banking-license-lean-technologies); [Clyde & Co](https://www.clydeco.com/en/insights/2026/03/sama-new-licensing-framework-for-open-banking) |
| 4.2 | SAMA's **Responsible Lending Principles codify DBR (Debt-Burden Ratio) caps** that are **tiered by borrower income / product**, legally requiring a verified-income figure to lend. | ✅ Verified | [SAMA Rulebook — Ch. IV Quantitative Principles](https://rulebook.sama.gov.sa/en/chapter-iv-quantitative-principles-responsible-lending) |
| 4.3 | A **SAMA Counter-Fraud framework** is in force, creating demand for a fraud/risk flag on income data. | 🟡 Partially verified — framework is real; the **specific "effective 13 Apr 2026" date was not independently confirmed** in this pass. Say "in force / phasing in," not a hard date you can't cite. | [Focal AI summary](https://www.getfocal.ai/blog/sama-counter-fraud-framework-requirements) |
| 4.4 | **Nova Credit raised USD 45M (Series C)** to scale cash-flow underwriting — proving investor appetite for exactly this category. | ✅ Verified | [Nova Credit](https://www.novacredit.com/corporate-blog/nova-credit-raises-usd45m-series-c-financing-to-scale-cash-flow-underwriting) |

> ⚠️ **DBR caps — get the bands exactly right (the README currently has them wrong; see §5/§7).** Verified SAMA structure: base **33.33%** of salary for salaried borrowers (**25%** for pensioners/retirees), rising to **up to 45% *excluding* real-estate financing** and **55–65% *including* real-estate financing**. On stage, say: *"DBR caps are tiered and set by SAMA; our calculator is configurable to the lender's policy band."* Do **not** quote "65% for retirees" — that's incorrect.

---

## 5. Competitive moat — does anyone already ship this in KSA?

| # | Claim | Status | Source |
|---|---|---|---|
| 5.1 | **Tarabut's KSA Income Verification** product returns **verified-income data** (extracted from transactions) — **not** a PD score. | ✅ Verified | [Tarabut Docs — Income KSA](https://docs.tarabut.com/docs/introduction-to-income-ksa) |
| 5.2 | **Drahim was 65%-acquired by Al Rajhi Bank (Sept 2024)** and operates as an enrichment / PFM layer — **not** a productized cash-flow PD score. | ✅ Verified | [Al Rajhi / Drahim](https://www.alrajhibank.com.sa/ir24/services/pdf/drahim.pdf) |
| 5.3 | **SIMAH** owns the **bureau-based** PD score — there is **no productized *cash-flow* PD score** in market. | ✅ Verified (the cash-flow-PD whitespace holds) | SAMA / market scan |
| 5.4 | **Watch-out:** Tarabut **acquired Servable.dev (Jan 2026)** and frames credit decisioning as a **roadmap** item — directional competition, not a shipped competitor *yet*. | ✅ Verified | [Tarabut — Servable acquisition](https://www.tarabut.com/blogs/post/tarabut-acquires-bahrain-founded-ai-platform-servable) |

**The moat sentence:** *"Today the market sells ingredients — bank pipes (Lean/Tarabut) and enrichment (Drahim) return **data**; SIMAH returns a **bureau** score. Nobody returns a **cash-flow PD decision that includes wallet income**. That's the gap, and the rail to build it only opened in March 2026."*

---

## 6. ❌ Refuted — claims that did NOT survive fact-checking (never say these)

These were killed 0–3 in adversarial verification. They appear in the wild and may be tempting; **do not put them in the deck.**

| Refuted claim | Why it's a trap | Source it's misattributed to |
|---|---|---|
| **"26 million US consumers are credit-invisible (11% of adults)"** | The figure/attribution didn't hold up under verification (mis-stated vintage/definition). The *concept* of credit-invisibility is real — but don't cite this exact number. | [CFPB](https://www.consumerfinance.gov/about-us/newsroom/cfpb-report-finds-26-million-consumers-are-credit-invisible/) |
| **"Experian's Cashflow Score gives up to a 25% lift in predictive performance"** | The **product is real and predicts delinquency (§2.5)** — but the **specific "25% lift"** figure was refuted. Cite the product, not the number. | [Experian](https://www.experian.com/business/products/cashflow-score) |

---

## 7. 🔧 README corrections — fix before stage (SAMA-literate judges *will* catch these)

> ✅ **RESOLVED 2026-06-29** — fixes #1 and #2 are applied; `README.md` and the web app are now regulator-accurate, and a full-repo sweep found **no** instances of the refuted claims ("26M credit-invisible", "Experian +25%") or the inverted DBR bands. The items below are kept as the verification record.

The deep-research pass surfaced two factual errors and a few "vendor self-reported" figures in [`README.md`](./README.md) that are risky in front of regulator-savvy judges.

1. **DBR bands are wrong (`README.md` §8.8, ~line 372).**
   - ❌ Current: *"33% (salaried), up to 45% (incl. real-estate), 65% (retirees w/ pension)."*
   - ✅ Correct: base **33.33%** salaried / **25%** pensioners; **up to 45% *excluding* real-estate**; **55–65% *including* real-estate financing.** (45% is the *ex-real-estate* ceiling, not inclusive; 65% is the *real-estate-inclusive* ceiling, **not** a retiree band.)

2. **Nova Credit funding figure is wrong (`README.md` honesty box, ~line 561).**
   - ❌ Current: *"Nova Credit $35M Series D."*
   - ✅ Correct: **Nova Credit raised $45M (Series C)** to scale cash-flow underwriting.

3. **Keep these labelled "vendor self-reported" (don't state as fact):**
   - **Plaid LendScore "+9.1% lift"** — vendor marketing; not independently verified.
   - **Drahim "2.5B transactions"** — vendor figure; the *acquisition* (§5.2) is verified, the volume is not.
   - **"32 licensed payment companies vs 0 EMIs"** — directionally true (EMIs aren't AIS providers yet) but the exact count is unconfirmed; say "no EMIs in open-banking AIS scope yet" without the hard numbers.

> ✅ Done — applied and verified across the whole repo (README `:420`/`:606` + web app `DevelopersPage.tsx`/`Result.tsx`); no further action needed for these.

---

## 8. 🎤 What to say / what NOT to say (stage cheat-sheet)

**✅ SAY:**
- *"Saudi Arabia set 20% SME credit by 2030 into the FSDP — and is missing its own interim target. The bottleneck is assessing weak-file borrowers."*
- *"Cash-flow underwriting isn't our theory — FinRegLab proved it across real lenders; Experian and FICO sell it in the US."*
- *"Freelancing alone is 2.25M+ Saudis and ~SAR 72.5bn — income that lands in wallets, outside the bank-only view."*
- *"Open-banking AIS licensing went live in March 2026, and SAMA's DBR rules legally require verified income. We're early on a rail that just opened."*
- *"Today the market sells data and bureau scores; nobody ships a cash-flow PD decision that includes wallet income."*

**❌ DON'T SAY:**
- ❌ "26 million credit-invisible" or "Experian +25% lift" (both refuted — §6).
- ❌ "65% DBR for retirees" or "45% including real estate" (bands are inverted — §7).
- ❌ "Nova Credit $35M Series D" (it's $45M Series C — §7).
- ❌ Hard counts you can't cite ("32 vs 0 EMIs", "Drahim 2.5B txns", "Plaid +9.1%") — frame as directional/vendor-reported.
- ❌ Anything implying you *move money* or need a license you don't have. Stay on "read-only AIS + consent; no PIS."

---

## 9. Methodology & confidence

- **How this was built:** 5 parallel search angles → 24 sources fetched → 104 candidate claims extracted → **top 25 claims adversarially verified** with a 3-vote refutation panel (a claim needed ≥2 of 3 votes to survive). **23 confirmed, 2 killed.**
- **Confidence:** Sections 1, 2, 4, 5 rest on **primary sources** (SAMA, Vision 2030, FinRegLab, SAMA Rulebook, company/regulator announcements). Section 3's income figures are primary (SPA/GASTAT); the EMI head-count (§3.4) and Counter-Fraud date (§4.3) are the two soft spots — flagged accordingly.
- **Source quality tiers** are noted inline; full URLs are in the tables above. When a primary regulator source and a press source agree, the regulator source governs.

*Last refreshed: 2026-06-23. Re-run the deep-research workflow to update before the build window (16–18 Jul 2026).*
