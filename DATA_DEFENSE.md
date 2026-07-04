# طبقة · Tabaqa — Data-Analysis Defense: solving the 7 devil's points, one by one

> **Purpose:** A working checklist to harden the **③ تحليل البيانات (Data Analysis)** section of
> [`SCALE_PLAN.md`](./SCALE_PLAN.md) against a hostile, finance-literate judge. Companion to the
> SCALE_PLAN Data section — that doc says "COMPLETE & LIVE"; this doc is the honest audit that says
> *"complete on the menu I wrote myself ≠ bulletproof,"* and turns each crack into a defensible move.
>
> **Every fix here is grounded in a verified file read (2026-07-04).** No hand-waving.
> **The prime directive: we do not fabricate Saudi data. We reframe, disclose, and calibrate-on-deploy.**
>
> **STATUS 2026-07-04 EOD — DEFENSE CLOSED (7 / 7).** P2 ✅ P3 ✅ P4 ✅ P6 ✅ P7 ✅ ·
> P1 ✅ FULLY (external-validity panel + Saudi-anchored demonstration corpus — `eval/saudi_anchor.py`, priors in `app/data/saudi_priors/`) · P5 ✅ (budget respected — reframes + small builds only).
> Shipped via `eval/harden_card.py` (idempotent restamp of every served `model_card.json`) +
> `scoring/scorecard.py` + `eval/model_intel.py` + `ModelCardPanel/RecoursePanel` + API `note` field.
> **How P1 Build 2 closed (same day):** verified live-fetch research pulled GASTAT HIES income
> deciles + expense shares, the GOSI wage-band histogram, SAMA bulletin table 13a, and Findex
> 2024/2025 into **`app/data/saudi_priors/`** (`SOURCES.md` there has figures, URLs, caveats).
> `eval/saudi_anchor.py` then shipped the **Saudi-anchored demonstration population**: ONE cited
> scale factor (SAR 7,362 HIES-median ÷ CZK 8,991 corpus-median = ×0.819) on the 5 money columns —
> every rank/ratio/correlation preserved, `no_accuracy_claim: true` asserted at runtime, D5
> percentile ruler unit-fixed koruna→SAR, rendered in `ModelCardPanel`.
>
> **Research bonus finds:** **AlfaBattle 2.0** (real card transactions + 963,812 labeled defaults,
> ungated HF — the Berka-at-1,400× third-replication candidate, gray license → disclose) ·
> **Bondora/Go&Grow** (737k lender-published loans, cleanest license) · **Home Credit/Amex ruled
> OUT for published numbers** (competition-use-only, rules verified verbatim — `homecredit_crosscheck.py`
> stays dormant).

---

## 0. The one insight everything rests on — the **two-layer** truth (verified)

The critique lands hard *only because it conflates two layers that the code keeps separate*:

| Layer | Files | What it is | Saudi content |
|---|---|---|---|
| **Validation / data-science** | `app/eval/*`, `scoring/train.py` | Every statistical claim: 0.86 full AUC, **+0.203 lift**, 0.75 Taiwan, TSTR 0.87, PSI, 1M copula corpus | **None.** 100% Czech Berka + Taiwan UCI |
| **Product / serving** | `scoring/scorecard.py`, `pipeline/*`, `sama.py` | The live "82", SAR, Masdr tiers, **real SAMA DBR caps**, ALLaM | Saudi-flavored, but **demo-grade, not fit** |

**Consequence:** the served demo score is a *hand-tuned, direction-locked expert card* (`scorecard.py`), **not** any of the fitted logistic models. The fits (0.890 Berka-6feat, 0.864 Berka-full, 0.75 Taiwan) are separate logistic regressions. This single fact drives fixes P2 and P3.

**The governing reframe for the whole section (this is the headline defense):**
> We do **not** claim our coefficients predict Saudi default. We claim the **mechanism** — cash-flow
> beats bureau-only for thin-file borrowers — **transfers**, evidenced by the same signed, significant
> lift replicating across **two maximally-different real populations** (Czech retail 1990s **+0.203**,
> Taiwan cards 2005 **+0.131**). Coefficients are **re-fit on the licensee's own book at go-live** —
> the direction-lock (`_verify_lineage`) + `train.py` path already exists for exactly this.

---

## The master checklist — all 7 points

Legend — Effort: **S** ≤2h · **M** ½–1 day · **L** >1 day. Type: **Reframe** (words/labels, no new model) · **Build** (code) · **Budget** (a decision, not a task).

| # | Devil's point (verified root cause) | The honest fix | Type / Effort | Done when (the signal) | ☐ |
|---|---|---|---|---|---|
| **P1** | **Zero external validity.** All stats are Berka (Czech, 1990s, koruna, 682 acct) + Taiwan. No Saudi loan/SAR/default anywhere. Corpus is a Berka copula; even balances are koruna-scale. | Reframe claim → **mechanism-transfer, not coefficient-transfer**; add loud `external_validity` disclosure + **calibrate-on-deploy** plan; Saudi-anchor the corpus **marginals** (SAR scale, GOSI/SAMA/Findex priors) as a **demonstration population that yields NO cited AUC**. | Reframe **+** Build **M** | Harshest reader asks *"what population did you validate on?"* → crisp 3-part answer (mechanism / 2 replications / your book), not a stammer. | ✅ (B1+B2) |
| **P2** | **The "82" is not the validated model.** Served points are hand-tuned integers; their magnitudes **anti-correlate** with the fit (ρ ≈ −0.23; independently reproduced ρ = −0.257). `_verify_lineage` checks **direction only**. Yet the docstring claims *"the decomposition IS the model."* | **Stop over-claiming.** Rewrite every "IS the model" line → *"regulator-aligned, **direction-locked** expert card; the fit validates the **sign** of every weight + the mechanism; magnitudes are policy-set and re-calibrated on deployment."* Keep direction-lock. (Optional: a "calibrated mode" that sets points ∝ fitted \|coef\|.) | Reframe **S** | No sentence in docs/UI equates the served card's **magnitudes** with the fit. The ρ=−0.23 fact is disclosed as *"direction-locked, not magnitude-locked — by design."* | ✅ |
| **P3** | **Number soup.** "The transparent scorecard" is quoted as **0.890** (Berka 6-feat holdout), **0.864** (Berka full CV), and **0.75** (Taiwan) on different panels — three different fits, none the served card. | Ship one **Model Performance Ledger**: exactly **one headline** (`Berka full, 5-fold CV AUC 0.864; +0.203 over bureau`), every other AUC tagged `{dataset · features · model-type · purpose}`. Retire the loose `AUC 0.890` citation in `scorecard.py` docstring (or label it "6-feature holdout sub-metric"). | Reframe **S** | A judge points at any number; you name its dataset+model in one breath; there is exactly **one** "headline." | ✅ |
| **P4** | **D6 replication shrank 36%, sold as a clean win.** +0.203 (Berka) → **+0.131** (Taiwan), but the panel frames only "replicated on a 2nd real dataset." | **Disclose the attenuation first.** Add `attenuation_note`: effect **sign + significance replicate** (both CIs exclude 0); magnitude shrinks as expected across a **different product** (revolving cards vs retail), **proxy cash-flow** (repayment history, not true bank flow), and **2× base rate** (22% vs 11%). "It attenuates; it does not vanish." | Reframe **S** | The panel states the shrinkage + its cause **before** a judge finds it. | ✅ |
| **P5** | **You're hardening the axis you already win.** Your own SCALE_PLAN says Data "beats most teams outright," UX is "the weakest axis," Feasibility is "told in docs." | **Budget cap:** P1–P4, P6–P7 are mostly *reframes + ≤2 small builds*. Cap **new Data build at ≤1 day total**, then **redirect** to U1 (Arabic-first) + F1 (Compliance Receipt). This doc's job is to *defend*, not to expand. | Budget | Total *new* Data code effort ≤ 1 day; next commits after that are UX/Feasibility. | ✅ |
| **P6** | **MRM theater.** PSI compares the corpus **against a resample of itself** (synthetic-vs-synthetic, `model_intel.py:80-112`) while prose claims "live vs training." TSTR is sound but oversold as "anti-circularity proof of generalization." Confidence band is a **heuristic** (`scorecard.py:458-470`) — the *code* labels it honestly; the *SCALE_PLAN doc* calls it a "confidence band." | **Relabel to match reality.** PSI → *"drift-monitor **demonstration**: we inject a known covariate shift into the corpus to show the monitor fires"* (+ optional real Berka early/late temporal PSI). TSTR → *"proves the **synthesizer** is faithful (train-synthetic/test-**real**), not Saudi generalization."* Confidence band → align SCALE_PLAN wording to the code's *"data-sufficiency signal, not a statistical CI."* | Reframe **S** (+opt Build S) | Every MRM widget's label = exactly what it computes. No "live/training" claim over synthetic-vs-synthetic. | ✅ |
| **P7** | **Path-to-Approval may coach gaming.** Recourse is computed on the same card whose magnitudes are unreliable (P2); "+7 pts" is magnitude-dependent; some features could be gamed without lowering true risk. | Recommend recourse only on features that are **direction-locked AND causally real** (↑ verified-income share via **Masdr** = revealing true income, not gaming; ↓ NSF = genuinely fewer overdrafts). Express as **"cross this bin threshold"** (direction-valid) not "exactly +N points" (magnitude-dependent). Add: *"indicative, re-scored on real data, not a guarantee."* | Reframe **+** Build **S** | Every recourse suggestion maps to a real behavior that lowers true risk; no cosmetic/gameable lever; no exact-points promise. | ✅ |

---

## Per-point detail — the actual moves

### P1 — External validity (the anchor; do this one properly)

**Root cause (verified):** `corpus.py:61-79` fits a copula on the Berka joint table; `model_intel.py:91` notes koruna-scale balances; the only real Saudi external source is `sama.py` DBR policy. Caveat already exists at `model_card.json:849-852` but is a footnote.

**Build 1 — reframe + disclose (Reframe, S):**
- Rewrite the SCALE_PLAN ③ status line + `model_card.json` `caveats`/`lineage` from *"validated model"* → the **mechanism-transfer** paragraph in §0 above.
- Add a first-class `external_validity` block to `model_card.json` (and render in `ModelCardPanel`): a **population-transfer table** — three columns **Berka (Czech 1990s)** · **UCI (Taiwan 2005)** · **Saudi (target)** × rows *"what's validated here / what transfers / what's calibrated locally."* This turns the weakness into a rigor display.

**Build 2 — Saudi-anchor the corpus *marginals* (Build, M):**
- In `corpus.py`, keep the **Berka-learned copula** (the dependency structure = the transfer object) but **re-anchor the marginals** to published Saudi priors: koruna→**SAR** rescale, income/DBR/segment-mix from **SAMA household-credit stats + GOSI/Mudad wage bands + Findex inclusion rates**. Cite each prior inline.
- **Hard guardrail:** this "Saudi demonstration population" produces **no cited AUC/KS**. Its only outputs are (a) "the pipeline runs end-to-end on Saudi-shaped data" and (b) a **stress surface** for the scorecard. Label it `demonstration_population`, never `validation`.

**Signal → back to Observe:** re-run the devil (or a MRM-literate human) with the single question. A nod = done.

### P2 — Make the lineage claim honest

**Root cause (verified):** `scorecard.py` points are literal integers (`:166-221`); `_verify_lineage` (`:62-84`) asserts **direction only**; docstring (`:8-23`) over-claims. Expert points vs fit \|coef\|: `nsf_count` = highest fit weight (2.23) but only 12 pts & **IV 0.0** on Berka; `income_regularity` = most expert points (18) but smallest \|coef\| (0.22). ρ ≈ −0.23.

**Move:** grep the repo for *"is the model" / "IS the model" / "no approximation error"* and rewrite to the direction-locked language in the table. Add one honest sentence to the panel: *"Direction-locked, not magnitude-locked — every point moves the credit-sensible way the fit found; magnitudes are policy-set and re-fit on your book."* This **converts** the ρ=−0.23 landmine into a deliberate design choice you volunteer.

### P3 — One performance ledger

**Move:** a single table (doc + panel). **Headline = Berka full model, 5-fold CV AUC 0.864, +0.203 over bureau baseline** (CV > single-holdout, and it's the one tied to the flagship lift). Everything else labeled: `0.890 = Berka, 6 cash-flow feats, 30% holdout, logistic`; `0.75 = Taiwan, demo+repayment feats, OOF logistic`; `0.772 = same, gradient-boosted`. Kill the bare `0.890` in `scorecard.py:12-13,22` or annotate it.

### P4 — Own the shrinkage

**Move:** `attenuation_note` in the `cross_check` block + one panel line. The three causes (product type, proxy features, base rate) are all defensible and all true. Saying it first is disarming; letting a judge find it is fatal.

### P5 — Spend the saved time on UX/Feasibility

**Move:** none in Data beyond the above. After P1's two builds, the next commit is **U1 (Arabic-first)** or **F1 (Compliance Receipt)**. Track it: if you're still polishing Data past ~1 day, you're losing points you already banked to chase points you can't gain.

### P6 — Relabel the MRM widgets to the truth

- **PSI** (`model_intel.py:80-112`): change the prose at `:104-105` from *"same PSI a production monitor runs on the live applicant stream vs training"* to *"a drift-monitor demonstration — we inject a known shift into the corpus to prove the monitor fires."* Optional real signal: temporal PSI on Berka early-vs-late accounts (non-synthetic).
- **TSTR** (`corpus_train.py`): reword scope to *"proves the synthesizer is faithful (train-on-synthetic / test-on-**real** held-out), which is the anti-circularity — it says nothing about Saudi generalization."*
- **Confidence band:** the code (`scorecard.py:374-376`) is already honest — *"data-sufficiency signal, not a statistical CI."* Fix is only in **SCALE_PLAN D3 wording**: call it a *"data-sufficiency band,"* not a *"confidence band."*

### P7 — Recourse that reveals truth, not games inputs

**Move:** in the D2 computation, (1) whitelist recourse features to `{verified_income_share↑ via Masdr, nsf_count↓, income_regularity↑}` — all of which are genuine risk-lowering behaviors, not cosmetic; (2) present as *"cross into the next bin"* (direction-valid under P2) rather than an exact point promise; (3) append the disclaimer. Exclude anything a user could satisfy on paper without lowering true default risk.

---

## Suggested order (respecting P5's budget)

1. **P2 + P3 + P4 + P6** — all **Reframe/S**, half a day total, and they close the sharpest "gotcha" cracks. *Do first.*
2. **P1 Build 1** (disclosure + population-transfer table) — **Reframe/S**, the headline defense.
3. **P1 Build 2** (Saudi-anchored demonstration corpus) — **Build/M**, the one real build; highest credibility-per-hour for point #1.
4. **P7** — **S**, quick guardrail on the recourse feature.
5. **STOP.** Redirect to **U1 / F1** (P5).

## Guardrails (do not violate)

- **No fabricated Saudi data.** The demonstration corpus yields no cited accuracy number, ever.
- **Disclose, don't bury.** External validity is a first-class panel, not a footnote — that's what flips it from weakness to credibility.
- **Direction, never magnitude.** Every lineage/recourse claim rides the fit's *sign*, which is validated; never its magnitude, which is not.

*Created 2026-07-04. Grounded in a verified read of `app/eval/*`, `scoring/scorecard.py`, `scoring/train.py`, `sama.py`, `model_card.json`. Companion: [`SCALE_PLAN.md`](./SCALE_PLAN.md) ③.*
