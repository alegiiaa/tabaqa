<p align="center">
  <img src="assets/header.gif" alt="Tabaqa — the credit-intelligence layer for Saudi open banking" width="100%" />
</p>

# طبقة · Tabaqa

> **The credit-intelligence layer for Saudi open banking.**
> طبقة الذكاء الائتماني فوق المصرفية المفتوحة.
>
> From a person's cash flow → a verified, decision-ready credit & risk score.
> من تدفّقك النقدي إلى قرارٍ ائتماني.

**AMAD Hackathon 2026** (Alinma × Tuwaiq) · Open Banking track · Build window **16–18 Jul 2026**.

---

## The 10-second version

Saudi lenders can't price the **thin-file / credit-invisible** — the people and SMEs with no rich bureau history but a *real, observable cash flow* sitting inside their bank (and wallet) accounts. **SIMAH scores the bureau; nobody scores the cash flow.**

**Tabaqa** reads a user's open-banking (AIS) data — with consent — cleans and enriches it, verifies it against Masdr ground-truth, and outputs:

- **Tabaqa Score · درجة طبقة** — a **1–99 probability-of-default score** (higher = lower risk) with plain-Arabic **reason codes**.
- **Tabaqa Risk · درع طبقة** — a fraud/risk flag that rides SAMA's Counter-Fraud mandate (effective **13 Apr 2026**).

> It's "**LendScore / Cash Atlas, localized for Saudi**" — proven model abroad, structurally absent here, with an Arabic-native + wallet-aware + Masdr-verified moat no US player can copy.

---

## Why it matters

- **SMEs ≈ 99%** of Saudi establishments but get only **~9.4%** of bank credit (Q4 2024) vs the **Vision 2030 / FSDP target of 20%**. The constraint is *assessing weak-file borrowers cheaply and explainably* — exactly what a cash-flow score does.
- The locked-out segment is **credit-invisible**, but their cash flow is now reachable via open banking.
- **Verified gap:** transaction *enrichment* is **not** a Saudi gap — Tarabut runs a live KSA Categorisation API and Drahim (Al Rajhi) has enriched 2.5B+ transactions. The unoccupied layer **above** enrichment — a **productized cash-flow PD/risk score** — is. Lean, Tarabut, and Drahim ship the *data and enrichment*; **none ship the score.**

**US precedent (hard numbers):** Nova Credit — **$35M Series D** (Oct 2025), Cash Atlas live at Chase/PayPal/Yardi · Plaid **LendScore** — 1–99 PD score, *vendor-claimed* +9.1% lift over bureau · Method — **$60M** total. *(Full proof: [`../docs/research/17-cashflow-score-proof.md`](../docs/research/17-cashflow-score-proof.md) · Arabic PDF: [`../Proof_CashFlow_Score_AR.pdf`](../Proof_CashFlow_Score_AR.pdf).)*

---

## The demo (the reveal that wins the room)

This is Tabaqa's edge over a plain US-style score: **it sees what the bank-only view can't** — wallet income — and verifies it.

> **Bank-only view (what a lender sees today):** Fahd = `SAR 4,000` salary, money "vanishing into Barq" → **DECLINE** · low score.
>
> **Tabaqa view:** `SAR 10,000` real income — `4,000` salary `✓ amount-verified` (Masdr Payslip) + `5,200` gig (Jahez/HungerStation) `✓ source-verified` + `800` P2P `~ inferred`; the "Barq" outflow **reconciled** as internal movement (not double-counted) → **Tabaqa Score jumps → APPROVE.**

The reveal *is* the argument: it flips a decline to an approve **and** moves the score, with every input proof-tagged.

---

## How it works

```
Open-banking AIS (+ wallet via consent)
   │  ingest → canonical schema
   ▼
[1] Clean / normalize Arabic strings            ← CAMeL Tools (+ rules, + Claude long-tail)
   ▼
[2] Enrich → merchant + category                ← banking-class / BankTextCategorizer + AraBERT embeddings
   ▼
[3] Reconcile + verify                          ← bank↔wallet match · Masdr (Payslip/Establishment/Akeed IBAN)
   ▼
[4] Cash-flow features (the 6)                   ← income regularity · income/expense · min&avg balance
   │                                               NSF count · recurring-obligation load · balance volatility
   ▼
[5] Score → 1–99 PD + reason codes              ← optbinning Scorecard  (stretch: XGBoost + SHAP)
   ▼
[6] Tabaqa Score + Tabaqa Risk via API + dashboard
```

**Design principle (kept from the team's playbook):** *engines decide, the LLM cleans.* Deterministic rules + CAMeL Tools handle the known ~80% (transfers, top merchants, gig platforms); Claude Opus 4.8 handles only the messy Arabic long-tail. The **score itself is a transparent, explainable model** (binned points / SHAP) — not a black box — which is what a SAMA-minded judge wants to hear.

---

## The moat

**vs. Lean / Tarabut (the pipe):** they read banks and return raw/enriched *data*; Tabaqa returns a **verified-income answer + a score**. Lean is a **channel, not a rival** — we sit on top (B2B2B). Full battle-card → [`VS_LEAN.md`](./VS_LEAN.md).

**vs. a US LendScore (the model):** none of them handle **Arabic/Saudi-acquirer transaction strings, wallet (EMI) income, virtual-IBAN attribution, or Masdr ground-truth**. The four compounding USPs:

1. **Wallet-layer attribution** — turn an opaque e-money pool into per-human income.
2. **Bank ↔ wallet reconciliation** — a transfer is *moved*, not *spent* → never double-counted.
3. **Masdr/Mofeed verification + 3-tier provenance** — `✓ amount-verified` / `✓ source-verified` / `~ inferred`.
4. **Saudi-Arabic transaction cleaning** — `تحويل برق ٨٨٤٢ / JAHEZ-RYD` → `{Jahez, gig_income}`.

**The flywheel:** the more repayment outcomes the score observes, the better it gets — the same defensibility LendScore has.

---

## Business model

**B2B, consumer-free — the lender pays.** We price like a data bureau (SIMAH / Masdr) and exactly the way the US precedents monetize cash-flow scoring today. Three meters:

| Meter | What it is | Illustrative | US analog |
|---|---|---|---|
| **Tabaqa Score** | Per verified score (the credit decision) | SAR 5–25 / score | Plaid · Nova Credit · Prism — per report |
| **Tabaqa Risk** | Per-call fraud & risk flag (separate meter) | SAR 2–6 / check | Plaid **Signal** (per-request score) |
| **Tabaqa Monitor** | Recurring portfolio re-scoring → ARR | SAR / account / mo | Prism **Pulse** monitoring |

Plus **platform tiers + enterprise minimums** (SIMAH/Masdr/Plaid pattern), and **rev-share per funded loan or white-label via Lean & Tarabut** (B2B2B). Land **Alinma as customer #1**.

- **Why they pay:** a better score on a thin-file applicant = more approvals + lower defaults; the **wallet reveal turns a decline into a funded loan**. We charge a fraction of the margin we unlock.
- **Economics:** marginal cost per score ≈ one AIS pull + compute → **80%+ gross margin**; the labeled-default flywheel compounds.
- **Validated by precedent:** Nova Credit ($35M Series D), Plaid, and Prism Data all run this exact model. *(Figures illustrative.)*

> **Lesson from Nova Credit:** the score is the **wedge**, not the whole business — their highest-revenue product is an adjacent *verification* product. Plan the line: **Score → Income Verification → Monitoring.**

---

## Tech stack & open-source we build on

| Layer | Tool | Repo |
|---|---|---|
| API / backend | **Python + FastAPI** (repoint `kashf-api`) | — |
| Arabic clean | **CAMeL Tools** | [CAMeL-Lab/camel_tools](https://github.com/CAMeL-Lab/camel_tools) |
| Enrichment | **banking-class** / **AraBERT** | [eli-goodfriend/banking-class](https://github.com/eli-goodfriend/banking-class) · [aub-mind/arabert](https://github.com/aub-mind/arabert) |
| **Scoring** | **optbinning `Scorecard`** → 1–99 + reason codes | [guillermo-navas-palencia/optbinning](https://github.com/guillermo-navas-palencia/optbinning) |
| Scoring (stretch) | **XGBoost + SHAP** | [nafiul-araf/Credit-Risk-Modeling-End-to-End-Project](https://github.com/nafiul-araf/Credit-Risk-Modeling-End-to-End-Project) |
| Demo data | synthetic Saudi statements | [namebrandon/Sparkov_Data_Generation](https://github.com/namebrandon/Sparkov_Data_Generation) |
| Storage / UI | **Supabase** + **Next.js** (already wired) · or **Streamlit** for a fast demo | — |

More vetted repos → [`RESOURCES.md`](./RESOURCES.md).

### Data strategy (the key trick)

You can't get real **Saudi default labels** in 3 days, so split the sources:

- **Train** the PD model on **Berka (PKDD'99)** — real bank transactions *with loan-default outcomes* (ideal cash-flow training set). Fallback: Home Credit Default Risk / German Credit.
- **Demo** on **synthetic Saudi-format statements** (Sparkov fork with mada/Geidea/Arabic merchant strings + the Fahd wallet case) → run through the *same* pipeline.

> Pitch line: *"Trained on real transaction-level default data, demoed on Saudi-format statements; in production it retrains on the lender's own AIS outcomes."*

---

## Folder layout

```
tabaqa/
├── README.md        ← this file (the new Score thesis)
├── PRD.md           ← product requirements (wallet-income reveal = the flagship feature)
├── UI.md            ← UI spec · 4 screens · 3-tier verification · RTL
├── VS_LEAN.md       ← "we are not Lean" pitch & Q&A battle-card
├── RESOURCES.md     ← vetted open-source repos to build on
└── (planned) app/
    ├── api/         ← FastAPI: /profile and /score endpoints
    ├── pipeline/    ← ingest → clean → enrich → reconcile → features
    ├── scoring/     ← optbinning Scorecard (+ XGBoost/SHAP), trained on Berka
    ├── data/        ← Berka (train) · synthetic Saudi statements (demo)
    └── web/         ← Next.js dashboard (or Streamlit quick demo)
```

---

## Quickstart

```bash
cd tabaqa
python3 -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn streamlit pandas scikit-learn \
            optbinning xgboost shap camel-tools arabic-reshaper python-bidi
# first real task: load Berka + write the 6-feature extractor (everything downstream needs it)
```

## 3-day build plan

- **Day 1** — ingestion + canonical schema; CAMeL clean + banking-class enrich; load Berka → 6 cash-flow features.
- **Day 2** — `optbinning.Scorecard` → 1–99 score + reason codes; reconcile + Masdr verify. *(Stretch: XGBoost + SHAP.)*
- **Day 3** — Profile/Score API + dashboard + the **Fahd reveal** on a synthetic Saudi statement, polished.

---

## Status & the one gate

- **Idea: locked** — reframed 2026-06-21 from a wallet-data layer to a **cash-flow credit & risk score** (the layer is the engine; the score is the product). Insider-validated income/attribution blind spot is real.
- **Regulatory fit:** MVP is **AIS read-only** (no PIS) → **no license needed to demo**; position as **compliance/risk tooling** for SAMA's named categories. Wallet data via **consent/data-processor** route (not a standalone TPP).
- **Tailwind:** SAMA Counter-Fraud Fundamental Requirements effective **13 Apr 2026** (names AISPs/EMIs/BNPL/microfinance) → demand for exactly this risk signal.

## Honesty box (own it before judges do)

- ✅ **Verified:** US funding/deployments; Tarabut & Drahim enrichment is live in KSA; SAMA effective date; Lean KSA Data API schema.
- ⚠️ **Inferred:** that *no* Saudi player ships a cash-flow PD score — **verify SIMAH / Forus / Tweeq before committing** (biggest risk).
- ⚠️ **Vendor self-reported:** LendScore's +9.1% lift; Drahim's 2.5B-transaction figure.
- ⚠️ **Not yet grounded:** the KSA cash-flow-underwriting TAM — quantify before the final pitch.

---

## Naming

**Tabaqa** (the layer / platform) → **Tabaqa Score · درجة طبقة** (the 1–99 output) → **Tabaqa Risk · درع طبقة** (the fraud flag).

## Brand

Primary **violet/purple** + gold accents. Motif = **layers peeling back to reveal** (ties to "Tabaqa" = the Layer). Arabic-first, RTL, EN toggle.

---

### See also
- Proof pack (EN source): [`../docs/research/17-cashflow-score-proof.md`](../docs/research/17-cashflow-score-proof.md)
- Proof pack (Arabic B&W PDF): [`../Proof_CashFlow_Score_AR.pdf`](../Proof_CashFlow_Score_AR.pdf)
- Idea ranking (Arabic B&W PDF): [`../Open_Banking_Ideas_Ranking_AR.pdf`](../Open_Banking_Ideas_Ranking_AR.pdf)
