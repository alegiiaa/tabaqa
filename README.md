<p align="center">
  <img src="assets/header.gif" alt="Tabaqa — the financing marketplace powered by its own pricing engine" width="100%" />
</p>

<h1 align="center">Tabaqa · طبقة</h1>

<p align="center">
  <strong>A financing marketplace powered by its own pricing engine, built on open banking.</strong><br />
  The applicant connects their bank <em>and</em> their wallet — and gets <strong>real offers from several lenders</strong>.<br />
  Not a form. Not a lead. Not “we’ll call you.” A price.
</p>

<p align="center">
  <a href="https://tabaqa.vercel.app"><strong>Live app</strong></a> ·
  <a href="https://tabaqa.vercel.app/demo">Instant demo</a> ·
  <a href="https://tabaqa.vercel.app/developers">Developer docs &amp; playground</a> ·
  <a href="https://tabaqa-api.vercel.app/docs">API (Swagger)</a>
</p>

---

## What it is

Today's financing marketplaces are lead generators: you fill in a form, you *declare* your income, and your contact details are sold to a lender who calls you days later. You never receive a price — you receive a phone call.

Tabaqa replaces the form with an **engine**. The applicant connects their accounts with their consent; Tabaqa reads the actual cash flow, derives what they can genuinely afford under SAMA's lending caps, runs every lender's published product policy against it, and returns **real, priced offers** — amount, installment, profit rate, fees, total cost — plus counter-offers with the path to the amount they asked for.

That is the difference between an interface and an engine, and it is the whole product:

> **مو واجهة ربط — محرك تسعير.**

**Why the wallet matters.** A bank statement shows a lender only part of a person's income: gig pay (Jahez, HungerStation, Mrsool) and side income often land in a digital wallet (Barq, urpay) the bank cannot see. Tabaqa ingests both, fuses them into one ledger, and prices the person who actually exists.

**The bundled applicant, Fahd.** His bank sees **4,000 SAR/month**. On bank data alone he qualifies for **zero** full offers. Tabaqa fuses his wallet, reconciles the internal transfers, verifies the gig income, and finds **10,000 SAR/month** (92% verified). The same person, the same day, the same lender policies — **four full offers**. The difference is not leniency. It is visibility.

## How the MVP works — five steps

| # | Step | What happens |
|---|---|---|
| **1** | **اربط · Connect** | The applicant connects their bank account **and** their wallet, with consent. Any export format — Arabic or English headers, Hijri dates, debit/credit or signed amounts. |
| **2** | **نشتق · Derive** | The engine fuses both sources into one ledger and derives **verified income**, existing obligations, and the **installment room** left under the SAMA responsible-lending cap. |
| **3** | **اطلب · Request** | The applicant asks for what they need: product type, amount, tenor. The **ceiling is computed live on screen** from their own numbers — no amount ever appears without the arithmetic behind it. |
| **4** | **نسعّر · Price** | Every lender's **published product policy** runs against the profile → **real offers** (amount · installment · rate · fees · total cost), ranked by cost — plus **counter-offers** with the path to the full amount when the request doesn't fit. |
| **5** | **اختر · Choose** | The applicant picks. The **licensed lender makes the final decision** — never Tabaqa. The result is a print-ready, Arabic-first attestation (`/report`) carrying a **QR code** that resolves to a public verification page (`/verify`). |

## The pricing engine

```
bank export  +  wallet export
      │
      ▼
 [0] adapt ──▶ [1] clean ──▶ [2] enrich ──▶ [3] reconcile ──▶ [4] verify
      │
      ▼
 [5] features ──▶ [6] score ──▶ [7] affordability ──▶ [8] offers
                                                          │
                              verified income · SAMA cap · installment room
                                        × each lender's published policy
                                                          ▼
                                       ranked offers + counter-offers
```

| Stage | Where | What it does |
|---|---|---|
| 0 · Adapt | `app/web/src/lib/adapters.ts` | Detects any statement format: Arabic/English headers, Hijri dates, Arabic-Indic digits, debit/credit vs signed amounts, per-institution fingerprints — plus a statement **integrity check** (it refuses rather than guesses) |
| 1 · Clean | `app/pipeline/clean.py` | Normalizes Arabic text and digits in transaction descriptions |
| 2 · Enrich | `app/pipeline/enrich.py` | Labels merchant + category (rules first, LLM for the long tail) |
| 3 · Reconcile | `app/pipeline/reconcile.py` | Matches bank↔wallet transfers and tags both legs `internal_movement` — income is never double-counted across sources |
| 4 · Verify | `app/pipeline/verify.py` | Stamps 3-tier income provenance: `amount_verified` › `source_verified` › `inferred` |
| 5 · Features | `app/pipeline/features.py` | Seven cash-flow features (regularity, volatility, NSF, obligations, …) |
| 6 · Score | `app/scoring/scorecard.py` | Additive points → transparent 1–99 score → PD → reason codes. **One input into pricing — not the product** |
| 7 · Affordability | `app/sama.py` · `app/affordability.py` | Annuity math + SAMA responsible-lending caps → installment room |
| 8 · Offers | `app/web/src/lib/lenders.ts` | Runs each lender's published policy → priced offers + counter-offers |

The pipeline and scorer are **pure Python stdlib** — the whole fuse-and-price loop runs with zero third-party packages (`python3 app/smoke_test.py` proves it). FastAPI only serves it; the LLM only labels messy strings and narrates results — **it never makes a decision**. Full methodology: [`app/ALGORITHM.md`](app/ALGORITHM.md).

### The lender layer

Five demo lenders — a bank, a digital bank, a finance company, a microfinance provider — each modeled as a **published product policy**, never a proprietary formula: score floor, DBR cap, amount and tenor range, rate tiers, admin fee. Real lenders never hand over their underwriting model, but they *do* publish product criteria, and that is what a marketplace runs on. Every policy is clamped to the binding SAMA salary-deduction cap (33.33%), and the offer math mirrors `affordability.py` exactly, so an offer on screen is the same arithmetic the API serves.

**All demo lenders are fictional and labelled illustrative in the UI. The final credit decision always belongs to the licensed lender, and is shown on every offer.**

## The API

Base URL `https://tabaqa-api.vercel.app` — interactive docs at [`/docs`](https://tabaqa-api.vercel.app/docs), guide + playground at [tabaqa.vercel.app/developers](https://tabaqa.vercel.app/developers).

| Endpoint | What it returns |
|---|---|
| **`POST /v1/offers`** | **The pricing engine.** Ranked offers + counter-offers + the locked lenders and why, plus the full `ceiling` derivation and the `bank_only` contrast |
| `GET /v1/lenders` | Every lender's **published product policy** (score floor, DBR cap, ranges, rate tiers) |
| `POST /v1/score` | Score + PD + reason codes + the income reveal (by `connection_id`, guided `form`, or inline `fixture`) |
| `GET /v1/profile` | Income breakdown, the 7 features, and the provenance-tagged ledger |
| `POST /v1/affordability` | Installment, DBR before/after, max financing, APPROVE/REVIEW/DECLINE |
| `POST /v1/insights` | An Arabic/English financial narrative from **ALLaM** (`allam-2-7b`, the Saudi national model), with a deterministic rules fallback |
| `GET /v1/personas` | Sample applicants (salaried, gig-only, thin-file, …) |
| `POST /v1/keys` | Self-serve **sandbox API key** (`tbq_sk_…`) |
| `GET /health` | Service status |

The engine, served — one money picture in, real prices out:

```bash
curl -X POST https://tabaqa-api.vercel.app/v1/offers \
  -H 'Content-Type: application/json' \
  -d '{"connection_id":"con_8842","product":"auto","amount":60000,"tenor_months":48}'
# → { "full_offer_count": 4,
#     "offers": [ { "lender_name_en": "Al Waha Bank", "amount": 60000, "installment": 1434,
#                   "annual_rate": 0.069, "total_cost": 69432, "best": true }, ... ],
#     "ceiling":   { "verified_income": 10000, "sama_cap": 0.3333, "obligations": 800,
#                    "max_installment": 2533, "max_financing": 102963 },
#     "bank_only": { "income": 4000, "full_offer_count": 0 } }
```

Two things in that payload carry the whole product. **`ceiling`** is the derivation — income × the SAMA cap − obligations = the installment room, × the annuity factor = the most any lender will extend — so no number is ever granted without its arithmetic. **`bank_only`** is the reveal: the same request, run on the income a bank can see by itself, returns **0 full offers**. Same person, same day, same lender policies.

`lenders.py` (server) and `lenders.ts` (browser) are deliberate twins — the browser runs the search instantly, the API is the authority, and they agree **to the riyal**. Anonymous calls work out of the box; a sandbox key from `POST /v1/keys` adds attribution and per-day metering (`X-RateLimit-*` headers). Full reference: [`app/API_REFERENCE.md`](app/API_REFERENCE.md).

## Model validation

Measured, not asserted — everything reproducible from [`app/eval/`](app/eval):

- **Real-default validation** ([`DATA_REPORT.md`](app/eval/DATA_REPORT.md)) — the same cash-flow features, fit on Berka/PKDD'99 (682 real loan accounts, strictly pre-loan windows): holdout **AUC 0.890 / KS 0.683**, 5-fold CV **0.858**, monotonic default bands 38.7% → 0%.
- **Wallet-layer ablation** ([`ABLATION.md`](app/eval/ABLATION.md)) — the claim under the whole product, measured: a bureau-style view scores **0.661 AUC**; adding the wallet layer takes it to **0.864** (+0.203, 95% CI +0.144…+0.268). On thin-file borrowers, 0.596 → 0.775. Replicated at full scale on **963,811 real applications / 26,577 defaults** (AlfaBattle 2.0): **+0.117 AUC** [+0.112, +0.121].
- **Synthetic corpus** — a 1M-account Gaussian-copula corpus for scale and segment demos; train-on-synthetic / test-on-real retains **96%** of real-data AUC, so no validation claim ever rests on synthetic data.
- **Enricher accuracy** ([`REPORT.md`](app/eval/REPORT.md)) — measured against a hand-labeled transaction set, with a regression guard (`eval_regression.py`).

The live app renders all of this in the **Model validation** panel, including a bureau-view ↔ wallet-layer toggle.

## Run it locally

```bash
# engine — zero dependencies
cd app
python3 smoke_test.py                        # asserts 4,000 → 10,000, score 82

# API
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000    # http://localhost:8000/docs

# web
cd web && npm install && npm run dev         # http://localhost:5173 (proxies /v1 → :8000)
```

Optional environment: `TABAQA_LLM_PROVIDER=groq` + `GROQ_API_KEY` for live ALLaM insights (or `ANTHROPIC_API_KEY` for the Claude provider); `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to enable API-key issuance and metering. Everything degrades gracefully without them. Details: [`app/README.md`](app/README.md).

## Repository layout

```
tabaqa/
├── app/
│   ├── api/                 FastAPI service — routes, models, API-key auth + metering
│   ├── pipeline/            clean → enrich → reconcile → verify → features (pure stdlib)
│   ├── scoring/             transparent additive scorecard (1–99 + reason codes)
│   ├── affordability.py     annuity + DBR engine        · sama.py — SAMA lending caps
│   ├── eval/                model validation: Berka PD model, ablation, synthetic corpus
│   ├── data/                synthetic Saudi statements + personas (no real personal data)
│   ├── supabase/            migrations — auth, applicants, scores, api_keys (all RLS)
│   ├── web/
│   │   ├── src/lib/adapters.ts    universal statement ingestion + integrity check
│   │   ├── src/lib/lenders.ts     the lender policy layer → priced offers
│   │   └── src/components/        landing, dashboard, marketplace, /developers, /report
│   └── smoke_test.py        zero-dependency end-to-end check
├── assets/                  README media
├── branding/                logo marks
└── render.yaml              alternative API deployment (Render)
```

## Deployment

Live on Vercel — web ([tabaqa.vercel.app](https://tabaqa.vercel.app)) + API ([tabaqa-api.vercel.app](https://tabaqa-api.vercel.app)) — with Supabase for auth, persistence, and API keys. Recipes and environment variables: [`app/DEPLOY.md`](app/DEPLOY.md).

---

<sub>Built for the AMAD Hackathon 2026 (Alinma × Tuwaiq), open-banking track. Bilingual English/Arabic with full RTL. All demo lenders are fictional and illustrative; all demo applicant data is synthetic; the validation datasets (Berka/PKDD'99, AlfaBattle 2.0) are public and anonymized — no real personal data appears anywhere in this repository.</sub>
