# Tabaqa — The wallet-layer ablation

> **What the wallet layer adds, measured on real defaults — and the in-app panel
> that renders it.**
>
> Engine: [`eval/ablation.py`](./ablation.py) · Data: [`model_card.json`](./model_card.json)
> · Panel: [`web/src/components/dashboard/ModelCardPanel.tsx`](../web/src/components/dashboard/ModelCardPanel.tsx)

---

## 0. The journey — why this exists

The starting question was *"how do we go further on the data-analysis phase so that a
PhD-level data person watches the demo and says **this is impressive work?**"*

The honest answer: a good AUC never impresses an expert — they've seen 0.85 a thousand
times. What earns respect is **watching you do the hard, correct analysis most teams
skip**, live, on real outcomes. So we built the one experiment that does that.

**The reframe — three models, kept separate (mixing them is what a sharp judge catches):**

| Model | What it is | Where | Role |
|---|---|---|---|
| **Live MVP score** | Transparent additive points scorecard (expert weights, no training) | `scoring/scorecard.py` | Runs in the demo; every point → a reason code |
| **Validation model** | Fitted logistic regression on the cash-flow features vs real defaults | `eval/berka_train.py` | Proves the features predict (AUC 0.858) |
| **Baseline / "simpler model"** | Fitted model on **bureau/demographics only — cash-flow removed** | `eval/ablation.py` | The thing we **turn off** in the ablation |

The **baseline** is the key idea: a score means nothing on its own — good *compared to what?*
The baseline is *everything a traditional bank/bureau already sees*, with the wallet layer
removed. The gap between it and the full model is **the value of the wallet layer, as a number.**
That gap *is* the reveal ("the bank sees 4,000 → Tabaqa sees 10,000"), at the model level.

---

## 1. What the engine does (`eval/ablation.py`)

A **controlled, nested ablation on the same accounts** — the textbook-correct way to
measure the incremental value of a feature block (no cross-dataset confound):

- **BASELINE** = bureau view: `age, gender, account_tenure, card_tier, loan_amount,
  loan_duration, loan_payments` + district socio-economics (`salary, unemployment,
  crime/1000, urban ratio, entrepreneurs`). *What a lender sees today.*
- **FULL** = BASELINE **+ the 7 cash-flow features** (the wallet layer).
- Every account gets an **out-of-sample** prediction (5-fold cross-validation), so nothing
  is scored on data it trained on.

Rigor a credit-risk reviewer looks for, all emitted:

- **Leakage discipline** — cash-flow features use **strictly pre-loan** transactions
  (measured before the outcome exists).
- **Bootstrap 95% CI on the *paired* AUC lift** — comparing two AUCs naively is a stats
  trap; we resample 3,000× and report the confidence interval on the *difference*.
- **Thin-file conditional** — AUC *within* the shortest-history third (the bureau's blind spot).
- **Calibration** — reliability curve + Brier (is the PD an accurate *probability*, not just a rank?).
- **Swap-set** — at a fixed approval volume, who the wallet layer flips, and their **realized** default rate.
- **Reproducible** — public CTU Berka DB, no login, fixed seed; writes `model_card.json`
  to `eval/`, `web/public/`, and `web/src/data/` (the app bundles the last one).

Run it:

```bash
pip install scikit-learn pandas pymysql numpy
python3 eval/ablation.py        # ~30s against the public Berka MariaDB
```

---

## 2. The results (real, out-of-sample, on Berka / PKDD'99)

**682 loan accounts · 76 real defaults (11.1% bad rate).**

| Model | AUC | KS | Brier |
|---|---|---|---|
| Bureau view (12 traditional features) | **0.661** | 0.249 | 0.2245 |
| **+ Wallet layer (7 cash-flow features)** | **0.864** | 0.631 | 0.1262 |
| **Lift from the wallet layer** | **+0.203** | | |

**95% CI on the lift: +0.144 … +0.268. Significant in 100% of 3,000 bootstrap resamples.**
The wallet layer more than **doubles** discriminatory power over chance (0.16 → 0.36 above 0.5).

**Thin-file collapse (the kill-shot).** On the shortest-history third (252 accounts, ≤11
months of banking): bureau AUC **0.596** — barely above a coin-flip — → **0.775** with the
wallet layer. *The bureau is nearly useless exactly where it matters, and cash-flow rescues it.*

**Swap-set at equal 60% approval volume (the business kill-shot):**
- Approved-pool realized default rate: **7.6% → 2.9%** (**−61%**) with the wallet layer.
- **100 borrowers rescued** by the wallet layer (bureau declined) default at just **3.0%** —
  good borrowers the bureau wrongly rejected.
- **100 borrowers rejected** by the wallet layer (bureau approved) default at **22.0%** —
  risky borrowers the bureau wrongly waved through.

**Calibration** improves too: Brier **0.2245 → 0.1262** — the PD is a better probability, not
just better-ranked. Score bands are **monotonic**: 38.7% → 8.1% → 5.2% → 2.9% → 0.7%.

**Feature strength (Information Value):** `balance_volatility` 1.30, `income_regularity` 0.44,
`recurring_obligation_load` 0.32, `min_balance` 0.32, `income_expense_ratio` 0.30,
`avg_balance` 0.24, `nsf_count` 0.00 (Berka accounts never overdraft — reported honestly).

**Pitch lines these buy:**
- *"The wallet layer adds +0.20 AUC over a bureau baseline — significant in 100% of bootstraps."*
- *"On thin-file borrowers the bureau scores 0.60 — noise. We score 0.78."*
- *"At the same approval rate we cut realized defaults from 7.6% to 2.9%."*

---

## 3. The demo — `ModelCardPanel` (Dashboard → "Model validation")

The panel renders `model_card.json` and makes the ablation **interactive**. The centrepiece
is the **wallet-layer toggle**: `[ Bureau view ] [ + Wallet layer ]`.

- Flip it and the big **AUC counts** 0.661 ↔ 0.864 (framer-motion), the **ROC curve** draws
  in (hand-rolled SVG, no chart lib), KS/Brier update, and the **+0.203 lift chip with its CI**
  appears.
- Below: the **thin-file** two-curve chart (bureau hugging the diagonal), the **swap-set**
  rescued/rejected cards, the **calibration** reliability curve, feature IV bars, and the
  monotonic score bands.
- Footnotes carry the honesty tells: *no leakage*, *bootstrap CI*, *reproducible*, and the
  **reject-inference** caveat (booked ≠ through-the-door) that reads as *credit scientist*.

**How to show it live:** open `/demo` (no sign-up), pick any bank+wallet, go to **Model
validation** in the sidebar. Start on `+ Wallet layer` (strong), then click **Bureau view**
to watch the curve collapse — that's the "do that again" moment. Numbers are bundled at build
time (`web/src/data/model_card.json`), so the toggle is instant and can't break mid-pitch.

---

## 4. Honest caveats (say them before you're asked)

- **Berka is Czech retail banking (1990s)** — used because it's the *only* public data that
  pairs real transactions with real default outcomes; a proxy for the Saudi product.
- The **"bureau view" is a demographics/district/loan-terms proxy** for a real credit-bureau
  file (Berka has no bureau feed). Stated honestly — and it makes the lift *conservative*,
  since we gave the baseline the requested loan terms too.
- Labels are **booked loans only**; production adds **reject inference** for the through-the-door
  population (selection bias). Out of scope for a public benchmark, but named on the panel.

---

## 5. Files touched

| File | What |
|---|---|
| `eval/ablation.py` | **New.** The ablation engine → `model_card.json` (3 locations). |
| `eval/model_card.json` | **New.** Generated results (also `web/public/`, `web/src/data/`). |
| `web/src/components/dashboard/ModelCardPanel.tsx` | **New.** Interactive panel + ROC/calibration SVGs. |
| `web/src/components/dashboard/Dashboard.tsx` | `model` section now renders `ModelCardPanel` (was `ValidationPanel`). |
| `web/src/styles.css` | **+~55 lines** of `.mc-*` / `.roc-*` styles. |
| `web/src/data/model_card.json` | **New.** Build-time bundled copy the panel imports. |

`ValidationPanel.tsx` + `lib/validation.ts` (the earlier static berka_train panel) are now
superseded by `ModelCardPanel`; left in place as a fallback, no longer wired in.
