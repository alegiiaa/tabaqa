# طبقة · Tabaqa — Scaling the Criteria: an engineering brainstorm

> **Purpose:** not a checklist — a design brainstorm. For the three criteria we're
> pushing now (**Data · UX · Feasibility**), each section is: *honest current state
> (verified against live code)* → *the design principle* → *a menu of ideas with the
> insight behind each* → *recommended flagship bets*. Companion to
> [`WIN_PLAN.md`](./WIN_PLAN.md) (which maps all 5 criteria → tasks); this doc goes
> deeper on 3.
>
> **Scope now:** ③ تحليل البيانات (Data) · ④ تجربة المستخدم (UX) · ⑤ قابلية التنفيذ (Feasibility).
> **Parked for later:** ① الابتكار (Innovation) · ② التطبيق التقني (Technical) — both near-maxed
> in-product; their remaining upside is pitch/positioning.
>
> **The bar (per the ask):** *unique, engineering-grade* features — each one must
> earn its place with an **insight**, be **built on Tabaqa's actual engine/data**
> (cited), and ideally hit **more than one criterion**. No generic "add polish."

---

## 0. The engine facts every idea is built on (verified 2026-07-04)

These are the load-bearing truths — the ideas below are buildable *because* of them:

- **The scorecard is genuinely additive.** `scoring/scorecard.py`: `raw = BASE_POINTS(20) + Σ rc.points`. Each `ReasonCode` carries a **signed integer `points`**, a `code`, a `label`, and the `feature` it came from. → An *exact* score decomposition already exists in every `/v1/score` response. We don't approximate the model; the decomposition **is** the model.
- **Feature bins are explicit thresholds.** Points come from first-match `(predicate, points, code, label)` bins per feature. → We can compute, for any applicant, the *next-better bin* per feature and its point gain → **counterfactuals are computable**.
- **Direction-locked to a real fit.** `_verify_lineage` asserts every served weight points the same way the Berka fit found (AUC 0.890). → Every claim traces to validated data.
- **3-tier verification is on every income component.** `amount_verified` (Masdr) / `source_verified` / `inferred`. → Data-provenance and confidence signals are already in the payload.
- **Live, validated model in the path.** `/v1/score` returns a `validation` block (AUC 0.890 / KS 0.683 / Berka 682). Ablation, 1M-corpus TSTR (0.870), swap-set, calibration all render in `ModelCardPanel`.
- **SAMA DBR is codified.** `sama.py`: 33.33%/25% binding caps, 45/55/65% total-obligation bands, configurable `dbr_cap`. `/v1/affordability` returns policy + citation.

---

## ③ تحليل البيانات — Data Analysis

> **STATUS 2026-07-04 — SECTION COMPLETE & LIVE.** D1 Waterfall ✅ · D2 Path-to-Approval ✅ ·
> D3 Confidence band ✅ · D4 Drift/PSI monitor ✅ · D5 Percentile-vs-corpus ✅ · D6 second-dataset
> cross-check ✅ (pivoted from Kaggle Home Credit → the freely-downloadable **UCI Default of Credit
> Card Clients (Taiwan)**, 30k real accounts: cash-flow lift **+0.131 AUC**, 95% CI 0.123–0.139,
> replicating Berka) · D7 **reframed** from per-applicant champion/challenger (dropped — SAR card vs
> koruna fit is currency-confounded, and expert magnitudes don't track the fit, ρ=−0.23) to the *sound*
> **"transparency has no accuracy cost"**: a transparent additive scorecard (AUC 0.750) vs a gradient-
> boosted black box (0.772) on the same in-distribution data — within 2 pts, rank agreement ρ 0.86.
> D1–D5 on the ② score screen + Model-validation page; D6/D7 on the Model-validation page.
>
> **HARDENED 2026-07-04 EOD (the devil's-advocate pass — see [`DATA_DEFENSE.md`](./DATA_DEFENSE.md)):**
> the claim is now **mechanism-transfer, not coefficient-transfer** — an `external_validity`
> population-transfer panel (Berka → UCI → Saudi-target, with an explicit NOT-validated row),
> a **performance ledger** (one headline AUC 0.864, every other number tagged), the UCI
> **attenuation disclosed first** (+0.203→+0.131 and why), lineage reworded to
> **direction-locked, not magnitude-locked**, PSI relabelled a **demonstration**, TSTR scoped
> to synthesizer fidelity, and recourse guarded to **real risk-lowering levers only** (no
> spoofable coaching). **Later same day:** verified live-fetch research landed real Saudi priors
> (GASTAT deciles · GOSI wage bands · SAMA 13a · Findex → `app/data/saudi_priors/` + `SOURCES.md`)
> and `eval/saudi_anchor.py` shipped the **Saudi-anchored demonstration population** (SAR scale via
> ONE cited factor, shape disclosed, `no_accuracy_claim: true`, D5 ruler unit-fix koruna→SAR) —
> defense now **7/7**. Bonus: **AlfaBattle 2.0** identified as the Berka-at-scale third replication
> (963k labeled apps, ungated); **Home Credit/Amex ruled OUT** (competition-use-only, verified).

**Current state (verified):** genuinely strong and *on-screen*. `ModelCardPanel` shows the wallet-layer ablation (AUC 0.66→0.86, **+0.203** with bootstrap CI), thin-file lift, swap-set (rescued/rejected with realized default), calibration curve, per-feature IV, monotonic score bands, the **1M-account synthetic corpus + TSTR 0.870 (96% retention)**, and a lineage strip. This already beats most teams outright.

### ③-Wave 2 — REAL DATA AT SCALE (opened 2026-07-05, the user's directive: "real data, maximum realness")

> **STATUS 2026-07-05 — D8 MEASURED, same evening.** `eval/alfabattle.py` on the first 10/50
> parts = **213,383 real applications, 4,911 real defaults (2.3%)**: app-only baseline AUC 0.594
> → +transaction-behaviour **0.703**, lift **+0.109**, 95% CI [+0.101, +0.117] (500 boots);
> thin-file third 0.616 → 0.697. Third real population; sign + significance replicate
> (Berka +0.203 → UCI +0.131 → AlfaBattle +0.109 — attenuation honest and expected: weaker
> baseline here is app-only, card stream has no balances). Result: `eval/alfabattle_result.json`
> with feature-mapping + caveats in the D6 discipline. Data gitignored (`data/external/`, 806MB
> local, expandable to all 963k). NOT yet wired into model_card/UI — that's the next step.

> **The honest ceiling, verified before we start:** public **Saudi** consumer data with default
> labels does not exist (our priors + SAR demonstration population are the legal maximum);
> public **US** bank/wallet cash-flow data with labels does not exist either (Cash App/Venmo =
> private; Kaggle Home Credit/Amex = competition-use-only, verified license-blocked). The two
> real upgrades that ARE available:

| # | Idea | The insight | Built on | Hits | Effort |
|---|------|-------------|----------|------|--------|
| D8 | **AlfaBattle 2.0 third replication** — 963k REAL credit applications + real card-transaction histories + real default labels (ungated), run through the same ablation: app-only baseline vs +transaction-behaviour layer, lift + CI → third row in `external_validity` + `cross_check` | Kills the "682 Czech accounts from the 1990s" attack with **~1M real accounts, third country, 1,400× scale**. Same honest pattern as UCI (feature-mapped, mechanism-not-coefficients). "Replicated on three real populations" is a sentence almost no fintech — let alone hackathon team — can say. | `eval/_ablation_core.py` + the D6 cross-check pattern | Data+Innov | **L** |
| D9 | **Bring-your-own-wallet (US formats)** — Cash App / Venmo / PayPal CSV export fingerprints in `adapters.ts`, so a judge uploads THEIR OWN real wallet export and scores themselves | The only legal "real US e-wallet data" on earth is data brought by its owner. Turns "we support any wallet" from a claim into a live stunt: a judge's real Cash App statement → score, on stage. | universal-ingestion adapter layer (shipped) | Data+UX+Tech | **S** |

**Wave-2 bets:** D8 first (the headline), D9 as the demo stunt. Gate for D8: verify the HF
mirror's exact size/license, then subsample honestly if the full 450M-txn download is
hackathon-hostile (a 100–200k-client stratified sample still dwarfs every other team's data).

**Where it's thin:** it's all **population-level** ("the model is good"). A credit officer's next three questions are *applicant-level* and *governance-level*: **"why THIS score?"**, **"what would change it?"**, **"will it keep working?"** — none are answered yet. That's the gap to attack.

**Design principle:** move from *"we validated a model"* → *"we do data science a bank's Model Risk team would respect, live on the applicant."*

### Idea menu

| # | Idea | The insight (why it's not generic) | Built on | Hits | Effort |
|---|------|-----------------------------------|----------|------|--------|
| D1 | **Exact Score Waterfall** — a cascading force-plot from base 20 → final 82, every feature's ± contribution as a bar | Because our model is **truly additive**, this is *exact attribution*, not a SHAP estimate on a black box. "Glass-box, not explained-box." No approximation error to defend. | `reason_codes[].points` + `BASE_POINTS` (already in payload) | Data+UX+Feas | **S** |
| D2 | **Path-to-Approval** — the *minimum* change that flips DECLINE→APPROVE: "verified-income share 62%→75% (+7 pts) crosses 65 → APPROVE" | **Actionable counterfactual / recourse** — cutting-edge responsible-AI, and an *inclusion* tool (a decline becomes coaching). Computable because bins+points+cutoff are known. Nobody in a hackathon ships this. | scorecard bins + approval cutoff | Data+UX+Feas | **M** |
| D3 | **Data-sufficiency band on the score** (not a statistical CI — labelled as such) — "82 ± 4 (90 days, 92% verified)" vs thin-file "58 ± 12 (30 days, 40% verified)" | Ties score **reliability to data sufficiency** — an honesty signal MRM teams live by. Uncertainty ≠ weakness; hiding it is. | `months_observed`, `verified_income_share` | Data+Feas | **M** |
| D4 | **Drift / PSI monitor** — Population Stability Index (training vs live/corpus) per feature, green/amber/red | Signals **SR 11-7 / SAMA model-governance** literacy — "how do you know it keeps working?" Almost no hackathon team shows monitoring. | corpus + training dist | Data+Feas | **M** |
| D5 | **Percentile-vs-corpus** — "Fahd's balance-volatility is P30 of the gig+salary segment" | Turns the **1M corpus from a static stat into a live comparator** — the applicant is placed in a real distribution. | 1M corpus segments | Data+UX | **S** |
| D6 | **Home Credit cross-check (make it real)** — the `cross_check` scaffold, filled with a 2nd real dataset | "**Replicated on a second real dataset**" is the single most credibility-buying line in the panel. Currently a stub. | `ModelCardPanel` cross-check block (built, empty) | Data | **M** ⚠️ needs Kaggle CSVs |
| D7 | **Champion/Challenger** — expert additive card (live) vs Berka WOE scorecard, same applicant, side by side | Proves the demo score's **lineage to the validated model** — "the score *is* the fit, not weights we hope generalize." | both scorecards exist | Data+Tech | **M** |

### Recommended Data bets
1. **D1 Score Waterfall** (S, exact, visceral) — *do first.*
2. **D2 Path-to-Approval** (M, genuinely novel, inclusion story).
3. **D3 + D4 as a small "Model Risk" strip** (data-sufficiency band + PSI demonstration) — the MRM flex.
4. **D6 cross-check** when Kaggle data is available.

---

## ④ تجربة المستخدم — User Experience

**Current state (verified):** animated reveal (bank DECLINE→wallet→APPROVE, count-up, replayable, spoiler-gated); branded bank/wallet cards with real merchant logos; bilingual EN/AR RTL; and (shipped today) a **typed, bilingual error layer with Retry** so a cold-start/network failure never shows a raw "Failed to fetch." Applicants list has a real empty state.

**Where it's thin:** this is the **weakest axis** and the most-felt by Saudi judges. Two structural gaps: (1) **Arabic is translated, not native** — no Arabic-Indic numerals, no Hijri dates, layouts mirrored rather than designed RTL-first; (2) the dashboard is **tabbed fragments**, not a single product-grade decision surface a lender would actually use.

**Design principle:** a Saudi judge opens it and it feels **built for them**, and a lender sees a **decision, not a dashboard**.

### Idea menu

| # | Idea | The insight | Built on | Hits | Effort |
|---|------|-------------|----------|------|--------|
| U1 | **Arabic-first mode** — default AR for Saudi judges; Arabic-Indic numerals (٨٢، ٤٬٠٠٠) toggle; **Hijri dates** on the ledger; RTL-native (not mirrored) layouts; Naskh polish | The single most-felt thing by a Saudi judge. "First-class Arabic" is *felt in seconds* and most teams don't do it. The report already ships Traditional-Arabic Naskh — extend that care to the app. | existing i18n + RTL + report fonts | UX | **M** |
| U2 | **Decision Cockpit** — one screen: reveal delta → score gauge → decision → affordability → top reasons, scannable/screenshot-ready | A credit officer wants **one view they could paste into a credit memo**, not 4 tabs. Turns "dashboard" into "product." | all screens exist; recompose | UX+Feas | **M** |
| U3 | **Tap-to-explain everywhere** — every dense number (PD, IV, DBR, verified share) has a plain-AR/EN tooltip | Makes a dense analyst UI **self-teaching** — a judge is never confused in live review. Removes the "what is this?" friction. | static copy map | UX | **S** |
| U4 | **Judge guided-tour** — subtle skippable walkthrough: "① reveal → ② score → ③ lend against it" | Kills "what do I click" in a live, timed review. Frictionless entry is already our `/demo` theme. | one overlay component | UX | **S** |
| U5 | **Comprehensive skeleton/empty/loading** + branded shimmer (navy) across *every* screen | The error layer is done; the *loading/empty* half isn't uniform. A prototype that never flickers "broken" reads as shipped. | extend `LoadingScreen` pattern | UX+Tech | **S** |
| U6 | **A11y + dual-theme pass** — keyboard nav, focus rings, ARIA, AA contrast in light+dark | "Bank-grade" = accessible. Cheap credibility; also protects the artifact/report look. | existing components | UX | **M** |
| U7 | **Reveal micro-polish** — "✓ Masdr-verified" stamp animation on verified rows; count-up tick | The reveal is the money shot; small verified-stamp motion sells the 3-tier honesty viscerally. | `RevealScreen` (done, extend) | UX+Innov | **S** |

### Recommended UX bets
1. **U1 Arabic-first** (M) — *the headline UX bet for Saudi judges.*
2. **U2 Decision Cockpit** (M) — product-grade single-screen decision.
3. **U3 tap-to-explain + U5 uniform loading/empty** (S each) — never-confusing, never-broken.

---

## ⑤ قابلية التنفيذ الفعلي — Real-world Feasibility in Finance

**Current state (verified):** regulator-accurate (SAMA 33.33/25 + 45/55/65 bands in `sama.py`, Nova Credit $45M, refuted claims swept — `PROOF.md`); `/v1/affordability` enforces a **configurable** DBR with policy label + citation; data-processor-on-consent route, Alinma GTM, per-decision pricing, print-ready credit report + QR verify page. The serving layer (API keys/metering/playground) is **built and deployed** — but `keyed:false`, so key issuance is still fail-open demo mode.

> **STATUS 2026-07-05 (evening) — F2 LIVE & independently verified.** Migration applied (dashboard
> SQL editor), `SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY`+`TABAQA_SIGNING_SECRET` on `tabaqa-api`,
> redeployed. Verified from a fresh session: `/health keyed:true` · `POST /v1/keys` → real
> `tbq_sk_…` (limit 250) · keyed `/v1/score` 200 with `x-ratelimit 250/249/sandbox` · second call
> 248 (counter persists in Supabase) · anonymous demo path intact (82, `scope:anonymous`) · bogus
> key → 401. The `/developers` playground now issues real metered keys. **Feasibility idea menu:
> F1 ✅ F2 ✅ F5 ✅ F6 ✅** — remaining: F3 consent visual, F4 policy engine, F7 fraud overlay (optional).
>
> **STATUS 2026-07-05 (later) — F5 + F6 SHIPPED (build-green, arithmetic verified vs model_card.json).**
> `LenderImpact.tsx` on the Applicants (lender-tools) list: **F5 ROI** — the swap-set measured on
> real Berka defaults (approved-pool bad rate 7.6% → 2.9%, **−61%**) translated to money with the
> lender's own inputs (decisions/mo, ticket, LGD, price/decision; defaults → 279 defaults avoided,
> SAR 7.53M/mo saved vs 250k cost, **×30**), honesty note "measured delta, your policy inputs".
> **F6 inclusion meter** — 37% thin-file share of the demonstration book, bureau AUC 0.60 ≈
> coin-flip → 0.77 with the wallet layer, the verified 78.8%-banked / 56.7%-bureau wedge, and an
> FSDP KPI meter (5.7% → 9.4% actual vs 11% interim missed vs 20%-by-2030) — "an assessment gap,
> not an appetite gap". All figures from model_card.json + EVIDENCE.md refs 20–21.
>
> **STATUS 2026-07-05 — F1 SHIPPED (committed `7cd47bf`).**
> The Compliance Receipt lives on the ④ financing decision: 5 checks **computed from the actual
> decision** (DBR ≤ SAMA cap with the applied policy · decision-on-verified-income share ·
> adverse-action reason codes + recourse · read-only-AIS consent (demo-labelled honest) · no-PIS),
> a `TBQ-C…` reference, a QR → `/verify?rc=<compact token>` (~210 chars, self-contained — same
> architecture as the report), and **Print/PDF → `/receipt?rc=…`**, a Watheeq-style A4 sibling of
> the credit report (reuses the `rpt-*` shell + Hijri issue date). A DECLINE prints an honest ✗
> with the numbers — the receipt documents *why*, which IS adverse-action compliance.

**Where it's thin:** the feasibility story is largely **told in docs**, not **experienced in the product**. A judge can't yet *feel* "a bank integrates this in 5 lines" or "a compliance officer could file this decision."

**Design principle:** make deployability **tangible and clickable**, not claimed.

### Idea menu

| # | Idea | The insight | Built on | Hits | Effort |
|---|------|-------------|----------|------|--------|
| F1 | **Compliance Receipt** — per decision: DBR ≤ cap ✓, income verified ✓, adverse-action reasons available ✓, consent on file ✓, no payment initiation (no PIS) ✓ — exportable, QR-verifiable | A **regulatory artifact a compliance officer could file.** Turns scattered compliance claims into one signed receipt. Feasibility made *tangible*. Pairs with D1 (the reasons) + the existing QR verify page. | affordability policy + reason codes + verify page | Feas+Data+UX | **M** |
| F2 | **Live curlable API + real sandbox key** — make the `/developers` playground issue a working key so a judge integrates live | "A bank ships this in 5 lines" — **experienced, not slideware.** The playground exists; only keystore is offline. | serving layer (built) | Feas+Tech | **S** ⚠️ needs live-Supabase greenlight |
| F3 | **Consent & data-processor flow, visualized** — show the SAMA open-banking consent screen, the read-only scopes, and "processor inside the licensee — no new license" diagram, in-app | Shows the **legal/consent rail**, not just claims it. Answers "is this even allowed?" before it's asked. | new screen | Feas | **M** |
| F4 | **Lender Policy Engine** — a lender sets cutoff score, max tenor, risk appetite; the decision reflects it | "Tabaqa fits **YOUR** policy" — proves it's a deployable product, not a fixed toy. DBR is already configurable; extend to full policy. | `sama.py` config + affordability | Feas+Tech | **M** |
| F5 | **Bank ROI calculator** — "at 10k decisions/mo, the swap-set cuts approved-pool default 43% → X SAR saved vs Tabaqa's per-decision cost" | **Feasibility quantified from our own data** — ties the swap-set (Data) to a CFO's language (money). | swap-set numbers (exist) | Feas+Data | **S** |
| F6 | **FSDP inclusion meter** — "N% of this segment is bureau-unscorable; Tabaqa scores them → moves the FSDP 20%-SME-by-2030 KPI" | National-impact framing **in-product**, not just a pitch line. | corpus segments + thin-file lift | Feas | **S** |
| F7 | **Fraud/AML overlay** — simple SAMA counter-fraud signals: too-smooth income (synthetic), circular transfers, velocity | A licensee needs **fraud controls**; surfacing basic ones shows production-awareness. | transaction stream | Feas+Data | **M** |

### Recommended Feasibility bets
1. **F1 Compliance Receipt** (M) — *the flagship feasibility artifact; cross-cuts Data+UX.*
2. **F5 ROI calculator + F6 inclusion meter** (S each) — feasibility in the buyer's language, from our own numbers.
3. **F2 live API key** (S) — *high impact, but needs your green light on live Supabase.*

---

## ★ Cross-cutting flagships (hit 3 criteria at once — highest ROI)

These are the ones to lead with. Each is novel, engineering-grade, and scores on multiple axes:

1. **Exact Score Waterfall + auto Adverse-Action reasons (D1)** → Data (exact attribution) · Feasibility (regulator-grade explainability) · UX (visceral). *Cheapest flagship; data already in the payload.*
2. **Path-to-Approval counterfactual (D2)** → Data (recourse) · UX (interactive) · Feasibility (inclusion). *Most novel single feature we could ship.*
3. **Compliance Receipt (F1)** → Feasibility (filable artifact) · Data (the checks) · UX (clean export). *Ties the reasons, the DBR, and the QR page into one deliverable.*
4. **Model-Risk strip: confidence band + PSI drift (D3+D4)** → Data · Feasibility. *The MRM flex that finance-literate judges reward and rookies never show.*
5. **Arabic-first (U1)** → UX. *Not cross-cutting, but the highest-felt single UX bet for this specific audience.*

---

## Suggested sequence

**Wave 1 — cheap, high-impact, zero external dependency (do now):**
- D1 Score Waterfall · U3 tap-to-explain · U5 uniform loading/empty · F5 ROI · F6 inclusion meter

**Wave 2 — the novel flagships:**
- D2 Path-to-Approval · F1 Compliance Receipt · U2 Decision Cockpit

**Wave 3 — the MRM + Arabic-first depth:**
- D3+D4 Model-Risk strip · U1 Arabic-first · U6 a11y/dual-theme

**Blocked on a decision from you:**
- D6 Home Credit cross-check → **Kaggle CSVs**
- F2 live API sandbox key → **green light on applying the migration to live Supabase**

---

## Decisions I need from you

1. **Which flagships?** My pick to lead: **D1 (Waterfall) → D2 (Path-to-Approval) → F1 (Compliance Receipt)**. Agree, or reprioritize?
2. **Live Supabase** for the curlable-API key (F2) — yes/later?
3. **Kaggle CSVs** for the real cross-check (D6) — can you drop them, or synthesize a defensible proxy?
4. **Arabic-first default** (U1) — flip the app default to AR (with an EN toggle), or keep EN default and just deepen AR quality?

*Created 2026-07-04. Focus: criteria ③④⑤. Companion: [`WIN_PLAN.md`](./WIN_PLAN.md) · [`PROOF.md`](./PROOF.md) · [`eval/DATA_REPORT.md`](./app/eval/DATA_REPORT.md).*
