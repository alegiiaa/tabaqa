# Tabaqa — The Pricing Engine (محرك التسعير)

> ## ⛔ DECISION 2026-07-13 — READ THIS FIRST
>
> **The Commitment Index (مؤشر الالتزام) is OUT of the MVP.** Do not build it.
> Reason: it is **not unique** — "behave well → cheaper money" is what a credit bureau (SIMAH)
> already does, what Saudi banks already do via salary-transfer pricing, and what Discovery Bank
> has done since 2019. It also drags us back into the scoring-company identity we just left.
> It survives only as **(a)** an accuracy input inside the engine and **(b)** one roadmap slide.
>
> **THE PRODUCT IS THE MARKETPLACE + ITS OWN PRICING ENGINE.** Sections 3, 7 and 8 below
> (index build plan, two-day plan, second reveal) are **SUPERSEDED**. The live MVP scope is
> §11 at the bottom of this file. Everything else here is still valid background.

**Thesis in one line:** Tabaqa is not a scoring company and not a connecting interface — it is a
**pricing engine built on open banking**, where the price of financing is computed transparently
from verified data and served to any lender through one API.

> إحنا مو شركة سكورنق، إحنا محرك تسعير.

This document demonstrates the full idea: what it is, why only open banking makes it possible,
what changes on screen, what the architecture looks like, and how it gets built in two days.

---

## 1. The idea in one paragraph

Today's financing marketplaces are lead-gen: they match an applicant to a lender once, take a
commission, and disappear. Tabaqa replaces the match with a **price** — computed on the screen
from verified open-banking data (income × SAMA cap × tenor → ceiling → per-lender offer), and then
keeps that price **alive**: a **Commitment Index (مؤشر الالتزام)** — the same logic insurers use to
lower a safe driver's premium — lets consented financial behavior earn the applicant better terms
over time. Lenders don't integrate into us and we don't integrate into them; **the bank extends one
endpoint to our side** (يمتد البنك لطرفنا فقط) and receives applications pre-computed, pre-filled,
and ready for a real human approval.

Three pieces, one engine:

| Piece | For whom | What it replaces |
|---|---|---|
| Request-first offers (ceiling computed on screen) | Applicant | The "magic amount" button |
| Commitment Index → discount-only dynamic pricing | Applicant + lender | Static one-shot pricing |
| One API + lender console (maker-checker) | Lender | Manual data entry by a bank clerk |

---

## 2. Why this belongs in the open-banking track

- **It is impossible without open banking.** A bureau pull (SIMAH) is a snapshot; an ongoing AIS
  consent is a **stream**. A commitment metric needs a stream. This feature doesn't merely *use*
  open banking — it cannot exist without it. (Legal chain already in our research: AIS Art. 6/10,
  Art. 96 consent access, SAMA licences live since Mar 2026.)
- **It completes the "pricing engine, not aggregator" claim.** If the price itself is the product
  and it keeps moving after origination, no lead-gen connector can copy the pitch.
- **It extends the relationship past origination.** The same index that earns the applicant a
  discount gives the lender portfolio early-warning monitoring — a second product surface and a
  direct answer to قابلية التنفيذ الفعلي في القطاع المالي.
- **It is the same DNA as the existing story.** The score reveal already says "your score is a
  dial, not a gate." Commitment pricing applies the same inversion to *price*.

---

## 3. The Commitment Index (مؤشر الالتزام)

### What it is

A deterministic, explainable 0–100 index of **long-term ability to commit**, computed from
consented financial behavior only. It is a **pricing input, never a score** — we do not use the
word "score" for it anywhere in UI or pitch.

### Two phases (this kills the cold-start problem)

| Phase | When | Computed from |
|---|---|---|
| **Inferred commitment** | Day zero, at application | Open-banking history we already ingest: salary regularity, recurring-bill punctuality, savings persistence, bounce/overdraft incidents, spending volatility |
| **Demonstrated commitment** | After origination | Actual repayment behavior + the continuing consented feed |

Phase 1 needs **no new data source** — it is a reinterpretation of data the pipeline already
extracts. That is what makes this feature safe to build in two days.

### Subscores (the transparent box, again)

Every subdial is visible to the applicant, same as the score waterfall:

1. **انتظام الدخل** — salary regularity (variance of deposit timing/amount)
2. **التزام الفواتير** — recurring payment punctuality (SADAD-like patterns in transactions)
3. **استمرارية الادخار** — savings persistence (positive balance trend across months)
4. **الحوادث** — bounce / overdraft / reversal incidents
5. **استقرار الإنفاق** — spending volatility

### The one design rule that defuses privacy: **discount-only**

The contracted rate is a **ceiling**. Behavior can only earn reductions, rebates, fee waivers, or
a better *next* offer — **never a penalty, never a raise**. This is exactly how insurance
telematics survived the same objection, and it makes the privacy answer one sentence long:

> "المؤشر ما يرفع سعرك أبدًا — يقدر بس ينزّله. وسلوكك المالي بموافقتك، لا صحة ولا تأمين ولا شيء خارج حساباتك."

Boundaries (already team policy): **no health data, no insurance data, no lifestyle data** —
consented financial accounts only, revocable, scope + expiry printed on the compliance receipt.

### What commitment earns (Sharia/contract-safe mechanics)

We never demo "your live APR silently changed" — mid-term repricing of a fixed-profit contract is
contractually and Sharia-awkward. The demo mechanics are:

- **A visibly better rate on the *next* / refinance / top-up offer** ("your rate today → the rate you can earn")
- **Quarterly rebate / admin-fee waiver** on the current contract
- **Pre-approved top-up** unlocked at index thresholds

Same emotional payoff, zero contract-law landmines.

---

## 4. The applicant UX — fixing the "magic 10 million button"

### The problem

A button that says "there is financing here → click → type an amount → receive 10,000,000" fails
because the number arrives as a **grant**, not a **derivation**. Everything else in Tabaqa shows
its work (waterfall, receipt, integrity check); this one moment doesn't — and magic reads as fake
to a judge and untrustworthy to a user.

### The fix: request-first, ceiling-computed

1. **The user starts with what they need**: product type (auto / personal / goods), amount as a
   **slider**, tenor. No free-text "wish for a number."
2. **As they drag, the arithmetic runs live on screen**:
   `verified income → SAMA cap (33.33%) → max installment → max financeable amount at this tenor`.
   The ceiling is visible **before** any offer appears, derived from their own data.
3. **Then offers arrive** — and "you qualify for up to 85,000" is not a gift from a black box; the
   user just watched the arithmetic that produced it.

**Rule: no raw number ever appears on screen.** Every amount is traceable in one glance to
income × SAMA cap × tenor. That is the difference between our marketplace and lead-gen
aggregators — they show numbers, **we show where numbers come from**.

### The offer card, upgraded

Each offer shows **two rates**:

```
┌─────────────────────────────────────────────┐
│  بنك السدرة · تمويل شخصي                    │
│                                             │
│  سعرك اليوم        8.4%                     │
│  السعر اللي تقدر    7.8%  ← بعد ٣ أشهر التزام │
│  توصله                                      │
│                                             │
│  القسط 1,124 ر.س · 48 شهر · رسوم 1%         │
│  [مسار الالتزام ▸]                          │
└─────────────────────────────────────────────┘
```

Plus a **time-slider** ("3 months later…") that simulates the index moving and the offers
re-pricing live — the second reveal of the demo.

### The counter-offer moment (the logic already exists — `reducedFrom` in `lenders.ts`)

> "طلبت 50,000 — عندك عرضين بالمبلغ كامل، وعرض بـ 35,000، وهذا اللي يفتح لك الباقي:
> مدة أطول، أو ٣ أشهر تحسين في مؤشر الالتزام."

Rejection becomes a path. That is the product's whole personality.

### Dashboard re-centering

The dashboard's center of gravity moves from **score** to **offers**:

- Landing view = the marketplace / offers ("عروضك")
- The score shrinks to a supporting card, labeled explicitly as **one input into pricing**
- This is the single change that makes the pivot true *in the UI* instead of only in the script

---

## 5. The lender side — one API, not N integrations

### The architecture sentence (say it exactly this way on stage)

> "The bank never gets its own integration. Every lender consumes the **same two surfaces** —
> the offers endpoint and the console — configured only by their published product policy.
> That is the difference between a pricing engine and a pile of one-off integrations."

### Surface 1 — `POST /v1/offers` on the existing tabaqa-api

- Input: scored profile + requested amount / tenor / product
- Output: ranked offers (full + counter-offers), each with the calculation trace
- The math already exists twice (`affordability.py` server-side, `lenders.ts` mirrored
  client-side) — this endpoint is **hours** of work, not days
- Gated by the live `api_keys` + metering layer

### Surface 2 — the lender console (`/lender` route)

Ustadh Ayman's insight, made visible: **automate the data entry, separate it from approval.**

- The bank sees its **queue**: each application arrives **pre-filled with exactly the fields
  their clerk would have typed**, plus the full calculation trace
- The bank clicks **approve / reject** on the same inputs it would have entered itself —
  **a real decision, not a formality** (مو إجراء شكلي)
- Reliability compounds: every collaboration where our computation matches their manual check
  raises trust — the console shows an agreement-rate stat over time
- A **portfolio strip**: existing borrowers whose Commitment Index is drifting = early warning
  (hooks into the lender-impact ROI panel)

### Branding caution

**Do not brand the console as Alinma** (or any real bank). All demo lenders stay fictional and
labelled illustrative — with real-bank judges in the room, a console they can *imagine as
themselves* is powerful; impersonating their actual bank is a liability. The line to a judge:

> "This console is what your intake team would see — **your criteria, your approval, our engine.**"

### Accuracy positioning (from the team note, keep verbatim)

Errors are possible — but **fewer than human entry errors + data gaps**. The system is a
transparent box: the bank sees every computation and approves or rejects on the same inputs.
Human approval stays; only the typing disappears.

---

## 6. Mapping to the existing codebase

| Change | Where | Effort |
|---|---|---|
| Commitment Index (5 subscores, deterministic) | new `web/src/lib/commitment.ts`, features already produced by `adapters.ts` / pipeline | ~half day |
| `commitmentDiscount` in offer pricing (bounded, discount-only, e.g. ≤ −0.6pp off spread) | `web/src/lib/lenders.ts` | ~1 hour |
| Request slider + live ceiling derivation | `NewApplicant.tsx` / `Marketplace.tsx` | ~half day |
| Two-rate offer card + time-slider | `Marketplace.tsx` | ~half day |
| Counter-offer path UX | `Marketplace.tsx` (logic exists: `reducedFrom`) | ~1–2 hours |
| Offers-first dashboard re-centering | `Dashboard.tsx` layout | ~2 hours |
| `POST /v1/offers` endpoint | tabaqa-api (mirrors `affordability.py`) | ~3 hours |
| Lender console + queue + agreement stat | new `/lender` route, extends `DecisionCockpit.tsx`, portfolio strip via `LenderImpact.tsx` | ~1 day |
| Consent scope + expiry on receipt | `ComplianceReceipt.tsx` | ~1 hour |
| Copilot answers "ليش مؤشر التزامي ٧٦؟" | existing firewalled `/v1/insights`, grounded in subscores | ~1 hour |
| Evidence: behavioral-trend ablation on real defaults | `eval/` harness (Berka / AlfaBattle), add commitment-features column to model card | ~half day |

**No new data source anywhere in this table.** Every feature is a reinterpretation of data
already ingested — that is the definition of a two-day-safe feature.

---

## 7. The two-day build plan

### Day 1 — the applicant side (what the demo camera sees)

- [ ] `lib/commitment.ts` — index + 5 subscores, deterministic, explainable
- [ ] `lenders.ts` — bounded `commitmentDiscount`, discount-only
- [ ] Request slider + live ceiling (kills the magic button)
- [ ] Two-rate offer cards + "3 months later" time-slider (the second reveal)
- [ ] Dashboard re-centering: offers first, score demoted to input card

### Day 2 — the lender side (the "serve it to a bank" proof)

- [ ] `POST /v1/offers` on tabaqa-api
- [ ] `/lender` console: pre-filled queue + calc trace + approve/reject + agreement stat
- [ ] Portfolio early-warning strip
- [ ] Receipt: consent scope + expiry line
- [ ] Copilot grounding for the index
- [ ] (If time) eval ablation: do behavioral-trend features add lift on real defaults?
      Even a modest +AUC turns the index from a slogan into a measured claim.

---

## 8. Where it lands in the pitch

The Commitment Index is the **second reveal**:

1. **First reveal (breadth)** — stays as is: bank-only **0 full offers → wallet-fused 4**.
2. **Second reveal (depth)** — "…and the price keeps getting better": drag the time-slider,
   watch three on-time months cut Sidra's spread by 0.4pp across the board.

It is also the moat answer:

> **Q: "What stops a bank from copying you?"**
> A: "The formula isn't the moat — the **longitudinal consented relationship** is. A bank sees its
> own accounts; we see the applicant's whole consented picture, across institutions, over time,
> with their permission. That stream is what prices commitment — and it only exists on our side."

### Judge Q&A quick answers

- **"This sounds like surveillance pricing."** → Discount-only by design; the contracted rate is a
  ceiling. Financial accounts only, consented, revocable, scope printed on the receipt.
- **"Insurance-style monitoring of my bank account?"** → Same *logic* (behavior earns discounts),
  strictly narrower *data* (no health, no lifestyle, nothing outside consented accounts).
- **"How do you reprice a fixed-profit contract?"** → We don't. Commitment earns rebates, fee
  waivers, and better *next* offers — never a mid-term contract change.
- **"What if your computation is wrong?"** → Transparent box: the lender approves or rejects on
  the same inputs its own clerk would have typed. Error rate is measured against human entry, and
  the console's agreement stat makes reliability visible and compounding.
- **"Cold start — no behavior with you yet?"** → Phase 1 infers commitment from open-banking
  history (salary regularity, bill punctuality…); Phase 2 upgrades to demonstrated repayment
  behavior. Day-zero applicants are priced on day-zero evidence.

### Forbidden sentences — still forbidden

This feature changes nothing about the four red lines: no ID-only onboarding claims, no
Sehhaty/Absher, lenders publish **product criteria** not formulas, and bank approval is
**never described as a formality** — the console exists precisely because the approval is real.

---

## 9. MVP scope discipline

Per the team decision: start with **one financing type**, or **2–3 lenders × two types** — the
`lenders.ts` policy set already models exactly this. Wallet data does not disappear; it becomes
**one line inside a broader offer** — it sharpens accuracy, it is not the product.

The product is the price.

---

## 10. Build plan by the five AMAD criteria (+ verified evidence pack)

*Evidence below web-verified 2026-07-13. Fold citations into `EVIDENCE.md` at the Jul 14 fold-in.*

### ① الابتكار / Innovation — closed; this feature sharpens the headline claim

No new build. The existing innovation work (receipt, ROI, inclusion meter, 0→4 reveal) stands.
What this feature adds is **the claim**, stated precisely:

> "Behavior-priced banking is a proven category — Discovery Bank has run it live since 2019.
> But Discovery prices behavior **inside its own bank**, on its own accounts. Nobody prices
> commitment **across institutions via open banking** — and nobody does it at all in the Kingdom."

- **Precedent (proves the category):** Discovery Bank (South Africa) "Vitality Money" — the world's
  first behavioral bank; **Dynamic Interest Rates** flex monthly with financial behavior, borrowing
  rate up to **7% lower**; ~1.2M customers. Sources: discovery.co.za/bank/vitality-money, EY case
  study, UNSGSA (Queen Máxima) feature, Fortune Change the World 2022.
- **Gap (proves the uniqueness):** no public source shows any Saudi or GCC lender offering
  behavior-linked financing pricing (verified 2026-07-13). **Landmine rule:** never say "first in
  the world" (Discovery exists — and that's *good*, it's our feasibility proof). Say: *category
  proven, Kingdom empty, cross-institution open-banking version found nowhere.*

### ② الجانب التقني / Technical — what actually changes

1. `web/src/lib/commitment.ts` — deterministic Commitment Index engine (5 subscores)
2. `lenders.ts` — bounded discount-only `commitmentDiscount` in offer pricing
3. **`POST /v1/offers`** on tabaqa-api — the pricing engine as a keyed, metered API product
4. `/lender` console route — maker-checker queue + calc trace + agreement stat
5. Copilot grounding extension (index subscores → firewalled `/v1/insights`)
6. Receipt: consent scope + expiry line

The technical *story* to judges: mirrored math (client `lenders.ts` ≡ server `affordability.py`),
**one API, two surfaces, N lenders by config** — deterministic core, LLM firewalled to narration.

### ③ تحليل البيانات / Data — no new data SOURCE (say that proudly); new data ANALYSIS

- **(a) Behavioral-trend ablation** on real defaults (Berka / AlfaBattle 963k apps): do the
  commitment features (bill punctuality, spending volatility, savings persistence) add AUC lift
  over the static snapshot? Extends `eval/ablation.py` + model card — the index becomes a
  *measured* pricing input, not a slogan.
- **(b) The default-rate-by-band stat, on OUR data:** bucket accounts by the computed behavioral
  band, show default rate per bucket — "top-band accounts default N× less, on 963,811 real
  applications."
  > 🚫 **Do NOT anchor this on Discovery's "97% less likely to be in arrears."** That number is
  > Discovery's own **unaudited marketing** figure, and it is almost certainly a **selection effect,
  > not a treatment effect** — Diamond customers are *different people*, not *improved* people.
  > A banking judge lands that in one sentence, and if the number is on our slide we lose the Data
  > axis with it. See `EVIDENCE.md` landmine #12.
- **(c)** Wire both into `ModelCardPanel` — derived from the card, never stale.

### ④ تجربة المستخدم / UX — the five visible changes

1. Request slider + **live ceiling derivation** (kills the "magic 10M button": no number on
   screen without income × SAMA cap × tenor visible next to it)
2. Offers-first dashboard re-centering (score demoted to "one input into pricing")
3. Two-rate offer card — "سعرك اليوم → السعر اللي تقدر توصله"
4. The time-slider **second reveal** ("3 months later…" — offers re-price live)
5. Counter-offer path + `/lender` maker-checker console

UX principle, quotable: **"they show numbers, we show where numbers come from."**

### ⑤ قابلية التنفيذ الفعلي / Feasibility — "is it doable in real fintech, live?" YES, with receipts

> [!warning] **`EVIDENCE.md` is CANONICAL — it supersedes this table.**
> Every citation below has since been primary-verified (or refuted) and carries a
> `[P]`/`[S]`/`[SR]`/`[X]` verification label there. **Two numbers that were in this table were
> WRONG and are corrected below.** Never quote from this table without checking `EVIDENCE.md` first.

| Evidence | What it proves | Status |
|---|---|---|
| **Discovery Bank Vitality Money** — dynamic rates live since **March 2019**, ~1.2M customers, *"up to 7% less on your credit facility"* (their own words) | Behavior-priced banking works commercially at a real, regulated retail bank | **[P]** for the mechanism. 🚫 **NEVER quote the "97% less arrears" stat** — unaudited, and a selection effect. Landmine #12. |
| **FinRegLab** (2019 + 2025) — cash-flow variables **at least as predictive as bureau scores**, with **independent** value (not a demographic proxy); **cash-flow + bureau combined performs strongest** | The data layer under our pricing is empirically validated — and *fusion* is what we do | **[P]** — the strongest citation we have. *(Petal was one of the six lenders **inside** this study — the mechanism survived, the balance sheet didn't.)* |
| **SAMA rails are live** — AIS licences issued (Lean, Neotek, **Mar 26 2026**), Art. 6(10), Art. 96(1) consent | The regulatory channel exists in the Kingdom **today** | **[P]** |
| **Experian Boost** — 60% of completers raised FICO (avg +12); below-580 band: **87% / +22**; **47% of unscoreables became scoreable** | Consumers **volunteer** data when it can only help them | **[P]** ⚠️ **TRAP — consent evidence ONLY, never a product analogy.** It is consented data raising a *bureau score* — the identity we pivoted away from. *(An earlier "~90% of thin-file users gain" figure in our docs was **wrong**; the source says **85%**.)* |
| **Insurance telematics (UBI)** — **21M+ US policyholders** shared driving data in 2024 | The consent-for-discount bargain is mainstream at scale | **[S]** ❌ **The "~20% of US auto policies" figure was a CONFLATION and is RETRACTED** — the 14.4% is *global*, the 20.9% is *global pay-as-you-go*. Also concede proactively: the advertised 10–30% discount is **advertised, not realized** — Maryland's regulator found only **31%** of enrolled drivers actually saw a decrease in 2023. |
| ~~Market size — KSA retail + personal finance ~SAR 1.4T~~ | — | **[X] DO NOT SAY.** Chain of custody is *Ken Research → a WordPress blog*. Barred from every slide and every spoken sentence. Use the wedge + FSDP KPI instead — both primary. |

Feasibility narrative in one breath: *the category is live in production on three continents
(behavioral bank, permissioned credit data, telematics pricing); the Saudi regulatory rail
switched on in March 2026; the bank integrates nothing — it extends one endpoint to us; and the
MVP starts with one product type and 2–3 lenders.*

---

## 11. ✅ THE FINAL MVP — what Tabaqa is at AMAD (supersedes §3, §7, §8)

### One sentence

> **Tabaqa is a financing marketplace powered by its own pricing engine on open banking:
> the applicant connects their bank + wallet, and gets REAL offers from multiple lenders —
> not a form, not a lead, not a phone call. A price.**
>
> منصة تمويل مبنية على محرك تسعير خاص فينا — العميل يربط حسابه ومحفظته، ويطلع له عروض تمويل
> حقيقية من عدة جهات. مو استمارة، مو "بنكلمك لاحقًا" — سعر.

### The flow (the whole demo, 5 steps)

1. **اربط** — applicant connects bank account + wallet (consented open banking)
2. **نشتق** — the engine derives verified income, obligations, SAMA installment headroom
3. **اطلب** — applicant asks for what they need: product, amount (slider), tenor
4. **نسعّر** — the engine runs each lender's published policy → real offers (amount, installment, rate, fees, total cost) + counter-offers with the path to the full amount
5. **اختر** — applicant picks; the licensed lender makes the final decision

### The one moment that wins the room

**Bank data only → 0 full offers. Fuse the wallet → 4 offers.** Same person. Same day.

### IN the MVP

- The marketplace: multi-lender real offers, ranked, with total cost
- The engine: open-banking ingestion → verified income → SAMA cap → offer math
- **Request slider + live ceiling** (every number traceable — no magic amounts)
- Counter-offer / path-to-full-amount
- `POST /v1/offers` — the engine served as a keyed API (proves "engine, not interface")
- The trust layer already built: integrity check, compliance receipt, transparent box, copilot
- Scope discipline: **1–2 financing types × 3–5 lenders** (all fictional, labelled illustrative)

### OUT of the MVP

- ❌ Commitment Index (not unique — see decision banner; roadmap slide only)
- ❌ Lender console as a build (static mockup screen in the deck instead)
- ❌ Time-slider "second reveal" (do not split the judge's memory — 0→4 is the reveal)
- ❌ Copilot extension for the index
- ❌ Any real-bank branding (no Alinma)

### The three sentences that defend it

1. **"Aggregators exist — how are you different?"** → They collect a *form* and sell a *lead*.
   We read *verified* data and compute a *price*. They can't produce 0→4; they have no engine.
2. **"Why can't a bank just copy you?"** → The moat isn't the formula — it's the lender network.
   A bank can copy the math; it can't put four competitors' offers on the same screen.
3. **"What's your relationship with the bank?"** → The bank integrates nothing.
   It extends to our side. Applications arrive pre-filled with exactly what its clerk would have
   typed — **its criteria, its approval, our engine.** The approval is real, never a formality.
