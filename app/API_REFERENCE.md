# Tabaqa API Reference

**The credit-intelligence layer for Saudi open banking — as an API.** Pull a
person's bank + wallet transactions, get back verified income, a 1–99 score, a
risk flag, an affordability decision, and a plain-language financial read.

- **Base URL:** `https://tabaqa-api.vercel.app`
- **Interactive docs (Swagger):** `https://tabaqa-api.vercel.app/docs`
- **Content type:** `application/json` on every request and response.
- **Auth:** none for the public demo. *(Production: per-lender API keys via an
  `Authorization: Bearer` header — the scoring engine is stateless, so keys gate
  access and rate, not state.)*

---

## 60-second quickstart

Score the demo applicant "Fahd" — one call returns the reveal, the score, the
labelled transactions, and the financial-intelligence read:

```bash
curl -s https://tabaqa-api.vercel.app/v1/score \
  -H 'Content-Type: application/json' \
  -d '{"connection_id":"con_8842"}'
```

```jsonc
{
  "tabaqa_score": 82,
  "pd": 0.041,
  "risk_flag": "low",
  "income": {
    "true_monthly_income": 10000,   // ← the reveal
    "bank_only_income": 4000,       // ← what a bank alone would see
    "reveal_delta": 6000,
    "verified_share": 0.92
  },
  "reasons": ["regular_income", "wallet_income_verified", "zero_nsf"],
  "insights": { "summary_line": "Fahd A. shows SAR 10,000/mo verified income …", "...": "…" },
  "transactions": [ { "merchant": "Jahez", "pfc_primary": "INCOME", "...": "…" } ],
  "accounts": [ { "provider": "alinma", "current_balance": 8421.0, "...": "…" } ]
}
```

Sample connections you can score immediately: `con_8842` (salaried + gig),
`con_gig_driver`, `con_sme_owner`, `con_thin_file`.

---

## The services

### ⓪ `POST /v1/offers` — **the pricing engine**

One verified money picture in, **real offers out**. Every lender's published product
policy is run against the applicant's income and SAMA installment room. Not a lead,
not a callback — a price.

Income source: `connection_id` (reuse the score) **or** `verified_income` +
`tabaqa_score` + `risk_flag` directly. `amount: null` means *"the maximum I qualify for"*.

```bash
curl -s https://tabaqa-api.vercel.app/v1/offers -H 'Content-Type: application/json' \
  -d '{"connection_id":"con_8842","product":"auto","amount":60000,"tenor_months":48}'
```

| Field | Type | Meaning |
|---|---|---|
| `product` | `auto` \| `personal` \| `goods` | Which lender products to run. |
| `amount` | number \| `null` | Requested amount; `null` → the applicant's maximum. |
| `tenor_months` | int | Requested tenor; clamped into each lender's range. |

**Response:**

| Field | Meaning |
|---|---|
| `offers[]` | `{lender_name_en, amount, installment, annual_rate, admin_fee, total_cost, dbr_after, best}` — ranked, cheapest full-amount offer flagged `best`. |
| `offers[].reduced_from` | **Counter-offer**: the request didn't fit the cap, this amount does. |
| `locked[]` | Lenders that can't serve this applicant + the exact `reason` (`score` · `risk` · `dbr` · `amount_range`) — the path to the rest. |
| `full_offer_count` | Offers at the **full** requested amount. The headline number. |
| `ceiling` | **The derivation.** `verified_income × sama_cap − obligations = max_installment`, `× annuity_factor = max_financing`. No number is granted without its arithmetic. |
| `bank_only` | **The reveal.** The same search on the income a bank sees alone → for `con_8842`, **0 full offers** against 4. |

The math is a deliberate twin: `lenders.py` serves it, `lenders.ts` runs it in the
browser for instant search, and the two agree **to the riyal**.

`GET /v1/lenders` returns every lender's published policy (score floor, DBR cap,
amount/tenor range, rate tiers). All demo lenders are fictional and illustrative;
the final credit decision always belongs to the licensed lender.

### ① `POST /v1/score` — verified income + 1–99 score

Provide **exactly one** income source in the body:

| Field | Type | Use |
|---|---|---|
| `connection_id` | string | A preset/connected applicant (e.g. `"con_8842"`). |
| `form` | object | A high-level financial picture (salary/gigs/p2p/obligations) → synthesized. |
| `statement` | object | **A real uploaded statement** — rows of `{date, description, amount, source}`. |
| `fixture` | object | A full inline `{applicant, accounts, masdr, transactions}`. |

**Score by uploaded statement (the "use my own data" path):**

```bash
curl -s https://tabaqa-api.vercel.app/v1/score -H 'Content-Type: application/json' -d '{
  "statement": {
    "name": "Sara",
    "rows": [
      {"date":"2026-03-25","description":"راتب","amount":7000,"source":"bank"},
      {"date":"2026-03-15","description":"Jahez payout","amount":2600,"source":"wallet"},
      {"date":"2026-03-10","description":"بنده","amount":-320,"source":"bank"}
    ],
    "context": {"bank_name":"alrajhi","wallet_name":"barq"}
  }
}'
```

**Response (key fields):**

| Field | Meaning |
|---|---|
| `tabaqa_score` | 1–99 (higher = lower risk). |
| `pd` · `risk_flag` | Probability of default · `low` \| `medium` \| `high`. |
| `income.{true_monthly_income, bank_only_income, reveal_delta, verified_share}` | The reveal. |
| `reason_codes[]` | `{code, label, points, polarity}` — every point of the score, explained. |
| `features` | The 6 cash-flow features behind the score. |
| `transactions[]` | Each labelled with `merchant`, `txn_type`, `verification`, and a **Plaid PFC** `pfc_primary`/`pfc_detailed`. |
| `accounts[]` | Per bank/wallet balances. |
| `insights` | The financial-intelligence read (also at `/v1/insights`). |

### ② `POST /v1/insights` — the deep financial read

Same input shapes as `/v1/score`. Returns the "deep meaning" of the history —
Claude-narrated when a key is configured, else a faithful templated version.

```bash
curl -s https://tabaqa-api.vercel.app/v1/insights -H 'Content-Type: application/json' \
  -d '{"connection_id":"con_8842"}'
```

```jsonc
{
  "summary_line": "Fahd A. shows SAR 10,000/mo verified income (Gig 52%, Salary 40%, P2P 8%) …",
  "narrative": "Verified monthly income is SAR 10,000, of which SAR 4,000 is visible bank-side …",
  "highlights": ["Wallet reveal adds SAR 6,000/mo over bank-only view", "…"],
  "risks": [],
  "income_trend": { "direction": "stable", "pct_change": 0.0, "monthly": [ … ] },
  "diversification": { "label": "diversified", "concentration": 0.52, "sources": [ … ] },
  "spending": { "monthly_total": 3550, "by_category": [ … ], "top_merchants": [ … ] },
  "savings_rate": 0.34, "runway_months": 2.8,
  "health": { "stability": 100, "resilience": 93, "diversification": 48 },
  "generated_by": "rules"   // or "claude:claude-sonnet-4-6"
}
```

### ③ `POST /v1/affordability` — responsible-lending decision

Income source is either a `connection_id` (reuse ①'s verified income) or a direct
`verified_income`. The cap follows the real **SAMA Responsible Lending** limits.

| Field | Type | Notes |
|---|---|---|
| `amount`, `tenor_months`, `annual_rate` | number | The financing being requested. |
| `connection_id` *or* `verified_income` | — | The income to test against. |
| `existing_obligations` | number | Current monthly obligations. |
| `customer_type` | `"employee"` \| `"retiree"` | Picks the SAMA cap (33.33% gross / 25% pension). |
| `dbr_cap` | number | Custom lender cap (used when `customer_type` is omitted). |

```bash
curl -s https://tabaqa-api.vercel.app/v1/affordability -H 'Content-Type: application/json' -d '{
  "connection_id":"con_8842","amount":60000,"tenor_months":48,"annual_rate":0.10,"customer_type":"employee"
}'
```

```jsonc
{
  "installment": 1521.76, "dbr_before": 0.08, "dbr_after": 0.2322,
  "max_financing": 91234.0, "decision": "APPROVE",
  "bank_only": { "verified_income": 4000, "decision": "DECLINE", "…": "…" },  // the reveal's impact
  "dbr_policy": {
    "cap": 0.3333,
    "label": "SAMA salary-deduction cap — employees (33.33% of gross salary)",
    "total_obligations_ceiling": 0.55,
    "citation": "SAMA Responsible Lending Principles for Individuals, Circular 46538/99, Chapter IV"
  }
}
```

### ④ `POST /v1/assistant` — the conversational guide

A Tabaqa-aware assistant (Claude-powered when a key is set, else a bilingual
scripted fallback). The Anthropic key stays server-side.

```bash
curl -s https://tabaqa-api.vercel.app/v1/assistant -H 'Content-Type: application/json' -d '{
  "messages":[{"role":"user","content":"I have a bank account, how do I connect?"}],
  "context":{"section":"connect","connected":false}
}'
```

```jsonc
{ "reply": "To connect, go to the Connect screen …", "suggestions": ["…"], "source": "rules" }
```

---

## Supporting endpoints

| Method · Path | Returns |
|---|---|
| `GET /health` | `{status, connections[]}` — liveness + known sample connections. |
| `GET /v1/profile?connection_id=con_8842` | Income + features + transactions + accounts (no score). |
| `GET /v1/personas` | Sample applicants for a gallery (headline numbers from the real pipeline). |

---

## Core data model

```jsonc
// Transaction (every row the pipeline emits)
{
  "source": "wallet:barq",          // "bank:<name>" | "wallet:<name>"
  "timestamp": "2026-03-15",
  "amount": 2600, "direction": "inflow",     // inflow | outflow
  "raw_desc": "JAHEZ-RYD دفعة",
  "merchant": "Jahez", "category": "gig_platform",
  "txn_type": "gig_income",          // salary | gig_income | p2p | loan_obligation | purchase | internal_movement | unknown
  "verification": "source_verified", // amount_verified | source_verified | inferred
  "pfc_primary": "INCOME", "pfc_detailed": "INCOME_OTHER_INCOME"   // Plaid PFC taxonomy
}
```

The **3-tier verification** is the trust signal: `amount_verified` (salary matched
to a Masdr payslip IBAN ±5%), `source_verified` (gig from a registered establishment),
`inferred` (P2P / unconfirmed). The score rewards the *verified share* — never a raw
P2P transfer.

---

## Errors

Standard HTTP status codes; the body is `{"detail": "..."}`.

| Status | Meaning |
|---|---|
| `422` | Could not process the input (e.g. missing required statement fields, no income source, or more than one provided). |
| `404` | Unknown `connection_id` (the `detail` lists the known ones). |
| `5xx` | Server error — retry. |

---

## How the model is validated

Tabaqa's numbers are measured, not asserted — see `app/eval/`:

- **Enricher accuracy:** an honest, adversarial eval (messy Arabic, transliteration,
  long-tail merchants) → **94.2% income-class accuracy** (`eval/REPORT.md`).
- **PD model on real defaults:** the same six features, fit on the public **Berka /
  PKDD'99** dataset (1M+ real transactions + loan outcomes) → **5-fold CV AUC 0.858,
  KS 0.562**, default rate falling 38.7% → 0% across score bands (`eval/DATA_REPORT.md`,
  reproducible via `python3 eval/berka_train.py`).

Grounded in standard tooling (`optbinning` scorecards, Plaid PFC taxonomy, SAMA
responsible-lending caps) and validated against open data — see `ALGORITHM.md` and `eval/`.
