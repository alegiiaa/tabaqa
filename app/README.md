# Tabaqa · `app/`

The buildable application — a **React landing page + a real multi-user dashboard**
and the **Python scoring engine** behind it. Implements the pipeline from the root
[`README.md`](../README.md):

```
Open-banking AIS (bank) + wallet (Barq) → clean → enrich → reconcile → verify → 6 features → 1–99 score → affordability
```

## The idea (and where Barq fits)

A lender can only see a borrower's **bank** statement, where a gig/side income
"vanishes into Barq" (the digital wallet) and the salary looks like the whole
story. **Tabaqa pulls bank + wallet together, verifies each income source, and
reveals the borrower's true income** — then scores it and runs an affordability
check. Barq is the wallet where the hidden income lands; **"the reveal"** is
surfacing it (and reconciling the bank↔Barq transfers so nothing is
double-counted).

### What's new: it's a real app, not a single demo

The engine was always general — `run_pipeline()` scores **any**
`{applicant, accounts, masdr, transactions}` payload. The old API just looked up
one hardcoded fixture ("Fahd"). Now **any user / any judge can test it on their
own applicant**:

1. **Sign in** (Supabase auth — email/password or Google).
2. **Create an applicant** two ways:
   - a **guided form** — salary + employer, gig platforms (Jahez / HungerStation /
     Mrsool / Careem / Uber), P2P/wallet inflows, monthly obligations, card
     spending, # months. The backend **synthesizes a realistic bank+wallet
     statement + matching Masdr ground-truth** and runs the *real* pipeline.
   - or pick a **sample persona** (salaried, gig-only driver, small-business
     owner, thin-file) for one-click testing.
3. **See the result** across four screens: the reveal, the score + reason codes,
   the unified transaction ledger (3-tier provenance tags), and the affordability
   calculator.
4. **It persists** — each applicant + score is saved to your account (Supabase,
   row-level-security so users only see their own).

Nothing is hard-coded to Fahd: the same engine runs on whatever a judge types in.

---

## Layout

```
app/
├── web/                React + Vite — landing + auth + dashboard (bilingual EN/AR, RTL)
│   └── src/
│       ├── auth/           Supabase auth: AuthContext, RequireAuth guard
│       ├── components/     landing sections + dashboard + the 4 screens
│       ├── lib/supabase.ts Supabase client (reads web/.env.local)
│       └── i18n/           EN/AR strings + RTL context
├── api/
│   ├── main.py             FastAPI app + routes
│   ├── models.py           Pydantic request/response models (incl. the applicant form)
│   └── personas.py         sample applicants (synthesized at startup)
├── pipeline/
│   ├── pipeline.py         orchestrator: clean → enrich → reconcile → verify → income → features
│   ├── clean.py            Arabic normalization (dediac, digit-fold, variant-fold)
│   ├── enrich.py           merchant + category + first-pass txn_type (rules)
│   ├── reconcile.py        match bank↔wallet transfers → internal_movement (no double-count)
│   ├── verify.py           3-tier Masdr verification + income resolution (the reveal)
│   ├── features.py         the 6 cash-flow features
│   ├── schema.py           canonical Transaction dataclass + vocabularies
│   └── synthesize.py       ★ form → realistic fixture (the "any applicant" bridge)
├── scoring/
│   ├── scorecard.py        transparent additive 1–99 score + reason codes
│   └── train.py            Berka training stub (optbinning Scorecard)
├── affordability.py        ★ Service ② — annuity → installment → DBR → APPROVE/REVIEW/DECLINE
├── supabase/
│   ├── config.toml
│   └── migrations/         access_requests · profiles · applicants · scores (all RLS)
├── data/synthetic/         fahd.json (the canonical reveal) + personas
├── smoke_test.py
└── requirements.txt

★ = new for the multi-user build (see Status below for what's wired vs in progress).
```

`pipeline/`, `scoring/`, and `affordability.py` are **pure-stdlib** — the full
reveal-score-afford loop runs with zero third-party packages. FastAPI only
*serves* it; Supabase handles auth + per-user persistence; optbinning/pandas are
only for *training* the real model on Berka.

---

## Run it

### 1 · Backend (API)

```bash
cd app
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # or: pip install fastapi "uvicorn[standard]" pydantic
uvicorn api.main:app --reload --port 8000
```

Endpoints (`http://localhost:8000/docs` for interactive):

| Method · Path | Body / Query | Returns |
|---|---|---|
| `GET  /health` | — | `{ status, connections }` |
| `GET  /v1/personas` | — | sample applicants for the gallery (id, name, role, headline numbers) |
| `POST /v1/score` | `{ connection_id }` **or** `{ form }` **or** `{ fixture }` | score + reveal + reason codes + income breakdown |
| `GET  /v1/profile` | `?connection_id=con_8842` | income breakdown + 6 features + tagged transactions |
| `POST /v1/affordability` | `{ amount, tenor_months, annual_rate, verified_income, existing_obligations, dbr_cap, bank_only_income?, risk_flag }` | installment, DBR before/after, max financing, decision |
| `POST /v1/access-request` | `{ name, email, company, usecase }` | capture a "Request access" submission |

`POST /v1/score` accepts **one of**: a preset `connection_id`, a high-level
`form` (synthesized into a statement, then scored), or a full inline `fixture`.

**No-dependency check** (proves the engine before installing anything):

```bash
cd app && python3 smoke_test.py     # Fahd end-to-end: asserts 4,000 → 10,000 + score 82
```

### 2 · Supabase (auth + persistence)

Auth and per-user storage run on a hosted Supabase project. Configure the web app:

```bash
# app/web/.env.local  (git-ignored — copy from .env.example)
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Schema lives in `supabase/migrations/` (apply with `supabase db push`, or the
Supabase SQL editor). Tables: `access_requests`, `profiles`, `applicants`,
`scores` — all with row-level security. See [`CHECKLIST.md`](CHECKLIST.md) for
the exact project/auth setup steps and gotchas.

### 3 · Frontend

```bash
cd app/web
npm install
npm run dev          # http://localhost:5173  (proxies /v1 → :8000)
```

`npm run build` → static bundle in `web/dist/`. Bilingual (EN default,
`?lang=ar` or the in-page switcher for Arabic RTL).

---

## How a form becomes a real score

`pipeline/synthesize.py` is the bridge that makes Tabaqa testable by anyone. It
writes transactions whose Arabic descriptions / IBANs / merchants are classified
by the **real** pipeline — we generate honest inputs, the engine decides
everything:

| Form input | Generated line | Pipeline verdict |
|---|---|---|
| salary + employer | `راتب - <employer>` on the **bank**, `counterparty_iban == payslip.iban` | salary, **amount_verified** (`masdr:payslip`) |
| gig platform (e.g. Jahez) | `JAHEZ-RYD دفعة` on the **wallet**, platform listed in `masdr.establishments` | gig, **source_verified** (`masdr:establishment`) |
| P2P inflow | `تحويل من <name>` on the **wallet** | p2p, **inferred** (`none`) |
| obligation | `قسط تمويل - <label>` (bank outflow) | loan_obligation |
| card spending | `مدى - نقاط بيع` (bank outflow) | purchase (expense) |

Salary goes to the **bank**, gig/P2P to the **wallet** — so a bank-only view sees
only the salary and Tabaqa surfaces the rest. That's the reveal, reproduced for
any applicant.

---

## The reveal & 3-tier verification (the credibility play)

Income is tagged by how strongly each source is proven — we never blanket-tag a
P2P transfer as Masdr-verified:

| Tier | Rule | `verified_via` | Confidence |
|---|---|---|---|
| **amount_verified** | `counterparty_iban == payslip.iban` **and** `\|amount − wage\| ≤ max(1, 5%·wage)` | `masdr:payslip` | 0.99 |
| **source_verified** | merchant ∈ Masdr `establishments` (payer real, amount from txn) | `masdr:establishment` | 0.90 |
| **inferred** | recurring P2P, no external confirmation | `none` | 0.50 |

`bank_only_income` = income inflows on `bank:*` sources only. `total_income` =
all verified+inferred income. `reveal_delta = total − bank_only`.

**Fahd (the canonical demo):** 4,000 salary (amount) + 5,200 gig (source) + 800
P2P (inferred) = **10,000 true income** vs **4,000 bank-only** → verified share
92% → **Score 82 · PD 4.1% · low risk**.

---

## Affordability — Service ② (README §8.8)

Pure function in `affordability.py`; the decisive input is **verified_income**
(the reveal), not bank-only income:

```
i   = annual_rate / 12
AF  = ((1+i)^n − 1) / (i·(1+i)^n)            # i = 0 → AF = n   (annuity factor)
installment      = amount / AF
DBR_before       = existing_obligations / verified_income
DBR_after        = (existing_obligations + installment) / verified_income
max_installment  = dbr_cap · verified_income − existing_obligations
max_financing    = max(0, max_installment) · AF

decision = APPROVE   if DBR_after ≤ dbr_cap and risk = low
           REVIEW    if marginal (near the cap) or Tabaqa risk = medium
           DECLINE   if DBR_after > dbr_cap or risk = high
```

DBR cap is a per-lender policy knob (demo uses **33%**). Headline comparison: the
calculator shows max financing under **bank-only** vs **verified** income — the
gap is the value Tabaqa unlocks (Fahd: SAR 60k / 48mo / 10% APR → **APPROVE**,
DBR_after ≈ 23%).

---

## The score (transparent, additive — no black box)

`base 20 + Σ binned feature points → clamp(1, 99)`; every point is attributable
to a feature bin (what a SAMA-minded reviewer wants):

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

To use the trained model: train on Berka (`python -m scoring.train`, see
[`data/README.md`](data/README.md)) and load the persisted scorecard in
`score_profile` — the `(features → ScoreResult)` contract is unchanged, so the
API and dashboard don't move.

---

## The four dashboard screens

| # | Screen | Content |
|---|---|---|
| ① | **The reveal** | bank-only vs Tabaqa income, side by side; breakdown table with the 3 verification tags; reconciliation note (bank↔Barq transfer marked internal) |
| ② | **The score** | 1–99 score, risk flag, PD; reason codes split positive / negative |
| ③ | **The ledger** | unified bank + wallet transactions, each row provenance-tagged; raw → cleaned description |
| ④ | **Affordability** | amount / tenor / rate / obligations / DBR-cap inputs → installment, DBR before-after, max financing, APPROVE/REVIEW/DECLINE, and the bank-only-vs-verified headline |

---

## Status (resume here)

Granular tracking in [`CHECKLIST.md`](CHECKLIST.md). Snapshot:

| Area | State |
|---|---|
| Engine (pipeline + scorecard) | ✅ general; `smoke_test.py` asserts the Fahd reveal |
| `pipeline/synthesize.py` (form → fixture) | ✅ built & verified (a Fahd-like form reproduces 4,000→10,000, score 82) |
| Supabase auth (email/pw + OAuth) + project | ✅ live; `web/.env.local` wired |
| DB: `access_requests`, `profiles` (+ trigger, RLS) | ✅ applied |
| Landing page + SignUp → `access_requests` | ✅ wired (bilingual EN/AR RTL) |
| `POST /v1/score` accepts `form` / `fixture` | ⏳ planned (currently `connection_id` only) |
| `affordability.py` + `POST /v1/affordability` | ⏳ planned |
| `api/personas.py` + `GET /v1/personas` | ⏳ planned |
| DB: `applicants`, `scores` (per-user RLS) | ⏳ planned |
| Dashboard (4 screens + new-applicant form) | ⏳ planned (`AppHome.tsx` is still a placeholder) |
| Deploy (host web + API) | ◦ stretch |
