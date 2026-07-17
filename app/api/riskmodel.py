"""Tabaqa risk-analytics layer — the DERIVED metrics over a person's facts.

Pure functions, stdlib only, deterministic: facts in → underwriting/risk metrics
out. No I/O, no randomness — every stochastic *fact* (delinquency depth, file
age, card utilization) is drawn upstream by the cohort generator; this module
only computes. That separation is what makes the columns auditable: same facts,
same numbers, every run. Formula-by-formula documentation: app/DATA_DICTIONARY.md.

The metric set mirrors what real underwriters and rating models actually use:

- **Saudi bank practice** — SAMA Responsible Lending ratios (installment cap
  33.33% of gross salary for employees; segment total-obligation ceilings
  45/55/65%), salary-transfer verification, employer-category tiers, service
  years, end-of-service benefit as a severity buffer (Labor Law Art. 84).
  Caps mirror app/sama.py (Circular 46538/99, Ch. IV) — keep the two in sync.
- **Bureau mechanics (SIMAH-style)** — a 300–900 behavioral score, worst
  delinquency in 24 months, inquiry intensity, file thickness, credit mix,
  revolving utilization.
- **Moody's-Analytics-style portfolio math** — 12-month PD (EDF-like),
  downturn LGD, EAD with a 50% CCF on undrawn revolving lines (Basel), the
  expected-loss identity EL = PD x LGD x EAD, a 10-notch internal masterscale
  banded on PD, IFRS 9 staging, and a +200bps rate-shock stress test computed
  from the actual annuity repricing, not a guessed haircut.

Everything is synthetic and labelled so upstream; these are model OUTPUTS over
test data — not advice, not a licensed scorecard.
"""
from __future__ import annotations

MODEL_VERSION = "tabaqa-risk-1.0"

# ── SAMA Responsible Lending (mirror of app/sama.py — Circular 46538/99) ─────
SAMA_INSTALLMENT_CAP_EMPLOYEE = 0.3333   # of gross salary
SAMA_TOTAL_DBR_DEFAULT = 0.45            # income > SAR 25k
SAMA_TOTAL_DBR_LOW_INCOME = 0.55         # income ≤ SAR 15k
SAMA_TOTAL_DBR_MID = 0.65                # SAR 15–25k (or REDF beneficiary)

# ── essential-expense floor (GASTAT HICES 2023-anchored approximation) ───────
# Median Saudi household disposable income 2023 = SAR 13,655/mo (HICES);
# the floor below is a per-head essentials proxy used ONLY for residual-income
# analysis — never as a risk-score feature on its own.
ESSENTIALS_BASE = 2_600          # single adult, ex-rent
ESSENTIALS_PER_DEPENDENT = 750

# ── credit model constants ───────────────────────────────────────────────────
PD_BASE = {"A": 0.006, "B": 0.014, "C": 0.032, "D": 0.075, "E": 0.240}
SCORE_BASE = {"A": 812, "B": 748, "C": 672, "D": 588, "E": 452}
LGD_BASE_UNSECURED = 0.62        # downturn LGD, unsecured consumer
LGD_FLOOR, LGD_CAP = 0.32, 0.68
CCF_UNDRAWN_REVOLVING = 0.50     # Basel credit-conversion factor
STRESS_PD_MULTIPLIER = 1.35      # mild-recession scenario scalar
PRICING_APR, PRICING_TENOR_M = 0.07, 48   # reference annuity for capacity math

# Internal masterscale — 10 notches banded on 12m PD (EDF-style bands).
MASTERSCALE = [
    ("R1", 0.0025), ("R2", 0.005), ("R3", 0.010), ("R4", 0.020), ("R5", 0.040),
    ("R6", 0.080), ("R7", 0.160), ("R8", 0.300), ("R9", 0.600), ("R10", 1.0),
]


def annuity_payment(principal: float, apr: float, months: int) -> float:
    """Standard annuity installment for a principal at a nominal APR."""
    r = apr / 12
    return principal * r / (1 - (1 + r) ** -months)


def max_principal(installment: float, apr: float, months: int) -> float:
    """Inverse annuity — the largest principal a monthly installment services."""
    r = apr / 12
    return installment * (1 - (1 + r) ** -months) / r


def sama_total_dbr_ceiling(total_income: float) -> float:
    """Segment total monthly-obligations ceiling (mirrors app/sama.py)."""
    if total_income <= 15_000:
        return SAMA_TOTAL_DBR_LOW_INCOME
    if total_income <= 25_000:
        return SAMA_TOTAL_DBR_MID
    return SAMA_TOTAL_DBR_DEFAULT


def eos_benefit(salary: float, service_years: float) -> float:
    """End-of-service award — Saudi Labor Law Art. 84:
    half a month's wage per year for the first five years, a full month per
    year beyond. A severity buffer banks treat as recoverable on default."""
    return salary * (0.5 * min(service_years, 5) + max(0.0, service_years - 5))


def rating_of(pd: float) -> str:
    for label, ceiling in MASTERSCALE:
        if pd <= ceiling:
            return label
    return "R10"


def advanced_metrics(f: dict) -> dict:
    """The full derived block for one person.

    Expected fact keys (all pre-drawn/derived upstream):
      salary, side_income, service_years, sector ('حكومي'|'خاص'), dependents,
      obligations [{type, monthly_payment, outstanding, remaining_months}],
      total_obl, delinquent (bool), grade (A–E), age, portfolio_value,
      property_value, rent_monthly, recent_inquiries, credit_history_months,
      worst_delinquency (0|30|60|90), card_utilization (float|None)
    """
    salary = float(f["salary"])
    side = float(f.get("side_income", 0))
    total_income = salary + side
    obligations = f.get("obligations", [])
    total_obl = float(f.get("total_obl", sum(o["monthly_payment"] for o in obligations)))
    outstanding = float(sum(o["outstanding"] for o in obligations))
    grade = str(f["grade"])
    gov = str(f.get("sector", "")) == "حكومي"
    service = float(f.get("service_years", 0))
    dependents = int(f.get("dependents", 0))
    portfolio = float(f.get("portfolio_value", 0))
    property_v = float(f.get("property_value", 0))
    rent = float(f.get("rent_monthly", 0))
    inquiries = int(f.get("recent_inquiries", 0))
    history_m = int(f.get("credit_history_months", 24))
    worst = int(f.get("worst_delinquency", 0))
    util = f.get("card_utilization")

    # ── affordability (SAMA discipline) ──────────────────────────────────────
    # The engine's income rule: verified salary + 50% of stable side income.
    eligible_income = salary + 0.5 * side
    dbr = total_obl / salary if salary else 1.0
    headroom = max(0.0, SAMA_INSTALLMENT_CAP_EMPLOYEE * salary - total_obl)
    ceiling = sama_total_dbr_ceiling(total_income)
    within_ceiling = (total_obl / total_income if total_income else 1.0) <= ceiling
    max_financing = max_principal(headroom, PRICING_APR, PRICING_TENOR_M) if headroom else 0.0

    essentials = ESSENTIALS_BASE + ESSENTIALS_PER_DEPENDENT * dependents + rent
    residual = total_income - total_obl - essentials
    residual_ratio = residual / total_income if total_income else 0.0

    # ── wealth & buffers ─────────────────────────────────────────────────────
    eos = eos_benefit(salary, service)
    net_worth = portfolio + property_v + eos - outstanding
    coverage = (portfolio + property_v) / outstanding if outstanding else None
    liquidity_months = (0.9 * portfolio) / essentials if essentials else 0.0

    # ── bureau block (SIMAH-style) ───────────────────────────────────────────
    kinds = {o["type"] for o in obligations}
    has_card = int(any("بطاقة" in k for k in kinds))
    has_bnpl = int(any("BNPL" in k or "آجلة" in k for k in kinds))
    thin_file = int(history_m < 24)

    score = SCORE_BASE.get(grade, 600)
    if worst >= 60:
        score -= 38
    elif worst == 30:
        score -= 18
    if inquiries >= 3:
        score -= 22
    elif inquiries == 2:
        score -= 8
    if dbr > 0.45:
        score -= 24
    elif dbr > SAMA_INSTALLMENT_CAP_EMPLOYEE:
        score -= 10
    if service >= 5:
        score += 14
    if coverage is not None and coverage >= 1:
        score += 10
    if thin_file:
        score -= 16
    if gov:
        score += 8
    score = int(max(300, min(900, score)))

    # ── PD / LGD / EAD / EL (Basel-style expected-loss identity) ─────────────
    pd = PD_BASE.get(grade, 0.05)
    if worst == 30:
        pd *= 1.25
    elif worst >= 60:
        pd *= 1.60
    if dbr > 0.5:
        pd *= 1.45
    elif dbr > SAMA_INSTALLMENT_CAP_EMPLOYEE:
        pd *= 1.18
    if inquiries >= 3:
        pd *= 1.12
    if thin_file:
        pd *= 1.22
    if service >= 5:
        pd *= 0.88
    if coverage is not None and coverage >= 1:
        pd *= 0.90
    if residual < 0:
        pd *= 1.50
    if gov:
        pd *= 0.93
    pd = round(max(0.0015, min(0.60, pd)), 4)

    lgd = LGD_BASE_UNSECURED
    if coverage is not None:
        lgd -= 0.16 * min(coverage, 1.0)
    if gov:
        lgd -= 0.04  # salary-assignment recovery channel
    lgd = round(max(LGD_FLOOR, min(LGD_CAP, lgd)), 3)

    ead = outstanding
    card_outstanding = sum(o["outstanding"] for o in obligations if "بطاقة" in o["type"])
    if util and card_outstanding:
        limit = card_outstanding / util
        ead += CCF_UNDRAWN_REVOLVING * max(0.0, limit - card_outstanding)
    ead = round(ead)
    el = round(pd * lgd * ead)
    el_bps = round(10_000 * el / ead) if ead else 0

    # IFRS 9: stage 3 = credit-impaired; stage 2 = significant increase in
    # credit risk (payment deterioration, a distress combination, or the
    # absolute-PD backstop banks commonly add). Inquiry intensity feeds PD,
    # not staging — soft searches alone are not SICR.
    stage = 3 if f.get("delinquent") else (
        2 if worst >= 30 or (dbr > 0.5 and residual < 0) or pd >= 0.08 else 1)
    segment_ar = ("متعثرة — معالجة خاصة" if stage == 3
                  else "مرتفعة" if pd >= 0.08
                  else "متوسطة" if pd >= 0.025 else "منخفضة")

    # ── stress test: +200bps repriced through the actual annuity ─────────────
    uplift = (annuity_payment(1, PRICING_APR + 0.02, PRICING_TENOR_M)
              / annuity_payment(1, PRICING_APR, PRICING_TENOR_M))
    stress_dbr = round(dbr * uplift, 4)
    stress_ok = int(stress_dbr <= SAMA_INSTALLMENT_CAP_EMPLOYEE)
    stressed_pd = round(min(0.75, pd * STRESS_PD_MULTIPLIER), 4)

    return {
        # affordability
        "eligible_income_sar": round(eligible_income),
        "dbr": round(dbr, 4),
        "installment_headroom_sar": round(headroom),
        "sama_total_dbr_ceiling": ceiling,
        "within_sama_ceiling": int(within_ceiling),
        "max_financing_48m_sar": int(max_financing // 500 * 500),
        "essential_expenses_sar": round(essentials),
        "residual_income_sar": round(residual),
        "residual_income_ratio": round(residual_ratio, 4),
        # wealth & buffers
        "eos_benefit_sar": round(eos),
        "net_worth_proxy_sar": round(net_worth),
        "asset_coverage_ratio": round(coverage, 3) if coverage is not None else None,
        "liquidity_buffer_months": round(liquidity_months, 1),
        # bureau
        "total_outstanding_sar": round(outstanding),
        "credit_mix_count": len(kinds),
        "has_credit_card": has_card,
        "has_bnpl": has_bnpl,
        "card_utilization": round(util, 2) if util else None,
        "worst_delinquency_24m": worst,
        "credit_history_months": history_m,
        "thin_file": thin_file,
        "recent_inquiries_6m": inquiries,
        "bureau_score_sim": score,
        # model outputs
        "pd_12m": pd,
        "lgd": lgd,
        "ead_sar": ead,
        "expected_loss_sar": el,
        "el_bps": el_bps,
        "internal_rating": rating_of(pd),
        "ifrs9_stage": stage,
        "risk_segment_ar": segment_ar,
        # stress
        "stress_dbr_200bps": stress_dbr,
        "stress_within_cap": stress_ok,
        "stressed_pd_12m": stressed_pd,
        # meta
        "income_verified_share": round(salary / total_income, 4) if total_income else 1.0,
        "salary_months_observed": 6,
        "model_version": MODEL_VERSION,
    }
