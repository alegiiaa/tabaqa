# طبقة · Tabaqa — Product Requirements Document (PRD)

> **The data-intelligence layer for the wallet economy.** · طبقة الذكاء لاقتصاد المحافظ الرقمية.
> Open banking can read bank accounts. It's blind to the wallets — where Saudis increasingly keep their money. Tabaqa makes wallet money visible, attributed, and verified, and serves it to open-banking companies as one clear financial picture.

AMAD Hackathon 2026 (Alinma × Tuwaiq) — Open Banking track. Build window: 16–18 Jul 2026.

> **Positioning note:** "wallet *economy*", not "digital *payments*". Tabaqa is a **data/intelligence** layer — it does **not** initiate payments (no PIS). Keep the messaging off anything that implies payment initiation.

---

## 1. Problem

Digital wallets (Barq, STC Pay, urpay) are **e-money licensees, not banks**. They don't give each user a real bank account — they pool all customer funds in **one master/omnibus IBAN at a sponsor bank** (e.g. Barq's master IBAN at Arab National Bank). Each user is a **virtual sub-account inside the wallet's private ledger — "the Layer."**

So to any outsider — bank, lender, open-banking aggregator — a wallet is **one opaque account**:
- Can't pull a person's wallet holdings from their national ID.
- Can't see income that lands in a wallet (gig pay, transfers, advances).
- Can't attribute any wallet transaction to a human.

Open banking therefore has an **income / affordability blind spot exactly where the growth is.** Validated first-party by an Alinma insider: *"determining income from wallets is the hard problem; the Layer is what makes it hard."*

## 2. Solution

A **consent-based intelligence layer** that, for one user, reads **both** their bank (open-banking AIS) **and** their wallets, then:
1. **Reconciles** the two streams (a bank→Barq transfer = money moving to a wallet, not spending; gig income landing in Barq = real income).
2. **Verifies** against Masdr/Mofeed ground-truth (salary ↔ Payslip/Wage, account owner/status ↔ Akeed IBAN Verification, counterparty ↔ Establishment).
3. **Cleans** messy Arabic transaction text into canonical merchants + categories.
4. **Outputs** one unified, provenance-tagged financial profile + a *true income* figure, via API, to the open-banking company.

We do **not** decrypt the omnibus from outside (not real / not legal). We are the **consented bridge** that turns an opaque wallet into a complete, verified picture.

## 3. Users & personas

| Persona | Need | Tabaqa value |
|---|---|---|
| **Lender / BNPL risk team** (primary buyer) | True affordability/income | Surfaces wallet income bank-only data misses |
| **Open-banking aggregator** (Tarabut, Lean) | Offer wallet data as a feature | Tabaqa = their wallet-layer supplier (B2B2B) |
| **Bank** (Alinma — customer #1) | Onboarding, affordability checks | Complete verified income picture |
| **End user** (data subject) | Fair assessment of real income | Consents once; gets credit they actually qualify for |

## 4. Goals & non-goals

**Goals (MVP):** prove the reveal — surface verifiable wallet income a bank-only view scores as zero; clean Arabic transactions; verify against Masdr; expose a clean profile API + dashboard.

**Non-goals (MVP):** decrypting omnibus accounts without consent; being a licensed AISP/TPP (we run as a data-processor inside a licensee / on consent); payments/initiation (no PIS); a consumer budgeting app.

## 5. Features

**P0 — must demo**
- F1 **Connect accounts** — consent flow for bank (AIS sandbox) + wallet (mock/consented).
- F2 **Arabic Cleaner** — raw AR/EN string → `{merchant, category, type}`.
- F3 **Reconciler** — match bank↔wallet transfers; tag `INTERNAL_MOVEMENT`.
- F4 **Income Resolver** — recurring-inflow detection; classify salary / gig / P2P; cross-check salary vs Masdr.
- F5 **Verifier & provenance (3-tier)** — every datapoint tagged with the *strength* of its verification (see §6).
- F6 **Unified Profile API + dashboard** — income breakdown, account inventory, categorized spend.

**P1** — multi-wallet, anomaly flags, lender decision-simulator, export (PDF/JSON).
**P2** — wallet partnership ingestion, entity-resolution graph that improves with volume, white-label SDK.

## 6. The 3-tier verification model (important for credibility)

Not all "verified" is equal. Masdr verifies **formal salary** (the amount), and **establishment legitimacy** (the payer) — it does **not** know a specific gig payment occurred. Show the tiers honestly; it makes the product look *more* sophisticated.

| Tier | Meaning | Example | Tag |
|---|---|---|---|
| **Amount-verified** | The figure itself is confirmed by Masdr | Salary 4,000 ↔ Mofeed Payslip/Wage | `✓ amount-verified` |
| **Source-verified** | The **payer** is a Masdr-verified real establishment; the wallet txn proves the inflow (amount from txn, not Masdr) | Gig income from Jahez/HungerStation | `✓ source-verified` |
| **Inferred** | Pattern-only, no external confirmation | Recurring P2P transfer | `~ inferred` |

> Do **not** tag retail purchases (e.g. a supermarket) as Masdr-verified. And note "Mofeed" **is** Masdr's product — never use it as the label for *un*verified rows.

## 7. Core user flow

```
Consent → ingest bank (AIS) + wallet feeds → canonical schema
   → Arabic Cleaner → Reconciler → Income Resolver → Masdr Verifier
   → Unified Profile (API + dashboard, provenance-tagged)
```

## 8. Technical architecture

```
            ┌──────────────┐   ┌──────────────┐
 Bank AIS ─▶│  Ingestion   │   │ Wallet feed  │◀─ Barq (mock/consent)
 sandbox    │  adapters    │   │  adapter     │
            └──────┬───────┘   └──────┬───────┘
                   └─────────┬─────────┘
                     [1] Canonical schema
                             │
                     [2] Arabic Cleaner ── Claude (Opus 4.8) + rules + cache
                             │
                     [3] Reconciler ────── deterministic (amount+Δt+counterparty)
                             │
                     [4] Income Resolver ─ recurring-inflow detection + LLM classify
                             │
                     [5] Verifier ──────── Masdr: Akeed IBAN Verif / Payslip / Establishment
                             │
                     [6] Unified Profile API (FastAPI) → Supabase → Next.js dashboard
```

**Stack (reuses existing assets):**
- Backend: **Python + FastAPI** (repoint `kashf-api` skeleton).
- Intelligence: **deterministic rules for the known 80%** (transfer match, top merchants, gig platforms) **+ Claude Opus 4.8** for the messy Arabic long-tail and income classification. *Engines decide, LLM cleans/classifies.*
- Arabic NLP: **CAMeL Tools** (normalization, de-diacritization, NER) + **PyArabic**.
- Ground-truth: **Masdr/Mofeed** — Akeed IBAN Verification, Payslip/Wage Details, Establishment.
- Bank data: **open-banking sandbox AIS** (Tarabut / Lean).
- Wallet data: MVP **realistic Barq/STC-Pay feed generator** (or user-uploaded statement); v2 partnership API.
- Storage: **Supabase** (already wired). Frontend: **Next.js on Vercel** (already set up).

## 9. Canonical transaction schema

```json
{
  "id": "uuid",
  "source": "bank:alinma | wallet:barq",
  "timestamp": "ISO-8601",
  "amount": 6000.00,
  "currency": "SAR",
  "direction": "inflow | outflow",
  "raw_desc": "تحويل برق 8842 / JAHEZ-RYD",
  "merchant": "Jahez",            // after Arabic Cleaner
  "category": "gig_income",
  "txn_type": "salary | gig_income | p2p | internal_movement | purchase | ...",
  "counterparty_iban": "SA…",
  "verification": "amount_verified | source_verified | inferred",
  "verified_via": "masdr:payslip | masdr:establishment | masdr:akeed | none",
  "confidence": 0.0
}
```

## 10. Success metrics

- **Reveal delta:** % income surfaced by Tabaqa vs bank-only view (demo target: 4,000 → 10,000 SAR).
- **Clean rate:** % transactions auto-resolved to a canonical merchant (rules + LLM).
- **Verification rate:** % income components amount/source-verified vs inferred.
- **Reconciliation accuracy:** % bank↔wallet transfers correctly matched (no double-count).

## 11. MVP scope — 3-day build

- **Day 1** — ingestion adapters + canonical schema; wire bank sandbox + mock wallet feed.
- **Day 2** — engine: Reconciler + Arabic Cleaner + Income Resolver + Masdr verification.
- **Day 3** — Profile API + dashboard + the "Fahd" demo, polished.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Wallet data access** — EMIs may be out of SAMA OB scope (the reason the gap exists) | Demo on consented/simulated wallet data; frame access via consent/partnership; engine is the star |
| Not first at enrichment (Tarabut 1DE, global incumbents) | Wedge = **wallet-layer attribution + Arabic + Masdr**, never "first at enrichment" |
| No emotional hook | Win on the demo reveal (AMAD 2025 winner = agentic AI on real data) |
| Licensing | Position as data-processor inside a licensee / on consent → no own AISP licence |
| Over-claiming "verified" | Use the 3-tier model (§6) — honesty reads as sophistication |

## 13. Monetization

Per-verification / per-API-call (like Masdr/SIMAH) · tiered subscription (mirror Masdr Bronze→Platinum) · outcome-based per approved loan (lenders) · platform SaaS. Moat = Arabic + wallet-attribution + Masdr ground-truth + an entity-resolution graph that compounds with volume.

## 14. GTM

Insider steer: **avoid the regulation route** (SAMA won't move until everything is perfect); **take the data-processing route** (broad, easier). Land Alinma as customer #1 — "you told us wallet income is your blind spot; here's the fix." Expand to lenders/BNPL, then aggregators (B2B2B).
