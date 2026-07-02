<p align="center">
  <img src="assets/header.gif" alt="Tabaqa — the credit-intelligence layer for Saudi open banking" width="100%" />
</p>

<h1 align="center">Tabaqa · طبقة</h1>

<p align="center">
  <strong>The credit-intelligence layer for Saudi open banking.</strong><br />
  Bank + wallet statements, in any export format → verified income, an explainable 1–99 score,<br />
  and a SAMA-aligned affordability decision.
</p>

<p align="center">
  <a href="https://tabaqa.vercel.app"><strong>Live app</strong></a> ·
  <a href="https://tabaqa.vercel.app/demo">Instant demo</a> ·
  <a href="https://tabaqa.vercel.app/developers">Developer docs &amp; playground</a> ·
  <a href="https://tabaqa-api.vercel.app/docs">API (Swagger)</a>
</p>

---

## What it does

A bank statement shows a lender only part of a person's income — gig pay (Jahez, HungerStation, Mrsool) and side income often land in a digital wallet (Barq, urpay) that the bank cannot see. Tabaqa ingests statements from **both**, with the person's consent, fuses them into one canonical ledger, and returns what a credit team needs to decide:

| Output | What it is |
|---|---|
| **Verified income** | Every income source tagged with 3-tier provenance: `amount_verified` (payslip wage + salary-IBAN match) › `source_verified` (registered establishment) › `inferred` |
| **Tabaqa Score** | A transparent additive **1–99 score** + probability of default. Every point maps to a plain-language reason code — the model is its own explanation |
| **Affordability decision** | Installment, debt-burden ratio before/after vs SAMA responsible-lending caps → **APPROVE / REVIEW / DECLINE** |
| **AI insights** | An Arabic/English financial narrative from **ALLaM** (`allam-2-7b`, the Saudi national model) with a deterministic rules fallback — the LLM writes prose, never the decision |
| **Credit report** | A print-ready, Arabic-first attestation (`/report`) with a QR code that resolves to a verification page (`/verify`) |

**Example** — the bundled applicant *Fahd*: his bank sees **4,000 SAR/month**. Tabaqa fuses his wallet, reconciles the internal transfers, verifies the gig income against Masdr, and finds **10,000 SAR/month** (92% verified) → score **82**, PD 4.1%. A 60,000 SAR / 48-month financing request flips from **DECLINE** (DBR 58% on bank-only income) to **APPROVE** (DBR 23% on verified income). Same person, same rules — the difference is visibility.

## How it works

```
any bank / wallet export
      │
      ▼
 [0] adapt ──▶ [1] clean ──▶ [2] enrich ──▶ [3] reconcile ──▶ [4] verify
      │
      ▼
 [5] features ──▶ [6] score ──▶ [7] affordability ──▶ score · PD · reasons · decision
```

| Stage | Where | What it does |
|---|---|---|
| 0 · Adapt | `app/web/src/lib/adapters.ts` | Detects any statement format: Arabic/English headers, Hijri dates, Arabic-Indic digits, debit/credit vs signed amounts, per-institution fingerprints |
| 1 · Clean | `app/pipeline/clean.py` | Normalizes Arabic text and digits in transaction descriptions |
| 2 · Enrich | `app/pipeline/enrich.py` | Labels merchant + category (rules first, LLM for the long tail) |
| 3 · Reconcile | `app/pipeline/reconcile.py` | Matches bank↔wallet transfers and tags both legs `internal_movement` — income is never double-counted across sources |
| 4 · Verify | `app/pipeline/verify.py` | Stamps 3-tier income provenance against Masdr ground truth + the Plaid PFC taxonomy (`pfc.py`) |
| 5 · Features | `app/pipeline/features.py` | Seven cash-flow features (regularity, volatility, NSF, obligations, …) |
| 6 · Score | `app/scoring/scorecard.py` | Additive points → 1–99 score → PD → reason codes |
| 7 · Affordability | `app/sama.py` · `app/affordability.py` | Annuity math + SAMA responsible-lending caps → decision |

The pipeline and scorer are **pure Python stdlib** — the whole reveal-and-score loop runs with zero third-party packages (`python3 app/smoke_test.py` proves it). FastAPI only serves it; the LLM only labels messy strings. Full methodology and feature definitions: [`app/ALGORITHM.md`](app/ALGORITHM.md).

## The API

Base URL `https://tabaqa-api.vercel.app` — interactive docs at [`/docs`](https://tabaqa-api.vercel.app/docs), guide + playground at [tabaqa.vercel.app/developers](https://tabaqa.vercel.app/developers).

| Endpoint | What it returns |
|---|---|
| `POST /v1/score` | Score + PD + reason codes + the income reveal (by `connection_id`, guided `form`, or inline `fixture`) |
| `GET /v1/profile` | Income breakdown, the 7 features, and the provenance-tagged ledger |
| `POST /v1/affordability` | Installment, DBR before/after, max financing, APPROVE/REVIEW/DECLINE |
| `POST /v1/insights` | The ALLaM/rules financial narrative |
| `GET /v1/personas` | Sample applicants (salaried, gig-only, thin-file, …) |
| `POST /v1/keys` | Self-serve **sandbox API key** (`tbq_sk_…`) |
| `GET /health` | Service status |

```bash
curl -X POST https://tabaqa-api.vercel.app/v1/score \
  -H 'Content-Type: application/json' \
  -d '{"connection_id": "con_8842"}'
# → { "tabaqa_score": 82, "pd": 0.041, "risk_flag": "low",
#     "income": { "bank_only_income": 4000, "true_monthly_income": 10000, ... }, ... }
```

Anonymous calls work out of the box. A sandbox key from `POST /v1/keys` adds attribution and per-day metering (`X-RateLimit-*` headers). Full reference: [`app/API_REFERENCE.md`](app/API_REFERENCE.md).

## Model validation

Measured, not asserted — everything reproducible from [`app/eval/`](app/eval):

- **Real-default validation** ([`DATA_REPORT.md`](app/eval/DATA_REPORT.md)) — the same cash-flow features, fit on Berka/PKDD'99 (682 real loan accounts, strictly pre-loan windows): holdout **AUC 0.890 / KS 0.683**, 5-fold CV **0.858**, monotonic default bands 38.7% → 0%.
- **Wallet-layer ablation** ([`ABLATION.md`](app/eval/ABLATION.md)) — bureau-style view **0.661** → with the wallet layer **0.864 AUC** (+0.203, 95% CI +0.144…+0.268); on thin-file borrowers 0.596 → 0.775.
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
│   ├── web/                 React + Vite app — landing, dashboard, /developers, /report
│   └── smoke_test.py        zero-dependency end-to-end check
├── assets/                  README media
├── branding/                logo marks
└── render.yaml              alternative API deployment (Render)
```

## Deployment

Live on Vercel — web ([tabaqa.vercel.app](https://tabaqa.vercel.app)) + API ([tabaqa-api.vercel.app](https://tabaqa-api.vercel.app)) — with Supabase for auth, persistence, and API keys. Recipes and environment variables: [`app/DEPLOY.md`](app/DEPLOY.md).

---

<sub>Built for the AMAD Hackathon 2026 (Alinma × Tuwaiq), open-banking track. Bilingual English/Arabic with full RTL. All demo data is synthetic; the training dataset (Berka/PKDD'99) is public and anonymized — no real personal data appears anywhere in this repository.</sub>
