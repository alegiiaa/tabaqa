<p align="center">
  <img src="assets/header.gif" alt="Tabaqa — the credit-intelligence layer for Saudi open banking" width="100%" />
</p>

# طبقة · Tabaqa — Engineering Reference

> **The credit-intelligence layer for Saudi open banking.** · طبقة الذكاء الائتماني فوق المصرفية المفتوحة.
>
> Pull a person's data from their **banks and digital wallets** (with consent) → run it through an **AI/rules pipeline** → output a **verified income picture, a 1–99 score, a risk flag, and a financing-risk calculator.**

**AMAD Hackathon 2026** (Alinma × Tuwaiq) · Open Banking track · Build window **16–18 Jul 2026**.

This README is the **reference manual** for the whole app: the problem, the solution, the tech stack, and the **full process end-to-end** — every pipeline stage, every formula, the data model, the API, and a worked example traced through with real numbers. For the investor pitch see [`PRD.md`](./PRD.md); for the "we are not Lean" battle-card see [`VS_LEAN.md`](./VS_LEAN.md); for the **cited, fact-checked evidence base** behind the problem ("how is this a real problem?") see [`PROOF.md`](./PROOF.md).

---

## In plain language — what Tabaqa actually does

*Read this first. No jargon. The technical reference starts at the Contents below.*

**The problem.** When you ask a bank for financing, it looks at your **bank account** and asks one thing: *"How much salary lands here every month?"* But a lot of real income **never touches the bank** — gig pay (Jahez, HungerStation, Mrsool), P2P transfers, and side income land in a **digital wallet** (Barq, urpay), and **the bank cannot see the wallet.** So a person who really earns SAR 10,000 looks like SAR 4,000 → **rejected for a loan they could easily afford.** And even when a company does collect this data, turning the messy pile into a usable answer is **slow and expensive.**

**What Tabaqa is, in one sentence.**

> Tabaqa (طبقة = *"the layer"*) is a smart **layer** that gathers a person's full money picture — from their bank **and** their digital wallet, with their consent — instantly cleans and verifies it, and hands the lender one clear answer: the person's **real income**, a **trust score out of 99**, and **how much they can safely borrow.**

A bank statement is a photo of **one room**. Tabaqa walks through **every room** (bank + wallet), labels what's real, and gives you **one honest report of the whole house.**

**The journey, A to Z.** Follow one applicant ("Fahd"). Every step is a real piece of the stack; the plain meaning is on the right.

```
   Applicant                                                            The Lender
      │                                                                      ▲
      ▼                                                                      │
  ① WEBSITE → ② LOGIN → ③ CONNECT BANK + WALLET → ④ THE ENGINE → ⑤ THE ANSWER → ⑥ SAVED
   (React)   (Supabase)      (Open Banking)        (Python)       (score+loan)  (Supabase DB)
```

| Step | The tech | What it really does (plain language) |
|---|---|---|
| ① **The screen** | React + Vite frontend | The website Fahd and the lender look at and click. Works in **Arabic & English** (RTL). |
| ② **Log in** | Supabase Auth | The doorman — each person only ever sees their own data. |
| ③ **Connect accounts** | Open Banking (consent) | With Fahd's permission, pulls his **bank + wallet** transactions automatically. We only ever **read** — we never move money. This is also the *cheap, fast* channel (vs. SIMAH at 20–100 SAR/pull or Absher's Yaqeen). |
| ④ **The engine** | Python (FastAPI + pipeline) | A 5-station conveyor belt that turns the mess into an answer in **seconds** (below). |
| ⑤ **The answer** | `affordability.py` | The loan decision on Fahd's **real** income: Approve / Review / Decline. |
| ⑥ **Saved** | Supabase database | A locked filing cabinet — the lender keeps a history, per user. |

**Inside the engine (step ④) — the 5 stations:**

| Station | Code | What it really does |
|---|---|---|
| 🧹 **Clean** | `clean.py` | Tidies messy Arabic transaction text so the machine can read it — like straightening a crumpled receipt. |
| 🏷️ **Label** | `enrich.py` | Tags each line: *"this is Jahez → gig income," "this is a grocery store → spending."* |
| 🔗 **Match** | `reconcile.py` | Spots when Fahd just **moved his own money** bank→wallet and makes sure it isn't **counted twice** as income. |
| ✅ **Verify** | `verify.py` | Checks income against **official records (Masdr)** and stamps each one with how strongly it's proven — **3 levels: proven · source-confirmed · inferred.** |
| 📊 **Score** | `scorecard.py` | Adds it all into a **1–99 trust score** with plain reasons ("regular income," "no overdrafts"). No black box — every point is explainable. |

**The reveal for Fahd.** Bank alone sees **4,000**. Tabaqa sees **10,000** = 4,000 salary (✅ proven) + 5,200 gig (✅ source-confirmed) + 800 transfers (~ inferred). On bank-only income the loan is a **DECLINE**; on the real verified income it's an **APPROVE** — *same person, same rules, ~5× more financing unlocked, just by seeing the wallet income the bank couldn't.*

**What comes out** — four things on one screen: ① **the Reveal** (real vs. bank-only income), ② **the Tabaqa Score** (1–99 + reasons), ③ **the labeled ledger** (every transaction with its proof level), ④ **the financing decision** (Approve / Review / Decline).

---

## Contents

0. [In plain language — what Tabaqa actually does](#in-plain-language--what-tabaqa-actually-does)
1. [What Tabaqa is](#1-what-tabaqa-is)
2. [The problem](#2-the-problem)
3. [The solution — two services on one engine](#3-the-solution--two-services-on-one-engine)
4. [System architecture](#4-system-architecture)
5. [Tech stack](#5-tech-stack)
6. [Where the data comes from](#6-where-the-data-comes-from)
7. [The data model — canonical transaction schema](#7-the-data-model--canonical-transaction-schema)
8. [The full process — pipeline, stage by stage](#8-the-full-process--pipeline-stage-by-stage)
9. [Worked example — Fahd, traced end-to-end](#9-worked-example--fahd-traced-end-to-end)
10. [The API reference](#10-the-api-reference)
11. [The frontend](#11-the-frontend)
12. [Running it](#12-running-it)
13. [Repository layout — file by file](#13-repository-layout--file-by-file)
14. [Extending it](#14-extending-it)
15. [Roadmap, status & honesty box](#15-roadmap-status--honesty-box)
16. [Business model, naming & brand](#16-business-model-naming--brand)

---

## 1. What Tabaqa is

Tabaqa (طبقة = "the layer") sits **above** the open-banking pipes (Lean, Tarabut) and **above** enrichment vendors (Drahim, Tarabut Categorisation). Those return raw or categorized *data*. Tabaqa returns an *answer*: **a person's real, verified monthly income — across bank *and* wallet — and what they can responsibly be financed.**

It is a **consent-based data-processor**. It **reads** (open-banking AIS + wallet, read-only) and **reasons**; it **never moves money** (no payment initiation / PIS). That keeps the MVP demoable with **no AISP/TPP license**.

---

## 2. The problem

**Saudi lenders cannot price the thin-file / credit-invisible borrower.** Two compounding blind spots:

1. **Nobody scores the cash flow.** SIMAH scores the *bureau* (existing loans, defaults). A person with no rich bureau history but a real, observable salary + gig income is "credit-invisible" — even though their bank statement plainly shows they can repay. There is no productized **cash-flow probability-of-default (PD) score** in the market.

2. **Nobody can see the wallet at all.** Digital wallets (Barq, urpay, Tweeq; STC Pay has graduated to STC *Bank*) are **e-money institutions (EMIs)**, not banks. They pool all customer funds in **one omnibus IBAN at a sponsor bank**; each user is a **virtual sub-account inside the wallet's private ledger** — *"the Layer."* So to any outsider a wallet is **one opaque account**:
   - you can't pull a person's wallet balance from their national ID;
   - you can't see income that lands in a wallet (gig pay, P2P, advances);
   - you can't attribute any wallet transaction to a human.

   Under SAMA's live open-banking regime there are **32 licensed payment companies but 0 EMIs** as data providers — so the rail to wallet data **doesn't exist in open-banking scope yet.** That's *why* Lean/Tarabut don't expose wallets: it's not a feature they forgot.

**The cost.** SMEs are **≈99%** of Saudi establishments but receive only **~9.4%** of bank credit (Q4 2024) against the **Vision 2030 / FSDP target of 20%**. The binding constraint is *assessing weak-file borrowers cheaply and explainably* — exactly the gap a cash-flow score + an affordability calculator fills. The income that would qualify them is often **sitting in a wallet the lender can't see.**

> Validated first-party by an Alinma insider: *"determining income from wallets is the hard problem; the Layer is what makes it hard."*

---

## 3. The solution — two services on one engine

One pipeline turns raw bank + wallet feeds into a verified financial picture; two products sit on top of it.

### Service ① — The Intelligence Layer (طبقة الذكاء)

**In:** a user's bank accounts (open-banking AIS) **+** their digital wallets (consent).
**Out:** one unified, provenance-tagged financial picture **+** two outputs:

- **Tabaqa Score · درجة طبقة** — a **1–99 PD score** (higher = lower risk) with plain-Arabic **reason codes**.
- **Tabaqa Risk · درع طبقة** — a fraud/risk flag (rides SAMA's Counter-Fraud mandate, effective **13 Apr 2026**).

The engine does four jobs no bank-only view can: **clean** messy Saudi-Arabic transaction strings → **enrich** to merchant + category → **reconcile** bank ↔ wallet so a transfer is never double-counted → **verify** salary / payer / IBAN against Masdr, tagging every figure with how strongly it's proven (3 tiers).

### Service ② — The Financing-Risk Calculator (Tabaqa Finance · حاسبة طبقة)

**In:** the client's **own financing parameters** (amount, tenor, profit rate, existing obligations, DBR-cap policy) **+** the verified picture from Service ①.
**Out:** a **financing decision**, not just a number — monthly installment, debt-burden ratio (DBR) before/after, max affordable financing, PD-at-this-amount, and **APPROVE / REVIEW / DECLINE** with reasons, anchored to SAMA's **Responsible Lending Principles**.

Two audiences, one engine: the **lender's credit team** (primary, B2B — "does this applicant fit our DBR policy at SAR X over Y months?") and the **borrower** (lead-gen — "how much can I actually afford?").

> Service ② is what makes the score **actionable**: it converts `Tabaqa Score = 82` into *"approve SAR 60,000 — DBR 23%, room to ~SAR 98k."* See **§8.8**.

---

## 4. System architecture

```
        ┌──────────────────────────── SERVICE ① · INTELLIGENCE LAYER ────────────────────────────┐
        │                                                                                          │
 Bank AIS  (Lean / Tarabut) ──┐                                                                    │
                              ├──▶ [0] ingest → canonical Transaction[]                            │
 Wallet feed (Barq · consent)─┘            │                                                       │
                                           ▼                                                       │
   [1] clean/normalize  →  [2] enrich (merchant+category+type)  →  [3a] reconcile bank↔wallet      │
                                           │                                                       │
   [3b] verify vs Masdr (3-tier)  →  [4a] resolve income (the reveal)  →  [4b] 6 cash-flow features │
                                           │                                                       │
                              [5] scorecard → Tabaqa Score (1–99) + PD + reason codes + Risk flag  │
        │                                  │                                                       │
        └──────────────────────────────────┼───────────────────────────────────────────────────────┘
                                            ▼
        ┌──────────── SERVICE ② · TABAQA FINANCE (financing-risk calculator) ────────────────────┐
         client inputs: amount · tenor · profit rate · existing obligations · DBR-cap policy        │
                                            │  pulls verified income + score + features from ①       │
                                            ▼                                                        │
   amortize installment → DBR before/after vs cap → max installment / max financing → PD@amount      │
                                  → APPROVE / REVIEW / DECLINE + plain-Arabic reasons                │
        └──────────────────────────────────────────────────────────────────────────────────────────┘

 Delivery:  FastAPI  (/v1/score · /v1/profile · /v1/affordability)  →  Supabase  →  React/Vite dashboard
```

**Two design rules that run through everything:**

- **Engines decide, the LLM cleans.** Deterministic rules + CAMeL Tools resolve the known ~80% (transfers, top merchants, gig platforms). Claude Opus 4.8 is reserved for the messy Arabic long-tail and ambiguous income classification — never for the *decision*.
- **The decision is transparent.** The score is an **additive points model** (every point attributable to a feature bin) and the calculator is **amortization + DBR arithmetic**. No black box — which is what a SAMA-minded reviewer wants.

> **Code reality:** `pipeline/` and `scoring/` are **pure-stdlib** — the whole reveal-and-score runs with **zero third-party packages**. FastAPI is only needed to *serve* it; optbinning/pandas only to *train* the production model on real default labels. CAMeL Tools / Claude are the production swap-ins for stage [1]/[2], stubbed by deterministic rules in the demo.

---

## 5. Tech stack

| Layer | What we use | Demo (in-repo, runs now) | Production / stretch |
|---|---|---|---|
| **Backend / API** | Python 3 + **FastAPI** + Pydantic v2 | `api/` serves the demo | repoint the existing `kashf-api` skeleton; Supabase persistence |
| **Pipeline** | pure-stdlib (`re`, `statistics`, `dataclasses`) | `pipeline/` — clean→enrich→reconcile→verify→features | pandas/numpy over full AIS history |
| **Arabic cleaning [1]** | deterministic normalize + rules | `pipeline/clean.py` | **CAMeL Tools** + **PyArabic**; **Claude Opus 4.8** for the long-tail |
| **Enrichment [2]** | rule tables (merchants/keywords) | `pipeline/enrich.py` | **banking-class** / **BankTextCategorizer** + **AraBERT** embeddings |
| **Scoring [5]** | transparent additive scorecard | `scoring/scorecard.py` | **optbinning `Scorecard`** trained on Berka; stretch **XGBoost + SHAP** |
| **Affordability ②** | amortization + SAMA-DBR math | *specced* (**§8.8**), planned `/v1/affordability` | configurable per-lender DBR policy |
| **Verification [3b]** | mock Masdr in the fixture | `pipeline/verify.py` | **Masdr/Mofeed** APIs — Payslip, Establishment, Akeed IBAN |
| **Frontend** | **React 18 + Vite + TypeScript**, bilingual EN/AR RTL | `web/` landing + product mock | live dashboard hitting `/v1/*` |
| **Data (train)** | — | — | **Berka (PKDD'99)**, fallback Home-Credit / German-Credit |
| **Data (demo)** | synthetic Saudi statements | `data/synthetic/fahd.json` | lender's own AIS history |

Open-source we build on is catalogued in [`RESOURCES.md`](./RESOURCES.md).

---

## 6. Where the data comes from

Every pull is **read-only** and **user-authorized**. Tabaqa never scrapes, never decrypts an omnibus account, never initiates a payment.

### A. Production sources

| # | Data | Provider | Access mechanism | What we extract | Feeds |
|---|---|---|---|---|---|
| 1 | **Bank accounts & transactions** | Open-banking AIS via **Lean** (first SAMA OB licensee, Mar 2026) or **Tarabut** — reads the **23 licensed banks** | Consent-based **AIS** API (read-only); we consume the aggregator as a channel | salary credits, transfers, spend, balances | ① clean→score · ② affordability |
| 2 | **Wallet / e-money ledger** *(the wedge)* | EMIs — **Barq, urpay, Tweeq** (STC Pay → STC Bank) | **Consent / data-processor / partnership** — *not* OB AIS (0 EMIs in OB scope). MVP: consented/simulated feed or uploaded statement | gig income, P2P, top-ups, wallet spend | ① **income reveal** |
| 3 | **Salary / wage truth** | **Masdr / Mofeed — Payslip & Wage** | Verification API | employer, monthly wage, salary IBAN | verify → `✓ amount-verified` |
| 4 | **Establishment legitimacy** | **Masdr — Establishment** | Verification API | is the *payer* a real registered establishment | verify → `✓ source-verified` |
| 5 | **Account owner / status** | **Masdr — Akeed IBAN Verification** | Verification API | IBAN ↔ owner, active/closed | verify + Tabaqa Risk |
| 6 | **Bureau & existing obligations** | **SIMAH** (lender usually has access) | Bureau API | existing loans/obligations, bureau score | ② DBR (existing-obligations side). *We don't replace SIMAH — we add the cash-flow layer it lacks.* |
| 7 | **Financing parameters** | **The client** (lender / borrower) | Calculator form / API | amount, tenor, rate, DBR-cap policy | ② calculator |

### B. The consent + legal route (why this is allowed)

- **Bank data:** standard open-banking **AIS consent** (read-only). No license to *read* — we sit on a licensed aggregator (Lean/Tarabut) or run as a **data-processor inside a licensee** (Alinma = customer #1).
- **Wallet data:** the EMI ledger is private, so we reach it by **explicit user consent / partnership / data-processing agreement** — never by decrypting an omnibus account. *(Insider steer: take the data-processing route, not the regulation route.)*
- **No PIS, ever.** Read and reason; never move money.

### C. Demo & training data (what's wired today)

| Use | Source | Where |
|---|---|---|
| **Demo** the reveal + calculator | synthetic Saudi-format statements (mada/Geidea/Arabic strings + wallet income) | [`app/data/synthetic/fahd.json`](./app/data/synthetic/fahd.json) |
| **Train** the PD model | **Berka (PKDD'99)** — real bank transactions *with default outcomes* | `app/data/berka/` (not committed) |
| Seed realism / eval | Sparkov generator + labeled transaction-category sets | [`RESOURCES.md`](./RESOURCES.md) |

> **Pitch line:** *"Trained on real transaction-level default data, demoed on Saudi-format statements; in production it retrains on the lender's own AIS outcomes."*
>
> **Gated assumption:** wallet access (#2) is the one dependency — demo uses consented/simulated data. SAMA's open-finance roadmap extends to e-money issuers, so the rail **will** exist; Tabaqa is the intelligence the moment it does.

---

## 7. The data model — canonical transaction schema

Every source is normalized into one shape (`pipeline/schema.py`, mirrors PRD §9). A stdlib `@dataclass` so the pipeline needs no dependencies; the API converts these to/from Pydantic models.

```python
@dataclass
class Transaction:
    source: str                 # "bank:alinma" | "wallet:barq"
    timestamp: str              # ISO-8601 ("YYYY-MM-DD" or full)
    amount: float               # always positive; sign comes from `direction`
    direction: str              # "inflow" | "outflow"
    raw_desc: str               # original Arabic/English string
    id: str                     # uuid4 (auto)
    currency: str = "SAR"
    merchant:  str | None       # set by enrich  (e.g. "Jahez")
    category:  str | None       # set by enrich  (e.g. "gig_platform")
    txn_type: str = "unknown"   # see vocab below — set by enrich/reconcile/verify
    counterparty_iban: str | None
    verification: str = "inferred"   # amount_verified | source_verified | inferred
    verified_via: str = "none"       # masdr:payslip | masdr:establishment | masdr:akeed | none
    confidence: float = 0.0
    # properties: .month → "YYYY-MM" · .is_bank · .is_wallet
```

**Controlled vocabularies**

| Field | Allowed values |
|---|---|
| `direction` | `inflow`, `outflow` |
| `txn_type` | `salary`, `gig_income`, `p2p`, `internal_movement`, `loan_obligation`, `purchase`, `unknown` |
| income types (counted as income) | `{salary, gig_income, p2p}` |
| `verification` (3-tier provenance) | `amount_verified` › `source_verified` › `inferred` |
| `verified_via` | `masdr:payslip`, `masdr:establishment`, `masdr:akeed`, `none` |

A **fixture** (one applicant) is `{applicant, accounts[], masdr{}, transactions[]}`:

```jsonc
{
  "applicant": { "id", "name", "connection_id" },
  "accounts":  [ { "source", "opening_balance", "currency" } ],
  "masdr":     { "payslip": {employer, monthly_wage, iban},
                 "establishments": ["Jahez", ...],
                 "akeed_ibans": { "SA…": {owner, status} } },
  "transactions": [ { "source","timestamp","amount","direction","raw_desc","counterparty_iban?" } ]
}
```

---

## 8. The full process — pipeline, stage by stage

Entry point: `pipeline.run_pipeline(fixture) → ProfileResult`. Order in code (`pipeline/pipeline.py`):

```
[0] ingest        Transaction.from_dict() for each raw row
[1]+[2] enrich    enrich_all(txns)        # clean/normalize is called *inside* enrich
[3a] reconcile    reconcile(txns)         # tag matched bank↔wallet legs as internal_movement
[3b] verify       verify_transactions(txns, masdr)   # stamp 3-tier provenance
[4a] income       resolve_income(txns) → IncomeProfile   # the reveal
[4b] features     extract_features(txns, opening_balances, income) → CashFlowFeatures
→ ProfileResult{applicant, transactions, income, features, opening_balances}

then, separately:
[5] score         scoring.score_profile(features, income) → ScoreResult
[②] affordability calculate(profile, loan_params) → AffordabilityResult   (planned)
```

### 8.1 · Clean / normalize — `pipeline/clean.py`

Deterministic, dependency-free string normalization so Arabic and Latin variants match. `normalize(text)`:

1. fold **Arabic-Indic digits** → Western (`٨٨٤٢` → `8842`);
2. strip **diacritics / tatweel** (tashkeel, ـ);
3. unify letter variants (`أإآ`→`ا`, `ى`→`ي`, `ة`→`ه`);
4. collapse whitespace, lowercase Latin.

`clean_with_llm()` is the **integration point** for the long-tail: in production it routes to Claude Opus 4.8 (cached prompt → `{merchant, category, type}`); stubbed to `normalize()` so the demo runs offline.

### 8.2 · Enrich — `pipeline/enrich.py`

Labels what the string plainly says. It sets `merchant` / `category` and a **first-pass** `txn_type` — it does **not** decide income provenance (that's the verifier).

- **Merchant lookup:** token table → canonical merchant + category. `jahez|جاهز`→`(Jahez, gig_platform)`, `hungerstation|هنقرستيشن`→`(HungerStation, gig_platform)`, plus Mrsool, Uber, Careem, `بنده|panda`→`(Panda, grocery)`, Tamimi, STC.
- **Type hints** (keyword → type, on the normalized string):
  - salary ← `راتب, salary, wage, payroll` (inflow)
  - gig ← `jahez, جاهز, hungerstation, هنقرستيشن, mrsool, payout, دفعه` (inflow)
  - p2p ← `تحويل من, p2p, فرد, transfer from` (inflow)
  - obligation ← `قسط, تمويل, installment, loan, murabaha` (outflow)
  - purchase ← `مدى, mada, geidea, urpay, pos, نقاط بيع` (outflow)
- `confidence` ← 0.6 if a merchant matched else 0.4.

### 8.3 · Reconcile — `pipeline/reconcile.py`

The **anti-double-count** core. A bank→wallet transfer is money *moved*, not *spent*; the gig pay landing in the wallet is *real income*. The two transfer legs must be matched so the transfer itself is counted as neither income nor expense.

**Algorithm:** find bank **outflows** and wallet **inflows** whose `raw_desc` contains a transfer keyword (`برق, barq, stcpay, urpay, محفظه, wallet, تحويل`); pair them when

```
|amount_out − amount_in| ≤ 0.01 SAR   AND   |date_out − date_in| ≤ 3 days
```

Each matched pair → both legs `txn_type = internal_movement`, `confidence = 0.95`. Each wallet leg is used at most once.

### 8.4 · Verify — `pipeline/verify.py` (the 3-tier provenance model)

Stamps each income inflow with **how strongly it's proven**. Honesty is the credibility play — a P2P transfer is never tagged Masdr-verified.

| Tier | Rule | Tag | `verified_via` | conf |
|---|---|---|---|---|
| **Amount-verified** | `counterparty_iban == payslip.iban` **and** `|amount − monthly_wage| ≤ max(1, 5%·wage)` | `✓ amount-verified` | `masdr:payslip` | 0.99 |
| **Source-verified** | merchant ∈ Masdr `establishments` (the *payer* is real; amount comes from the txn, not Masdr) | `✓ source-verified` | `masdr:establishment` | 0.90 |
| **Inferred** | recurring P2P, no external confirmation | `~ inferred` | `none` | 0.50 |

> Retail purchases are **never** Masdr-tagged. "Mofeed" is Masdr's product — never a label for unverified rows.

### 8.5 · Resolve income — `pipeline/verify.py::resolve_income` (the reveal)

Aggregates verified inflows into a monthly breakdown and computes **the reveal**.

For each income type ∈ `{salary, gig, p2p}`: `monthly_amount = Σ(group amounts) / months_observed`, tagged with the **strongest** verification seen in the group. Then:

```
total_income      = Σ component monthly amounts                       # true income (all sources)
bank_only_income  = Σ(bank income txns) / months                      # what a bank-only view sees
verified_income   = Σ(amount- or source-verified components)
verified_share    = verified_income / total_income
reveal_delta      = total_income − bank_only_income                   # the headline
```

`IncomeProfile{components[], total_income, bank_only_income, verified_income, verified_share, reveal_delta}`.

### 8.6 · Cash-flow features — `pipeline/features.py` (the six)

The score is built on six features (internal movements excluded throughout):

| # | Feature | Definition |
|---|---|---|
| 1 | `income_regularity` ∈ [0,1] | `max(0, 1 − cv_income) × coverage`, where `cv_income = stdev/mean` of monthly income and `coverage = months_with_income / months`. Steady + every month → ~1.0 |
| 2 | `income_expense_ratio` | `mean(monthly_income) / mean(monthly_expense)`; `>1` = saving (∞ if no expenses) |
| 3 | `avg_balance` / `min_balance` | running event-by-event balance of the **bank** account from its `opening_balance` |
| 4 | `nsf_count` | number of points where **any** account balance goes `< 0` (NSF/overdraft) |
| 5 | `recurring_obligation_load` | `mean(monthly loan_obligation outflows) / mean(monthly income)` |
| 6 | `balance_volatility` | `|stdev(bank balance series) / avg_balance|` (coefficient of variation) |

Plus carried metadata: `months_observed`, `verified_income_share`.

### 8.7 · Score — `scoring/scorecard.py` (Tabaqa Score)

A **transparent additive points model** — the exact shape `optbinning.Scorecard` produces (binned features → points → score). `score_profile(features, income) → ScoreResult`. Start at `BASE_POINTS = 20`, then each feature lands in a bin and adds/subtracts points:

| Feature | Bins → points |
|---|---|
| `income_regularity` | ≥.8 **+18** · ≥.6 +12 · ≥.4 +6 · else **−6** |
| `verified_income_share` | ≥.7 **+14** · ≥.4 +8 · else 0 |
| `nsf_count` | 0 **+12** · ≤2 +3 · else **−12** |
| `income_expense_ratio` | ≥1.4 **+8** · ≥1.15 +5 · ≥1.0 +1 · else **−8** |
| `min_balance` | ≥1000 **+6** · ≥0 +2 · else **−8** |
| `balance_volatility` | ≤.4 **+4** · ≤.8 +1 · else **−4** |
| `recurring_obligation_load` | ≤.3 0 · ≤.5 −5 · else **−12** |

```
raw   = 20 + Σ bin points
score = clamp(round(raw), 1, 99)
PD    = clamp(round(1.39 · (1 − score/99)² , 3), 0.002, 0.99)
risk  = "low" if PD < 0.06  else  "medium" if PD < 0.15  else  "high"
```

Output `ScoreResult{tabaqa_score, pd, risk_flag, reasons[top-3 codes], reason_codes[all, signed]}`. Each `ReasonCode{code, label, points, polarity}` is a plain-language line — directly the API's explainability payload.

### 8.8 · Service ② — the financing-risk calculator (spec)

**Status: specced here, planned as `/v1/affordability` (Day 3).** It's a thin, transparent layer over the Service ① output — it reuses `recurring_obligation_load` (× income = existing monthly obligations) and the verified income.

**Inputs:** `amount P`, `tenor n` (months), annual `rate` (→ monthly `i = rate/12`), `existing_obligations` (default = `recurring_obligation_load × income`, or SIMAH, or user), `dbr_cap` (default per SAMA band).

**Math:**

```
annuity_factor AF = ((1+i)^n − 1) / (i·(1+i)^n)          # i=0 → AF = n
installment   A   = P / AF
DBR_after         = (existing_obligations + A) / verified_income
max_installment   = dbr_cap · verified_income − existing_obligations
max_financing     = max(0, max_installment) · AF
decision          = APPROVE if DBR_after ≤ dbr_cap
                    REVIEW  if marginal (near cap, or Tabaqa risk = medium)
                    DECLINE otherwise
```

**Output:** `{installment, dbr_before, dbr_after, dbr_cap, max_installment, max_financing, decision, pd, reasons[]}`. The decisive move is that `verified_income` is the **revealed** income (Service ①), not the bank-only figure — see the worked numbers in [§9](#9-worked-example--fahd-traced-end-to-end).

> **DBR caps are configurable, not hard-coded law.** SAMA Responsible Lending bands: base **33.33%** of salary (salaried) / **25%** (pensioners), rising to **up to 45% _excluding_ real-estate financing** and **55–65% _including_ real-estate financing**. Set per-lender policy; don't quote as fixed regulation on stage. (45% is the *ex-real-estate* ceiling, not inclusive; 65% is the *real-estate-inclusive* ceiling — **not** a retiree band. See [`PROOF.md`](./PROOF.md) §4/§7.)

---

## 9. Worked example — Fahd, traced end-to-end

The fixture [`fahd.json`](./app/data/synthetic/fahd.json) is 3 months (2026-03 → 2026-05) of one applicant: bank `alinma` (opening 8,000) + wallet `barq` (opening 300). Run `python3 smoke_test.py` to reproduce all of this.

**Per-month pattern** — bank: salary +4,000, transfer to Barq −3,000, real-estate installment −800, grocery −600. Wallet: transfer in +3,000, Jahez ~+2,600, HungerStation ~+2,600, P2P "من عبدالله" +800, two purchases (urpay, mada POS).

**[1]+[2] clean+enrich → [3a] reconcile → [3b] verify** assign each row:

| raw_desc | dir | amount | → txn_type | → verification |
|---|---|---|---|---|
| `تحويل برق ٨٨٤٢` (bank) | out | 3,000 | `internal_movement` | matched to wallet "تحويل وارد" |
| `تحويل وارد - حساب بنكي` (wallet) | in | 3,000 | `internal_movement` | — (reconciled, not income) |
| `راتب - شركة الأفق للتجارة` | in | 4,000 | `salary` | **amount_verified** (IBAN+amount ↔ payslip) |
| `JAHEZ-RYD دفعة` | in | ~2,600 | `gig_income` | **source_verified** (Jahez ∈ establishments) |
| `HUNGERSTATION SA` | in | ~2,600 | `gig_income` | **source_verified** |
| `تحويل من عبدالله` | in | 800 | `p2p` | inferred |
| `قسط تمويل عقاري` | out | 800 | `loan_obligation` | — |
| `urpay مشتريات` / `مدى - نقاط بيع` | out | ~2,500 | `purchase` | — |

**[4a] income reveal**

| Component | Monthly | Verification |
|---|---|---|
| Salary — Masdr payslip | **4,000** | `✓ amount_verified` |
| Gig — Jahez / HungerStation | **5,200** | `✓ source_verified` |
| P2P transfers (recurring) | **800** | `~ inferred` |
| **Total true income** | **10,000** | verified share **92%** |
| Bank-only income | **4,000** | → **reveal +6,000** |

**[4b] features** → `income_regularity 1.0` · `income_expense_ratio 1.538` · `avg_balance 4,700` · `min_balance 2,800` · `nsf_count 0` · `recurring_obligation_load 0.08` · `balance_volatility 0.332`.

**[5] score** — every point attributable:

```
base                        20
income_regularity 1.0    →  +18   regular_income
verified_income_share .92 → +14   wallet_income_verified
nsf_count 0              →  +12   zero_nsf
income_expense_ratio 1.54 →  +8   healthy_cashflow
min_balance 2800         →   +6   positive_buffer
balance_volatility .332  →   +4   stable_balance
recurring_obligation .08 →    0   (light debt load)
                          ─────
Tabaqa Score                82      PD 4.1%   risk = low   → APPROVE
top reasons: [regular_income, wallet_income_verified, zero_nsf]
```

**[②] financing calculator** — ask: **SAR 60,000 over 48 months @ 10% APR** (installment ≈ **SAR 1,522/mo**), existing obligation **800/mo**, DBR cap **33%**:

| | Bank-only income (4,000) | Tabaqa verified income (10,000) |
|---|---|---|
| DBR after this loan | (800+1,522)/4,000 = **58.0%** ❌ | (800+1,522)/10,000 = **23.2%** ✅ |
| Max new installment @ 33% | 520 | 2,500 |
| **Max financing** | ≈ **SAR 20,500** | ≈ **SAR 98,600** |
| **Decision** | **DECLINE** | **APPROVE** |

> **Same person. Same SAMA rule. ~4.8× the affordable financing — unlocked by verifying wallet income.** Act 1 (the score) flips decline→approve; Act 2 (the calculator) turns that into a signed, compliant financing line. Nothing is hard-coded — change a transaction in the fixture and every number above moves.

---

## 10. The API reference

FastAPI app (`api/main.py`), version 1.0.0. CORS allows `localhost:5173`. On startup it loads every `data/synthetic/*.json` and registers it by `connection_id`. Interactive docs at `/docs`.

| Method · path | Body / query | Returns |
|---|---|---|
| `GET /health` | — | `{ status, connections[] }` |
| `POST /v1/score` | `{ "connection_id": "con_8842" }` | `ScoreResponse` |
| `GET /v1/profile` | `?connection_id=con_8842` | `ProfileResponse` |
| `POST /v1/access-request` | `{ name, email, company, usecase }` | `{ ok, message }` |
| `POST /v1/affordability` *(planned, §8.8)* | `{ connection_id, amount, tenor_months, apr, existing_obligations?, dbr_cap? }` | `AffordabilityResponse` |

**`POST /v1/score` → `ScoreResponse`** (Fahd):

```jsonc
{
  "tabaqa_score": 82,
  "pd": 0.041,
  "risk_flag": "low",
  "verified_income": 10000,
  "reasons": ["regular_income", "wallet_income_verified", "zero_nsf"],
  "income": {
    "true_monthly_income": 10000, "bank_only_income": 4000,
    "verified_income": 9200, "verified_share": 0.92, "reveal_delta": 6000,
    "components": [ { "label": "Salary — Masdr payslip", "monthly_amount": 4000,
                      "txn_type": "salary", "verification": "amount_verified",
                      "verified_via": "masdr:payslip" }, … ]
  },
  "reason_codes": [ { "code": "regular_income", "label": "Income arrives on a regular monthly schedule",
                      "points": 18, "polarity": "positive" }, … ],
  "applicant": { "id": "applicant_8842", "name": "Fahd A.", "connection_id": "con_8842" }
}
```

**`GET /v1/profile` → `ProfileResponse`** = `{ applicant, income (as above), features (the 6 + metadata), transactions[] }`, where each transaction carries `source, timestamp, amount, direction, raw_desc, merchant, category, txn_type, verification, verified_via` — i.e. the provenance-tagged ledger a lender consumes. Pydantic models live in `api/models.py`.

---

## 11. The frontend

`app/web/` — **React 18 + Vite + TypeScript**, bilingual **EN/AR with RTL**, brand violet/purple + gold. It is the **landing page + a static product mock** (the live, runnable demo is the backend + `smoke_test.py`).

- Sections (`web/src/components/`): `Hero → ProductMock → Features → HowItWorks → Security → ApiSection → Pricing → Faq → SignUp → Footer`.
- i18n in `web/src/i18n/` (`I18nContext` + `strings.ts`); language via the in-page switcher or `?lang=ar`.
- `ApiSection` shows the `POST /v1/score` integration sample; `SignUp` is front-end only for the demo (wire to `/v1/access-request`).
- Dev proxy (`vite.config.ts`): `/v1` → `http://localhost:8000`, so the page can call the API with no CORS friction. `npm run build` → static bundle in `web/dist/`.

---

## 12. Running it

```bash
# ── backend + the zero-dependency proof ───────────────────────────────
cd tabaqa/app
python3 -m venv .venv && source .venv/bin/activate
python3 smoke_test.py                       # NO deps: asserts 4,000→10,000, score 82, PD 0.041
pip install -r requirements.txt             # fastapi, uvicorn, pydantic (+ optbinning/pandas to train)
uvicorn api.main:app --reload --port 8000   # /docs · /v1/score · /v1/profile
curl -X POST localhost:8000/v1/score -H 'Content-Type: application/json' -d '{"connection_id":"con_8842"}'

# ── frontend ──────────────────────────────────────────────────────────
cd web && npm install && npm run dev         # http://localhost:5173  (proxies /v1 → :8000)

# ── train the real PD model on Berka (optional) ───────────────────────
python -m scoring.train                      # needs optbinning + Berka tables in data/berka/
```

`requirements.txt` is layered: the API needs only `fastapi / uvicorn / pydantic`; `optbinning / scikit-learn / pandas / numpy` are for training; CAMeL Tools / XGBoost / SHAP are commented stretch installs.

---

## 13. Repository layout — file by file

```
tabaqa/
├── README.md                 ← this reference
├── PRD.md  UI.md  VS_LEAN.md  RESOURCES.md     ← pitch / UI spec / battle-card / OSS
└── app/
    ├── smoke_test.py         ← runs Fahd end-to-end; asserts the demo numbers (no deps)
    ├── requirements.txt      ← layered deps (API · train · stretch)
    ├── api/
    │   ├── main.py           ← FastAPI app, fixture registry, the 4 endpoints
    │   └── models.py         ← Pydantic request/response models
    ├── pipeline/
    │   ├── schema.py         ← Transaction dataclass + controlled vocab
    │   ├── clean.py          ← [1] normalize Arabic/Latin; LLM long-tail stub
    │   ├── enrich.py         ← [2] merchant/category/type rule tables
    │   ├── reconcile.py      ← [3a] bank↔wallet transfer matching (anti-double-count)
    │   ├── verify.py         ← [3b] 3-tier Masdr verification + [4a] resolve_income
    │   ├── features.py       ← [4b] the six cash-flow features
    │   └── pipeline.py       ← run_pipeline() orchestrator → ProfileResult
    ├── scoring/
    │   ├── scorecard.py      ← [5] transparent additive score → ScoreResult
    │   └── train.py          ← optbinning Scorecard trainer on Berka (skeleton)
    ├── data/
    │   ├── synthetic/fahd.json   ← the flagship demo fixture
    │   └── berka/                ← (not committed) training tables
    └── web/                  ← React + Vite bilingual landing + product mock
```

---

## 14. Extending it

- **Add an applicant:** drop a `data/synthetic/<name>.json` with a unique `connection_id` (same fixture shape). The API auto-registers it on startup; `/v1/score` and `/v1/profile` work immediately.
- **Swap the demo scorecard for the trained model:** `scoring/train.py` fits an `optbinning.Scorecard` on Berka and saves `scorecard.pkl`. Load it inside `score_profile` — the `(features → ScoreResult)` contract is unchanged, so the API and dashboard don't move. Implement `load_berka_features()` to derive the same six features per account over the pre-loan window, labeled by loan status.
- **Plug in real cleaning/enrichment:** replace `clean.clean_with_llm` with a Claude Opus 4.8 call and front `enrich` with banking-class / AraBERT for the long-tail. Keep the deterministic rules as the fast path for the known 80%.
- **Build Service ②:** add `affordability.py` implementing **§8.8** and an `/v1/affordability` endpoint that calls `run_pipeline` + the calculator.
- **Wire real sources:** swap the fixture loader for AIS adapters (Lean/Tarabut) + a wallet feed adapter + the Masdr APIs; persist to Supabase.

---

## 15. Roadmap, status & honesty box

**3-day build plan**
- **Day 1** — ingestion adapters + canonical schema; bank AIS sandbox + wallet feed; clean + enrich; load Berka → 6 features.
- **Day 2** — `optbinning.Scorecard` → 1–99 + reason codes; reconcile + Masdr verify (3-tier). *(Stretch: XGBoost + SHAP.)*
- **Day 3** — Service ① API + dashboard (the Fahd reveal) **and** Service ② calculator (`/v1/affordability` + DBR screen), polished.

**Status:** Service ① runs **end-to-end today** (`smoke_test.py` proves 4,000→10,000, score 82). Service ② is **specced** (**§8.8**) — a thin layer over the existing score + `recurring_obligation_load`. MVP is **AIS read-only, no PIS → no license to demo**; wallet via consent/data-processor.

**Honesty box (own it before judges do)**
- ✅ **Verified:** US precedents (Nova Credit **$45M Series C**; Plaid LendScore; Method $60M); Tarabut & Drahim enrichment live in KSA; SAMA Counter-Fraud framework in force. Full cited evidence base in [`PROOF.md`](./PROOF.md).
- ⚠️ **Gated assumption:** wallet-data access (EMIs not OB providers yet) — demo on consented/simulated data.
- ⚠️ **Inferred:** that *no* Saudi player ships a cash-flow PD score — verify SIMAH / Forus / Tweeq before committing.
- ⚠️ **Configurable, not law:** the DBR bands (33/45/65%) are illustrative — set per-lender policy.
- ⚠️ **Vendor self-reported:** LendScore +9.1% lift; Drahim 2.5B-txn figure. **Not yet grounded:** the KSA cash-flow-underwriting TAM.

---

## 16. Business model, naming & brand

**B2B, consumer-free — the lender pays**, priced like a data bureau (SIMAH/Masdr) and like the US precedents: per-**Score**, per-**Risk** check, per-**Finance** calculation, recurring **Monitor** re-scoring; plus platform tiers + rev-share per funded loan (white-label via Lean/Tarabut). Land **Alinma as customer #1**. Marginal cost per score ≈ one AIS pull + compute → 80%+ gross margin; the labeled-default flywheel compounds. Full moat & pricing → [`PRD.md`](./PRD.md) / [`VS_LEAN.md`](./VS_LEAN.md).

**Naming.** **Tabaqa** (the platform) → **Tabaqa Score · درجة طبقة** (1–99) · **Tabaqa Risk · درع طبقة** (fraud flag) · **Tabaqa Finance · حاسبة طبقة** (financing-risk calculator).

**Brand.** Primary violet/purple + gold; motif = **layers peeling back to reveal** (Tabaqa = "the Layer"). Arabic-first, RTL, EN toggle.

---

### See also
- [`PROOF.md`](./PROOF.md) (cited evidence pack) · [`PRD.md`](./PRD.md) · [`UI.md`](./UI.md) · [`VS_LEAN.md`](./VS_LEAN.md) · [`RESOURCES.md`](./RESOURCES.md) · [`app/README.md`](./app/README.md) · [`app/data/README.md`](./app/data/README.md)
- Proof pack: [`../docs/research/17-cashflow-score-proof.md`](../docs/research/17-cashflow-score-proof.md) · Arabic PDF [`../Proof_CashFlow_Score_AR.pdf`](../Proof_CashFlow_Score_AR.pdf) · Idea ranking [`../Open_Banking_Ideas_Ranking_AR.pdf`](../Open_Banking_Ideas_Ranking_AR.pdf)
