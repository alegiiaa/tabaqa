# Tabaqa · `app/`

The application: a **FastAPI scoring service** and a **React dashboard**, sharing one
pure-stdlib pipeline:

```
bank + wallet statements → clean → enrich → reconcile → verify → features → 1–99 score → affordability
```

The engine is general — `run_pipeline()` scores **any** `{applicant, accounts, masdr,
transactions}` payload. Applicants come from bundled fixtures, a guided form (synthesized
into a realistic statement), sample personas, or **uploaded real statements** (any bank or
wallet export, via the universal adapter).

## Layout

```
app/
├── api/
│   ├── main.py             FastAPI app + routes
│   ├── models.py           Pydantic request/response models
│   ├── auth.py             API-key tiers: anonymous / sandbox / live + rate limits
│   ├── keystore.py         stdlib PostgREST client for api_keys + metering (fails open)
│   └── personas.py         sample applicants (synthesized at startup)
├── pipeline/
│   ├── pipeline.py         orchestrator: clean → enrich → reconcile → verify → income → features
│   ├── clean.py            Arabic normalization (digits, diacritics, letter variants)
│   ├── enrich.py           merchant + category + first-pass txn_type (rules)
│   ├── llm.py              LLM long-tail assist — ALLaM (Groq) or Claude, rules fallback
│   ├── insights.py         the financial-narrative generator behind /v1/insights
│   ├── reconcile.py        bank↔wallet transfer matching → internal_movement (no double-count)
│   ├── verify.py           3-tier Masdr verification + income resolution (the reveal)
│   ├── pfc.py              Plaid Personal Finance Category taxonomy
│   ├── features.py         the cash-flow features
│   ├── synthesize.py       guided form → realistic fixture
│   └── schema.py           canonical Transaction dataclass + vocabularies
├── scoring/
│   ├── scorecard.py        transparent additive 1–99 score + reason codes
│   └── train.py            optbinning Scorecard trainer (Berka)
├── affordability.py        annuity → installment → DBR → APPROVE/REVIEW/DECLINE
├── sama.py                 SAMA responsible-lending caps (per-lender policy knobs)
├── eval/                   model validation — see eval/README.md
├── data/                   synthetic fixtures + personas — see data/README.md
├── supabase/migrations/    access_requests · profiles · applicants · scores · api_keys (RLS)
├── web/                    React + Vite frontend — see web/README.md
└── smoke_test.py           zero-dependency end-to-end check
```

`pipeline/`, `scoring/`, `affordability.py`, and `sama.py` are **pure stdlib** — the full
reveal-score-afford loop needs zero third-party packages. FastAPI only serves it;
Supabase provides auth, persistence, and API keys; optbinning/pandas are only for
training on Berka.

## Run it

### 1 · Engine (no dependencies)

```bash
cd app && python3 smoke_test.py     # Fahd end-to-end: asserts 4,000 → 10,000 + score 82
```

### 2 · API

```bash
cd app
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # or: pip install fastapi "uvicorn[standard]" pydantic
uvicorn api.main:app --reload --port 8000
```

Endpoints (interactive docs at `http://localhost:8000/docs`):

| Method · Path | Body / Query | Returns |
|---|---|---|
| `GET  /health` | — | `{ status, connections, keyed }` |
| `POST /v1/keys` | `{ email?, name? }` | a sandbox API key (`tbq_sk_…`), shown once |
| `POST /v1/score` | `{ connection_id }` **or** `{ form }` **or** `{ fixture }` | score + reveal + reason codes + income breakdown |
| `GET  /v1/profile` | `?connection_id=…` | income breakdown + features + tagged transactions |
| `POST /v1/insights` | `{ connection_id }` or fixture | the ALLaM/rules financial narrative |
| `POST /v1/affordability` | amount, tenor, rate, obligations, DBR cap | installment, DBR before/after, max financing, decision |
| `GET  /v1/personas` | — | sample applicants for the gallery |
| `POST /v1/access-request` | `{ name, email, company, usecase }` | capture a "Request access" submission |

Optional environment:

| Variable | Effect |
|---|---|
| `TABAQA_LLM_PROVIDER` + `GROQ_API_KEY` | live ALLaM narratives/enrichment (`groq`), or `ANTHROPIC_API_KEY` for Claude |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | enables `/v1/keys` issuance + per-key metering (`/health` reports `keyed: true`) |
| `CORS_ORIGINS` | comma-separated allowed origins (default localhost dev) |

Everything fails open: with none of these set, the API runs fully in demo mode.

### 3 · Supabase (auth + persistence)

```bash
# app/web/.env.local  (git-ignored)
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Schema lives in `supabase/migrations/` (apply with `supabase db push` or the SQL editor).
All tables are row-level-security locked.

### 4 · Frontend

```bash
cd app/web
npm install
npm run dev          # http://localhost:5173  (proxies /v1 → :8000)
```

`npm run build` → static bundle in `web/dist/`. Bilingual (EN default, `?lang=ar` or the
in-page switcher for Arabic RTL).

## How a form becomes a real score

`pipeline/synthesize.py` writes transactions whose Arabic descriptions / IBANs / merchants
are then classified by the **real** pipeline — the generator produces honest inputs, the
engine decides everything:

| Form input | Generated line | Pipeline verdict |
|---|---|---|
| salary + employer | `راتب - <employer>` on the **bank**, `counterparty_iban == payslip.iban` | salary, **amount_verified** (`masdr:payslip`) |
| gig platform (e.g. Jahez) | `JAHEZ-RYD دفعة` on the **wallet**, platform in `masdr.establishments` | gig, **source_verified** (`masdr:establishment`) |
| P2P inflow | `تحويل من <name>` on the **wallet** | p2p, **inferred** (`none`) |
| obligation | `قسط تمويل - <label>` (bank outflow) | loan_obligation |
| card spending | `مدى - نقاط بيع` (bank outflow) | purchase (expense) |

Salary goes to the **bank**, gig/P2P to the **wallet** — so a bank-only view sees only the
salary and Tabaqa surfaces the rest. That is the reveal, reproduced for any applicant.

## The verification tiers

Income is tagged by how strongly each source is proven — a P2P transfer is never
blanket-tagged as Masdr-verified:

| Tier | Rule | `verified_via` | Confidence |
|---|---|---|---|
| **amount_verified** | `counterparty_iban == payslip.iban` **and** `\|amount − wage\| ≤ max(1, 5%·wage)` | `masdr:payslip` | 0.99 |
| **source_verified** | merchant ∈ Masdr `establishments` (payer real, amount from txn) | `masdr:establishment` | 0.90 |
| **inferred** | recurring P2P, no external confirmation | `none` | 0.50 |

`bank_only_income` = income inflows on `bank:*` sources only; `total_income` = all
verified + inferred income; `reveal_delta = total − bank_only`.

## Affordability

Pure function in `affordability.py`; the decisive input is **verified_income** (the
reveal), not bank-only income:

```
i   = annual_rate / 12
AF  = ((1+i)^n − 1) / (i·(1+i)^n)            # i = 0 → AF = n   (annuity factor)
installment      = amount / AF
DBR_after        = (existing_obligations + installment) / verified_income
max_installment  = dbr_cap · verified_income − existing_obligations
max_financing    = max(0, max_installment) · AF

decision = APPROVE / REVIEW / DECLINE        # vs the SAMA cap + the risk flag
```

The DBR cap is a per-lender policy knob (`sama.py` implements the SAMA
responsible-lending bands; demo default 33%).

## The score

`base 20 + Σ binned feature points → clamp(1, 99)`; every point is attributable to a
feature bin, so the score decomposes directly into adverse-action reason codes:

| Feature | Points by bin |
|---|---|
| income_regularity | ≥.8 → +18 · ≥.6 → +12 · ≥.4 → +6 · else −6 |
| verified_income_share | ≥.7 → +14 · ≥.4 → +8 · else 0 |
| nsf_count | 0 → +12 · ≤2 → +3 · else −12 |
| income_expense_ratio | ≥1.4 → +8 · ≥1.15 → +5 · ≥1.0 → +1 · else −8 |
| min_balance | ≥1000 → +6 · ≥0 → +2 · else −8 |
| balance_volatility | ≤.4 → +4 · ≤.8 → +1 · else −4 |
| recurring_obligation_load | ≤.3 → 0 · ≤.5 → −5 · else −12 |

`PD = clamp(round(1.39·(1 − score/99)², 3), 0.002, 0.99)`;
`risk = low (<.06) · medium (<.15) · high`.

To swap in the trained model: fit on Berka (`python -m scoring.train`, see
[`data/README.md`](data/README.md)) and load the persisted scorecard in `score_profile` —
the `(features → ScoreResult)` contract is unchanged, so the API and dashboard don't move.

## The dashboard

Sign in (Supabase auth), create an applicant (guided form, sample persona, or upload real
statements), then explore: the **reveal** (bank-only vs verified income), the **score**
with reason codes, the provenance-tagged **ledger**, the **affordability** calculator, the
**AI insights** narrative, the **model-validation** panel (bureau ↔ wallet toggle), and
the printable **credit report** (`/report`) with QR verification (`/verify`). Each
applicant + score persists per-user behind row-level security.
