# Tabaqa — Landing Page Spec

The content + design source-of-truth for the marketing site. The reference implementation is [`index.html`](./index.html) (one self-contained file, custom CSS, no build step). This doc is what you port to **Next.js + Vercel** when ready.

> **Goal of the page:** in one scroll, prove that Tabaqa turns open-banking data into a verified **1–99 credit & risk score** — and that there's a real, US-validated way to make money from it.

---

## Design system

| Token | Value | Use |
|---|---|---|
| Base | `#07070b` / `#0c0a13` | Near-black background |
| Violet | `#8b5cf6` / `#a78bfa` / `#5b21b6` | Primary brand + glows |
| Gold | `#e8c873` / `#d4af37` | Accent (verification, score arc) |
| Text / muted | `#e9e9f2` / `#9a9ab0` | Body / secondary |
| Display font | **Space Grotesk** | Headlines, numbers, code |
| Body font | **Inter** | Paragraphs, UI |

**Motif:** layers peeling back to *reveal* (ties to طبقة = "the Layer"). Premium dark, violet-and-gold — deliberately distinct from the pure-B&W "blockchain" look. Arabic-first product, EN-first landing (Arabic RTL version is a planned toggle).

---

## Page structure (top → bottom)

1. **Nav** — logo `Tabaqa · طبقة` · Product / How it works / Security / Pricing · `EN` · **Request access**
2. **Hero** — headline + sub + CTAs + "built on the Saudi rails" pills
3. **Product mock** — the Tabaqa Score gauge + reason codes + the Fahd reveal
4. **Features** — 6 cards (the intelligence)
5. **How it works** — 3 steps
6. **Security** — read-only / consent / SAMA-aligned
7. **API** — one code snippet (`POST /v1/score`)
8. **Pricing / business model** — the three meters
9. **Final CTA** + **Footer**

---

## Copy

### Hero
- **Eyebrow:** `● v1.0 · Saudi Open Banking`
- **Headline:** **Score the unscorable.**
  - *Alternates to A/B:* "Creditworthiness, revealed." · "The income the bank can't see." · "From cash flow to a credit decision."
- **Sub:** "Tabaqa turns consented open-banking data into a verified **1–99 credit & risk score** — surfacing the income banks can't see, cleaned in Arabic, and verified against Masdr."
- **CTAs:** `Request access →` (primary) · `See how it works` (ghost)
- **Trust pills:** Open Banking · AIS · Masdr / Mofeed · SAMA-aligned · Lean · Tarabut

### Product mock (the hero proof)
- **Gauge:** `82` — Tabaqa Score · verdict `✓ APPROVE · low risk (PD 4.1%)`
- **Reveal:** `SAR 4,000 → SAR 10,000` (true monthly income, revealed)
- **Reason codes:** Salary 4,000 `✓ amount-verified` · Gig (Jahez/HungerStation) 5,200 `✓ source-verified` · P2P 800 `~ inferred` · Barq transfer `reconciled · internal movement, not spend`
- **Signals:** Income regularity `High` · NSF/overdraft (12mo) `0`

### Features (6)
1. **Cash-flow score** — 1–99 PD score for thin-file borrowers a bureau can't rate.
2. **Wallet reveal** — surface income hiding inside wallets (Barq, urpay). The reveal that flips declines to approvals.
3. **Masdr-verified** — every figure proof-tagged: amount-verified / source-verified / honestly-inferred.
4. **Arabic-native enrichment** — Saudi-acquirer strings (mada, Geidea, urpay) → merchant + category. No foreign-taxonomy fallback.
5. **Tabaqa Risk** — fraud-and-risk flag aligned to SAMA Counter-Fraud — the signal every AISP, EMI and BNPL now needs.
6. **Explainable reason codes** — not a black box; plain-Arabic factors for the credit officer and the regulator.

### How it works (3 steps)
1. **Connect** — consent once; pull AIS (+ wallet on consent), read-only. No payments, no PIS.
2. **Clean · reconcile · verify** — normalize Arabic, reconcile bank↔wallet (no double-count), cross-check income vs Masdr.
3. **Score** — six cash-flow features → an explainable 1–99 score, a risk flag, and reason codes, in seconds.

### Security
Read-only · no PIS — `ENFORCED` · Consent-based data processing — `ENFORCED` · SAMA Counter-Fraud aligned — `13 APR 2026` · 3-tier provenance — `TAGGED` · Explainable model — `AUDITABLE`

### API
`POST /v1/score` → `{ tabaqa_score: 82, pd: 0.041, risk_flag: "low", verified_income: 10000, reasons: [...] }`

---

## Pricing / business model (mirrors the verified US model)

> B2B, consumer-free — **the lender pays.** Three meters, exactly how Plaid, Nova Credit and Prism Data monetize cash-flow scoring in the US. *Figures illustrative.*

| Card | Meter | Illustrative | US analog |
|---|---|---|---|
| **Tabaqa Score** | per verified score | SAR 5–25 / score | Plaid · Nova Credit · Prism (per report) |
| **Tabaqa Risk** | per-call fraud & risk flag | SAR 2–6 / check | Plaid **Signal** (per-request) |
| **Tabaqa Monitor** *(featured)* | recurring portfolio re-scoring | SAR / account / mo | Prism **Pulse** monitoring |

**Footnote line:** Plus platform tiers & enterprise minimums (SIMAH/Masdr/Plaid), and rev-share per funded loan or white-label via Lean & Tarabut (B2B2B). Land **Alinma** as customer #1.

Full rationale → [`../README.md`](../README.md#business-model).

### Final CTA
**Price the unscorable.** — "Join the lenders turning open-banking data into approvals." · `Request access →`

---

## TODO / port notes
- [ ] Port to **Next.js** (`app/web/`) and deploy to Vercel — keep this as the content source.
- [ ] **Arabic RTL** version with EN/AR toggle (product is Arabic-first).
- [ ] Swap placeholder trust pills for real partner/logo treatment once confirmed.
- [ ] Wire `Request access` to a real form (Supabase table / email).
- [ ] Replace illustrative SAR figures before any external sharing.
