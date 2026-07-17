# Tabaqa Synthetic Cohort — Data Dictionary (v1.0)

**Population:** 500,000 synthetic Saudi test identities, generated deterministically
per national ID (no storage; NIN ↔ index is an invertible permutation). Every column
below is either a **generated fact** (seeded RNG, stable forever) or a **derived
metric** (`api/riskmodel.py`, model `tabaqa-risk-1.0` — pure functions, auditable,
same inputs → same outputs). No health data exists anywhere in the population —
excluded by design, not filtered after the fact.

**Files** (all regenerable, gitignored):

| file | grain | command |
|---|---|---|
| `data/synthetic/cohort_500k.csv` | 1 row / person — facts + full risk block (~59 cols) | `python -m api.sandbox export` |
| `data/synthetic/cohort_export/persons.csv` | 1 row / person (identity + employment facts) | `python -m api.sandbox export-full` |
| `data/synthetic/cohort_export/obligations.csv` | 1 row / credit obligation | ” |
| `data/synthetic/cohort_export/holdings.csv` | 1 row / security position | ” |
| `data/synthetic/cohort_export/properties.csv` | 1 row / registered property | ” |
| `data/synthetic/cohort_export/risk_metrics.csv` | 1 row / person — the derived block only | ” |
| `data/synthetic/cohort_export/transactions_sample.csv` | every transaction, first 2,000 persons | ” |

Join key everywhere: `national_id`. Per-person API view: `GET /sandbox/v1/analytics/{nin}`.

**Consistency guarantee:** columns that a raw statement already implies are *replayed
from the same RNG stream* that builds the statement — `rent_monthly_sar` equals the
rent rows in `/sandbox/v1/bank-core/{nin}`, `recent_inquiries_6m` equals the bureau
payload — so the tabular view and the raw payloads can never disagree. New behavioral
facts use a separate additive seed (`tabaqa-cohort-adv-{idx}`), so every previously
shipped field (names, salaries, grades, statements) is byte-identical to earlier runs.

---

## 1 · Person facts (generated)

| column | type | meaning / generation |
|---|---|---|
| `idx` | int | cohort index 0…499,999 (wide file only) |
| `national_id` | str(10) | Luhn-valid test NIN, starts with 1 |
| `name_ar`, `name_en` | str | synthetic name |
| `age` | int | identity-derived; floored at 21 + service_years (career-consistent) |
| `region` | str | weighted over 12 Saudi cities (الرياض 29%, جدة 17%, الدمام 13%, …) |
| `sector` | str | حكومي / خاص |
| `employer` | str | employer name (10 archetypes) |
| `employer_category` | str | the tier Saudi banks price on: حكومي · خاص — مدرجة كبرى · كبيرة · متوسطة · ناشئة · أخرى |
| `monthly_salary_sar` | int | triangular(4,000, 42,000, mode 9,500), rounded to 500 — GOSI-verified salary |
| `service_years` | int | 0–24 |
| `side_income_sar` | int | 40% of persons; 500–4,000/mo, observed in wallet statements |
| `rent_monthly_sar` | int | 22–34% of salary — **replayed from the bank-core statement stream** |
| `obligations_count` | int | 0–3 (weights 25/35/28/12) |
| `obligations_monthly_sar` | int | Σ monthly payments (matches bureau payload) |
| `credit_grade` | A–E | from obligation load + service; E ⇔ recorded serious delinquency (~4%) |
| `serious_delinquency` | 0/1 | bureau-recorded default event |
| `marital_status`, `dependents` | str, int | civil-registry facts (household size) |
| `portfolio_value_sar` | float | Tadawul-style holdings market value (30% of persons) |
| `properties_count`, `property_value_sar` | int | registered real assets (22% of persons) |

## 2 · Bureau behavior facts (generated, additive seed)

| column | type | meaning |
|---|---|---|
| `worst_delinquency_24m` | 0/30/60/90 | worst days-past-due in 24m; 90 ⇔ `serious_delinquency`; else 0/30/60 at 86/10/4% |
| `credit_history_months` | int | bureau file age, 8–220m, capped by (age−20)×12 |
| `thin_file` | 0/1 | file < 24 months — the inclusion-gap segment |
| `recent_inquiries_6m` | 0–3 | **replayed from the credit-bureau payload** |
| `card_utilization` | 0.12–0.93 | revolving utilization; empty when no card |
| `credit_mix_count`, `has_credit_card`, `has_bnpl` | int, 0/1 | derived from obligation types (BNPL now reports to the bureau) |

## 3 · Affordability (SAMA Responsible Lending discipline)

Grounding: SAMA *Responsible Lending Principles for Individual Customers*,
Circular 46538/99, Ch. IV — mirrored from `app/sama.py`. Income rule mirrors the
Tabaqa engine: eligible income = salary + 50% × stable side income.

| column | formula |
|---|---|
| `eligible_income_sar` | salary + 0.5 × side_income |
| `dbr` | obligations_monthly / salary (the installment-burden ratio) |
| `installment_headroom_sar` | max(0, 0.3333 × salary − obligations_monthly) |
| `sama_total_dbr_ceiling` | 0.55 if income ≤ 15k · 0.65 if 15–25k · 0.45 above (segment ceiling) |
| `within_sama_ceiling` | obligations / (salary + side) ≤ ceiling |
| `max_financing_48m_sar` | inverse annuity of the headroom at 7% APR, 48m (capacity proxy) |
| `essential_expenses_sar` | 2,600 + 750 × dependents + rent — GASTAT HICES-2023-anchored floor (affordability input only, never a score feature) |
| `residual_income_sar` | (salary + side) − obligations − essentials |
| `residual_income_ratio` | residual / total income |

## 4 · Wealth & buffers

| column | formula / grounding |
|---|---|
| `eos_benefit_sar` | end-of-service award — Saudi Labor Law Art. 84: ½ month/yr for first 5 yrs, 1 month/yr after |
| `net_worth_proxy_sar` | portfolio + property + EOS − total outstanding |
| `asset_coverage_ratio` | (portfolio + property) / outstanding; empty when debt-free |
| `liquidity_buffer_months` | 0.9 × portfolio / essential expenses |

## 5 · Scores & loss model (bureau + rating-agency mechanics)

`bureau_score_sim` — SIMAH-style behavioral score, **300–900**: grade base
(A 812 · B 748 · C 672 · D 588 · E 452) adjusted for delinquency depth (−38/−18),
inquiry intensity (−22/−8), DBR bands (−24/−10), tenure (+14), asset coverage (+10),
thin file (−16), government employment (+8).

`pd_12m` — 12-month probability of default (Moody's-Analytics-EDF-style):
grade base (A 0.6% · B 1.4% · C 3.2% · D 7.5% · E 24%) × multiplicative risk
drivers — delinquency 30/60 dpd (×1.25/×1.60), DBR > 50%/33% (×1.45/×1.18),
inquiries ≥ 3 (×1.12), thin file (×1.22), negative residual income (×1.50),
tenure ≥ 5y (×0.88), coverage ≥ 1 (×0.90), government (×0.93). Clamped [0.15%, 60%].

| column | formula / grounding |
|---|---|
| `lgd` | downturn LGD, unsecured consumer: 0.62 − 0.16 × min(coverage, 1) − 0.04 if gov (salary-assignment recovery); clamp [0.32, 0.68] |
| `ead_sar` | outstanding + **50% CCF** × undrawn revolving limit (Basel credit-conversion factor); limit inferred from utilization |
| `expected_loss_sar` | **EL = PD × LGD × EAD** — the Basel expected-loss identity |
| `el_bps` | EL as basis points of EAD |
| `internal_rating` | 10-notch masterscale banded on PD: R1 ≤ 0.25% · R2 ≤ 0.5% · R3 ≤ 1% · R4 ≤ 2% · R5 ≤ 4% · R6 ≤ 8% · R7 ≤ 16% · R8 ≤ 30% · R9 ≤ 60% · R10 above |
| `ifrs9_stage` | 3 = credit-impaired (recorded default) · 2 = SICR: 30+ dpd, or (DBR > 50% **and** negative residual), or PD ≥ 8% backstop · 1 = performing. Population lands ≈ 82.5 / 13.7 / 3.7% |
| `risk_segment_ar` | منخفضة · متوسطة · مرتفعة · متعثرة — from stage + PD |

## 6 · Stress test (+200 bps)

| column | formula |
|---|---|
| `stress_dbr_200bps` | DBR × [annuity(9%, 48m) / annuity(7%, 48m)] ≈ ×1.039 — repriced through the actual annuity, not a guessed haircut |
| `stress_within_cap` | stressed DBR still ≤ 33.33% installment cap |
| `stressed_pd_12m` | PD × 1.35 (mild-recession scenario scalar), cap 75% |

## 7 · Verification & lineage

| column | meaning |
|---|---|
| `income_verified_share` | salary / (salary + side) — how much of income is registry-verified vs statement-observed |
| `salary_months_observed` | salary credits seen in the 6-month statement window (6/6 for the whole cohort) |
| `model_version` | `tabaqa-risk-1.0` — bump on any formula change |

---

### Sanity profile (30k stratified sample)

- Mean PD by grade — A 0.58% · B 1.35% · C 3.1% · D 8.0% · E 35% (monotone ✓)
- IFRS 9 stages — S1 82.5% · S2 13.7% · S3 3.7% (typical performing consumer book)
- EL ≡ PD × LGD × EAD holds row-by-row; `dbr` reconciles with raw obligations; rent
  and inquiry columns reconcile with the raw provider payloads (replay-tested).

### Honesty posture

Synthetic population, simulated providers, derived metrics — labelled as such at
every surface (`simulated: true`, `derived: true`). The model is an illustrative,
documented scorecard in the style banks and rating agencies use (SAMA ratios, bureau
behavior, PD/LGD/EAD/EL, staging, stress) — it is **not** a licensed SIMAH score and
not calibrated on real Saudi default outcomes. Where we *have* validated mechanics on
real data, it is the separate Berka/AlfaBattle evaluation work (`eval/ABLATION.md`).
