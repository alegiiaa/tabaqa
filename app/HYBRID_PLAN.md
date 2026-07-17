# HYBRID_PLAN — the Jul 15 decision, mapped to the codebase

**Decision (founder, 2026-07-15):** HYBRID. Tabaqa is presented as an **embedded decision engine inside one bank's app** ("Demo Bank", per `PRODUCT_SPEC.md`), running Ahmed's journey — consent → 3–6s pipeline → decision → same-bank offers → documents → OTP → receipt. **The wallet-fusion beat survives as the data story:** on bank-only data Ahmed's ceiling is *below* his SAR 150,000 request; on consented fused data he is approved in full. The "0 → 4 lenders" marketplace reveal is retired.

**Read first:** `PRODUCT_SPEC.md` (the full spec), then this file. Supersedes the marketplace framing in `SESSION-2026-07-12.md` / JUDGE_SCRIPT.

---

## 0. The one-line hero beat (replaces 0→4)

> "On the bank's own view of Ahmed — salary account only — the engine can responsibly approve **SAR ~90k**. With his consented open-banking + wallet data, his verified income is complete — **approved SAR 150,000 in full, three ways to pay it, documents generated, zero employees involved.**"

Same `computeCeiling` math, same reveal mechanic (`bank-only` vs `fused` inputs), new meaning: **below-request → approved-in-full** instead of **0 lenders → 4 lenders**.

---

## 1. What already exists (reuse, don't rebuild)

| Spec section | Existing asset | Action |
|---|---|---|
| §6.4 Consent screen | `web/src/components/dashboard/Connect.tsx` — full SAMA AIS consent UI, institution picker, "Verifying consent…" | Re-copy: add employment-source + credit-bureau rows to the source list; button text → "Allow Access and Calculate My Eligibility" (never "Run") |
| §6.5 Processing animation | `web/src/components/dashboard/ScorePipeline.tsx` (**uncommitted!**) — six ticking engine stages incl. "Fusing the wallet with the bank" | This IS the spec's 3–6s experience. Commit it. Add the two spec stages it lacks: "Retrieving employment information", "Applying the bank's financing policy" |
| §8 Affordability | `affordability.py`, `sama.py`, `POST /v1/affordability` (returns installment, DBR before/after, max financing, decision, bank-only block) | As-is |
| §9 Policy engine | `sama.py` caps + `lenders.py` `LenderPolicy` (rate tiers, DBR cap, score floor, amount/tenor range) | Reuse one policy as "Demo Bank"; add config knobs only if P2 time |
| §11 Offer engine | `web/src/lib/lenders.ts` `computeOffers`/`computeCeiling` + mirrored `lenders.py` / `POST /v1/offers` | Add a **same-bank mode**: one lender policy × 3 terms (60/48/36) instead of N lenders × best term. Small function, both mirrors |
| §12 Documents | `/report`, `/receipt`, `/verify` A4 print pages, `rpt-*` Watheeq shell, `reportlink.ts` self-contained tokens | Reuse the shell + token pattern for the new docs |
| §14 Compliance receipt | `ComplianceReceipt.tsx` + `ComplianceReceiptDoc.tsx` — live, computed checks, QR verify | As-is. The spec calls this "one of the most important differentiating features" — we already have it |
| §15 Audit timeline | Receipt's computed checks + `ScorePipeline` stage list | Render the same events as a vertical timeline in the application detail view |
| App shell | `DashboardLayout.tsx`, `MyMoney.tsx` + `AccountCard.tsx` (accounts home), `AuthPage.tsx` login | Reskin as "Demo Bank" (see P0-1) |
| Personas | `api/personas.py` (Fahd `con_8842`, Mansour, Noura, Khalid thin-file) | Add **Ahmed** (§21); keep Khalid as the manual-review persona, Mansour-variant as declined |

## 2. Genuinely net-new (the real venue work)

1. **OTP flow** — nothing exists. Modal: checkbox "I have reviewed and accepted the financing terms" → "Confirm Financing Request" → fixed code **1234** → status flips to "Automatically Approved — Documentation Completed". Never say funds moved.
2. **Repayment schedule** — math exists (`Offer.installment/totalCost/annuityFactor`), the month-by-month table does not. New component + A4 print page reusing the `rpt-*` shell.
3. **Vehicle-financing request form** — product tiles (Personal / **Vehicle** / Home, others "Coming Soon"), amount SAR 150,000, optional term/down-payment, and the "Calculate the maximum amount I can receive" mode (ceiling already computed — just surface it).
4. **Demo Bank skin** — a theme wrapper (name, palette, logo lockup) over the existing shell so the journey visibly happens *inside a bank's app*, with a small persistent "Powered by Tabaqa — decision engine" footer for the judges.
5. **Three-outcome decision screen** — `/v1/affordability` already returns a decision; surface APPROVED / DECLINED (plain-language reason, no internal logic) / MANUAL REVIEW (routed, with reason codes) as a first-class screen.
6. **Bank dashboard applications table** — list of processed applications (Ahmed approved, one declined, one manual-review) → detail page = financial summary + decision + verification badges + selected offer + audit timeline + receipt link. Largely a recomposition of `ApplicationView` + `ComplianceReceipt` + persona data.
7. **Ahmed persona** — §21 exactly: gov employee 4 yrs, salary 18,000 + 2,000 stable side income (50% haircut → eligible 19,000), essentials 6,000, obligations 2,600, grade B, requests 150,000 vehicle. Bank-only view must show only the salary account (ceiling ≈ 90k); fusion completes the picture.

## 3. Build queue (72h on-site, 16–18 Jul)

**P0 — the demo path, in order (Day 1):**
1. Commit the in-flight `ScorePipeline.tsx` + `NewApplicant.tsx` work first (it's uncommitted on `main`).
2. Ahmed persona (backend `api/personas.py` + statement sample) with bank-only vs fused economics tuned so the ceiling lands *below* 150k bank-only and *at/above* 150k fused.
3. Demo Bank skin + financing-products screen + vehicle request form.
4. Consent re-copy (Connect.tsx) → ScorePipeline processing → decision screen.
5. Same-bank offers: `sameBankOffers(policy, amount)` in `lenders.ts` (mirror in `lenders.py`) → 3 term cards, 48-month marked "Recommended because it balances monthly affordability and total financing cost" (§11 wording).
6. OTP modal + final status screen.
7. Documents: offer summary + repayment schedule (A4 shell), linked from the final screen next to the existing receipt.

**P1 — bank side + depth (Day 2):**
8. Dashboard applications table + application detail + audit timeline.
9. Declined + manual-review personas walked once each (spec §23 "should include").
10. Arabic pass (strings.ts already bilingual).

**P2 — polish (Day 3, only if green):**
11. Policy admin page (edit DBR limit / min salary / rate tiers live — strong "bank-configured" proof).
12. Simulated data-source failure → graceful manual-review routing.

**Parallel track (presentation team, not code):** rewrite `../JUDGE_SCRIPT.md` + `web/public/deck.html` beats from marketplace → embedded engine (see §4). Do this early; it's rehearsal-critical.

## 4. Language deltas for script + deck

- "Marketplace" → **embedded financing infrastructure / straight-through processing** (§24–25 vocabulary).
- Hero beat swap: "0 full offers → 4" → "**approvable at 90k on bank-only data → 150k approved in full on verified data**".
- The customer is **the bank**; the end user is the bank's customer.
- The FOUR FORBIDDEN SENTENCES (TEAM_BRIEF §7) stand unchanged — the spec's §25 avoid-list is the same discipline. New additions from §25: never "guaranteed financing", never "zero rejection", never "money disbursed in seconds".
- Everything proven stays citable: +0.117 AUC wallet lift at 963k apps, thin-file inclusion, TSTR 96%, receipt/verify — it's now "the engine the bank embeds" instead of "the engine behind the marketplace".

## 5a. iOS app (added 2026-07-16 — the "real product in the judge's hand" layer)

**Goal:** a judge holds an iPhone running the bank's app, walks Ahmed's تمويل journey, and the
application pops up live on the bank dashboard on the projector. Pitch line: *"this is a native app
a bank ships — the financing intelligence is Tabaqa, embedded with an API key."*

**Architecture — thin client, engine stays server-side:**
```
iPhone app (Capacitor shell hosting the /bank mobile flow)
   │  API key header → tabaqa-api.vercel.app  (/v1/score /v1/affordability /v1/offers)
   │  saveScoredApplicant() → Supabase (applicants + scores, shared demo account)
   ▼
Bank dashboard (projector) — listApplicants() + Realtime subscription → application appears LIVE
```

**Stack decision:** real Xcode iOS project via **Capacitor** wrapping the mobile shell (`/bank` route:
bottom tabs, iOS chrome, fictional-bank skin). Machine verified ready: Xcode 26.2 + iPhone 17 Pro/Air
simulators. Full-SwiftUI rebuild rejected for now (1.5–2 days, duplicates the web flow).

**Build order:**
1. *(Day 1)* `/bank` mobile shell + Ahmed persona + same-bank offers → flow green in a browser first
2. *(Day 2 am)* `npx cap add ios` → wrap → run in iPhone simulator; API key wired as a visible header
3. *(Day 2)* Supabase Realtime on `applicants`/`scores` + shared demo account → the phone→dashboard moment
4. *(Day 2–3)* OTP 1234 + repayment schedule + final status inside the app; Arabic pass; rehearse

**Demo fallback ladder (never depend on one layer):**
① Capacitor app in simulator / device → ② PWA on a real iPhone (manifest + standalone tags ALREADY
LIVE in `index.html`, installs full-screen from Safari) → ③ web `/demo` on the projector (rehearsed today).

**Open decisions:** fictional bank name/skin · simulator-only vs real device (device needs Apple signing).

## 5. Risks / watch items

- **Two mirrored offer engines** (`web/src/lib/lenders.ts` ↔ `lenders.py`): the same-bank mode must land in both or demo (client-side) and API story diverge.
- **JUDGE_SCRIPT.md and TEAM_BRIEF live one directory up** (`../`), outside `app/` — easy to forget in commits; the deck is `web/public/deck.html` + PNGs (`deck/marketplace-ar.png` is now misnamed content-wise).
- **Don't break the live marketplace URL before its replacement is green** — Vercel prod (`tabaqa.vercel.app`) is the rehearsed fallback; build the bank-shell journey as an additive route (e.g. `/bank`) and flip the default only when the full path plays end-to-end.
- Fahd (`con_8842`) stays for the lender-side Applicants/Model sections; Ahmed is the customer-side hero. Two personas, two sides of the same engine — that's coherent, not a conflict.
