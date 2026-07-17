# Slide Numbers — what to say, and where

> **What this is:** the exact numbers to put on the pitch slides, one hero number per slide, every number landing back on **Tabaqa**. Built on the verified figures in [`RESEARCH-2026-07-15.md`](./RESEARCH-2026-07-15.md) + [`EVIDENCE.md`](../EVIDENCE.md). Story = the **embedded decision engine** (Demo Bank, Ahmed), per `PRODUCT_SPEC.md` / `HYBRID_PLAN.md`.
> **The one rule:** never say a number without it pointing at Tabaqa in the same breath. A market number that doesn't end in "…and that's what Tabaqa does" is a wasted slide.

---

## THE NUMBER HIERARCHY — memorize this before anything else

**🟢 TIER 1 — HERO NUMBERS (say with total confidence, they're bulletproof):**
- **SAR 338 billion** — the SME financing gap the government committed to close (FSDP 9.4%→20%). *The market is real and Vision-2030-sized.*
- **6 million** banked-but-unscorable adults — 78.84% banked vs 56.7% scorable. *The white space, in humans.*
- **+0.117 AUC at 963,811 real applications** — our wallet-data lift, at scale. *The proof it works.*
- **0.76 vs 0.64** — BIS: transaction data beats bureau scores. *A central bank proved the mechanism.*

**🟡 TIER 2 — SUPPORTING (say with the label attached):**
- SAR 470bn consumer finance / SAR 3.19tn total credit (the TAM pool)
- SAR 40bn NPL → SAR 4–12bn/yr reducible (the bank's ROI — say "illustrative")
- Discovery Bank: 1.2M customers, live 7 years (feasibility — "category proven, Kingdom empty")
- Fannie Mae approves no-score borrowers on 12 months of cash flow (conservative-institution precedent)
- SAR 25bn Saudi auto finance, +19%/yr (your demo channel — non-bank channel only, a conservative floor)
- 67% of loan-production cost is personnel · 14% cost-per-loan cut from automation (Freddie Mac — say "US benchmark," quote the measured 14%, never the 40% aspiration)

**🔴 TIER 3 — NEVER SAY (they get you caught — full list in EVIDENCE.md landmines):**
- ❌ "SAR 1.4 trillion market" (blog-sourced) → say SAMA's SAR 3.19tn total credit
- ❌ "11 million unscorable" → say **6 million** (the rigorous adult base; reconcile every doc to this)
- ❌ "90%+ banked" → say **78.84%**
- ❌ "world's first" → say "category proven, Kingdom empty"
- ❌ "0.81 vs 0.71" → say **0.76 vs 0.64**
- ❌ "regulatory blessing" → say "explicit SAMA policy endorsement"
- ❌ "SAR 932.8bn / 29.3% real estate (Q2-2025)" — **refuted** → say **SAR 922.2bn (Q1-2025)**
- ❌ "MSME SAR 258bn" / "SME gap SAR 259bn" — **refuted** → say **MSME SAR 351.7bn (2024)** + the **SAR 338bn** gap
- ❌ "IMF: household DSTI ~40%" — **refuted unanimously**, don't cite it at all
- ❌ any **Saudi riyal cost-savings number** — no Saudi cost-to-originate exists; the 14% is **US mortgage** data
- ❌ **"measured"** about the SAR 4–12bn reducible losses → say **"illustrative"** (the reduction % is an assumption)
- ❌ a **computed** number without its math on the slide — SAR 338bn, 6M, SAR 55–184bn, SAR 40bn are all derived. Bare, they sound invented.

---

## SLIDE BY SLIDE

### Slide 1 · Title
**طبقة · Tabaqa** — *"From customer consent to an automated financing decision in seconds."*
No number. One product line. Let the story start on Slide 2.

### Slide 2 · THE GAP (the problem) — 🎯 *scores Innovation #1*
> **Big on screen:** `78.84% banked  →  only 56.7% scorable`
> **The number:** **~6 million Saudi adults are banked but invisible to credit scoring.**

**Say:** *"Saudi Arabia banks 79% of adults — but only 57% are visible to a credit bureau. That 22-point gap is roughly **6 million people** who have a bank account, a salary, a life — and cannot be priced for a loan today. Not because they're risky. Because nobody reads the data they already have."*

**Why it works:** it's a *human* gap, not a riyal abstraction, and every input is World Bank / GASTAT primary. Lands straight into "…and that's exactly who Tabaqa scores."

### Slide 3 · WHY IT HAPPENS (the insight)
> **The number:** **0.76 vs 0.64** (BIS) — *or no number, just the idea.*

**Say:** *"The data to price these people exists — it's in their bank account and their wallet. The Bank for International Settlements measured it: transaction data scores **0.76 against a bureau's 0.64**. The signal is better than the bureau. It's just never turned into a price. That's the gap Tabaqa closes."*

### Slide 4 · TABAQA (the solution) — 🎯 *scores Tech #2*
> **The number:** **decision in seconds** (the 3–6s pipeline).

**Say:** *"Tabaqa is a decision engine that lives **inside the bank's own app**. The customer consents, and in seconds we collect, verify, and normalize their bank, wallet, employment, and credit data, apply the regulator's affordability rules and the bank's own policy, and return a real financing decision — no forms, no salary certificate, no employee. Standard cases are fully automated; only exceptions go to a human."*

### Slide 5 · THE PROOF IT WORKS — 🎯 *scores Data #3*
> **The numbers (this is your strongest slide — earn it):**
> - **+0.117 AUC** on **963,811 real applications** (our wallet-data lift, at scale)
> - **+0.203 AUC** wallet-layer ablation on real defaults (thin-file 0.60 → 0.78)
> - **Fannie Mae** approves no-score borrowers on **12 months** of cash flow

**Say:** *"This isn't a hypothesis. On nearly a million real applications, adding wallet-level cash-flow data lifted our model **+0.117 AUC**. On thin-file borrowers — the 6 million — it moved prediction from 0.60 to 0.78. And the most conservative lender on earth already does this: **Fannie Mae approves borrowers with no credit score on 12 months of bank cash flow.** We didn't invent the mechanism. We brought it to Saudi rails."*

> ⚠️ Never merge +0.117 and +0.203 into one number — they're different experiments (see EVIDENCE.md landmine #25).

### Slide 6 · THE DEMO REVEAL (wallet fusion) — 🎯 *scores UX #4 + Data #3*
> **The number:** **SAR 90,000 → SAR 150,000** (Ahmed, bank-only vs fused).

**Say:** *"Ahmed asks his bank for SAR 150,000 to finance a car. On the bank's own view — his salary account only — the engine can responsibly approve about **SAR 90,000**. Below what he needs. Then he consents to share his full picture: open banking plus his wallet. His income is now verified and complete — **approved for the full SAR 150,000**, three ways to pay it, documents generated, zero employees involved. Same math. More truth."*

This is the beat the whole demo builds to. Let the number reveal live on screen, don't pre-announce it.

### Slide 7 · CAN IT SHIP IN A BANK (feasibility) — 🎯 *scores Feasibility #5*
> **The numbers:**
> - **Article 96** — SAMA obliges account providers to grant licensed access on customer consent
> - **SAR 20,000** — the cost of our own AIS licence (no joint-stock requirement)
> - **1.2 million** — Discovery Bank customers on behavior-priced credit, live 7 years

**Say:** *"Is this legal, and can it actually run in a bank? Yes — and we answer with article numbers. Saudi law defines a payment account provider-agnostically, and **Article 96 forces banks and wallets to grant licensed access on the customer's consent.** Our own licence costs **SAR 20,000**. And the category isn't theoretical — **Discovery Bank has priced credit on behavior for seven years, 1.2 million customers.** Category proven; the Kingdom is the empty part."*

> ⚠️ Say "explicit SAMA **policy endorsement**," never "regulatory blessing." Say "category proven, Kingdom empty," never "world's first."

### Slide 8 · THE MARKET & THE BANK'S ROI — 🎯 *scores Feasibility #5 + Innovation #1*
> **The hero number:** **SAR 338 billion** — the committed SME gap.
> **Put the arithmetic ON the slide** (this is what makes it undismissable):
> ```
> 20% × SAR 3,186bn = SAR 637bn  (Vision 2030 target)
> 9.4% × SAR 3,186bn = SAR 300bn  (today)
> ─────────────────────────────
> gap = SAR 338bn
> ```

**Say:** *"Saudi banks hold **SAR 3.19 trillion** of credit, **SAR 470 billion** of it consumer finance — the pool we plug into. And the Kingdom has publicly committed to move SME lending from 9.4% to 20% of credit: **SAR 338 billion it must unlock**, with thin-file underwriting as the bottleneck. For the bank, it's also defense — Saudi banks carry ~**SAR 40 billion** in non-performing loans; better underwriting on the marginal applicant is billions in avoidable losses a year."*

> ⚠️ Say **"illustrative"** on the SAR 4–12bn reducible — the stock is computed from SAMA, but the reduction % is an assumption. Never "measured."
>
> **The counter you should expect** — *"You're mixing a Q4-2024 ratio with a Q2-2025 credit base."*
> **The rebuttal:** *"Flagged — but the gap is **10.6 points regardless of vintage**; on any 2024–25 credit base it's **SAR 300–340 billion**. And Tabaqa attacks the thin-file scoring gap directly."*
> Concede the vintage instantly. The gap survives it, and conceding is what makes the other numbers credible.

### Slide 9 · CLOSE — return to the human
**Say:** *"Six million people. The data was always there. Tabaqa turns it into a price — inside the bank, in seconds, in Arabic. Consent to decision. That's it."*
No number. End on the human you opened with.

---

## PER-CRITERION CHEAT SHEET (all 5 AMAD criteria)

| Criterion | The number that wins it | The one line |
|---|---|---|
| **① Innovation** | 6M unscorable · SAR 55–184bn locked out · $200M+ VC into this thesis | "The applicant holds the consent and gets the price — nobody in the Kingdom does that." |
| **② Tech** | 3–6s pipeline · +0.117 at 963k · source-agnostic adapters (Arabic/Hijri/RTL) | "A real engine, running at scale, on data nobody else parses." |
| **③ Data** | +0.203 ablation · +0.117 at scale · TSTR 96% · BIS 0.76 v 0.64 | "Mechanism-validated on a million foreign outcomes; Saudi-calibrated in the 60-day pilot." |
| **④ UX** | 90k→150k live reveal · receipt in the judge's hand · Arabic-first | "The judge watches a decision happen and holds the proof." |
| **⑤ Feasibility** | Art. 96 · SAR 20k licence · Discovery 1.2M/7yr · SAR 40bn NPL ROI · 14% cost cut | "Legal by statute, proven in three markets, profitable for the bank." |

## THE HONESTY LINES — rehearse these, volunteer them before a judge digs
- **Cold-start:** *"Our score is mechanism-validated on a million foreign outcomes, not yet Saudi-calibrated. We know that. The pilot's retro-validation closes it in 60 days."*
- **The Petal lesson:** *"The best-funded US player proved the mechanism and still died — as a lender, with no wallet fusion, no applicant-facing score. Three lessons, three of our design decisions: we never lend, we fuse the wallet, the number belongs to the applicant."*
- **Vintage on the wedge:** *"Yes — 2024 banking data, 2020 bureau coverage. It's the newest published figure, and the 22-point gap is directionally robust."*

*Created 2026-07-16 from `RESEARCH-2026-07-15.md` + `EVIDENCE.md`. One number per slide; every number lands on Tabaqa.*
