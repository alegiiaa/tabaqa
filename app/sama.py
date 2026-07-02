"""SAMA Responsible-Lending caps — the regulator-grounded DBR policy.

Source: Saudi Central Bank (SAMA), *Responsible Lending Principles for Individual
Customers*, Circular No. 46538/99 (02/09/1439H ≈ 17/05/2018), Chapter IV —
Quantitative Principles. https://rulebook.sama.gov.sa/en/chapter-iv-quantitative-principles-responsible-lending

Two distinct limits apply to a salaried individual taking installment finance:

  1. **Salary-deduction (installment) cap** — total monthly installment deductions
     must not exceed **33.33% of GROSS salary** for employees, or **25% of pension**
     for retirees. This is the binding constraint for personal/auto financing.
  2. **Total monthly-obligations cap (DBR)** — all monthly credit obligations
     (excluding real-estate finance) must not exceed **45% of total monthly income**;
     raised to **55%** for income ≤ SAR 15,000/mo and **65%** for income in the
     SAR 15,000–25,000 band or for Ministry-of-Housing / REDF mortgage beneficiaries.

The demo applies the **binding installment cap** (33.33% employees / 25% retirees)
as the affordability `dbr_cap`, and reports the total-obligations ceiling alongside
it. `dbr_cap` therefore defaults to 0.3333 — identical to the prior hard-coded value,
so existing numbers are unchanged; only now it is named, cited, and switchable.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

# Binding installment / salary-deduction caps (fraction of gross income).
CAP_SALARY_DEDUCTION_EMPLOYEE = 0.3333  # 33.33% of gross salary
CAP_SALARY_DEDUCTION_RETIREE = 0.25     # 25% of pension

# Total monthly-obligations (DBR) ceilings by segment.
CAP_TOTAL_OBLIGATIONS_DEFAULT = 0.45    # non-real-estate obligations
CAP_TOTAL_OBLIGATIONS_LOW_INCOME = 0.55  # total monthly income ≤ SAR 15,000
CAP_TOTAL_OBLIGATIONS_MID_OR_REDF = 0.65  # SAR 15,000–25,000, or REDF/MoH mortgage

_CITATION = (
    "SAMA Responsible Lending Principles for Individuals, Circular 46538/99, "
    "Chapter IV (Quantitative Principles)"
)


@dataclass
class DbrPolicy:
    cap: float               # the binding installment cap used by the calculator
    code: str                # machine code, e.g. "sama_salary_deduction_employee"
    label: str               # human label
    total_obligations_ceiling: float  # the informational total-DBR ceiling for the segment
    citation: str = _CITATION

    def to_dict(self) -> dict:
        return asdict(self)


def total_obligations_ceiling(monthly_income: float | None, redf_beneficiary: bool) -> float:
    """The applicable total monthly-obligations (DBR) ceiling for this segment."""
    if redf_beneficiary:
        return CAP_TOTAL_OBLIGATIONS_MID_OR_REDF
    if monthly_income is not None:
        if monthly_income <= 15_000:
            return CAP_TOTAL_OBLIGATIONS_LOW_INCOME
        if monthly_income <= 25_000:
            return CAP_TOTAL_OBLIGATIONS_MID_OR_REDF
    return CAP_TOTAL_OBLIGATIONS_DEFAULT


def resolve_policy(
    customer_type: str = "employee",
    monthly_income: float | None = None,
    redf_beneficiary: bool = False,
) -> DbrPolicy:
    """Pick the binding SAMA installment cap + the segment's total-DBR ceiling.

    ``customer_type`` ∈ {"employee", "retiree"}. Defaults reproduce the demo's
    33.33% employee cap.
    """
    if customer_type == "retiree":
        cap, code, label = (
            CAP_SALARY_DEDUCTION_RETIREE,
            "sama_salary_deduction_retiree",
            "SAMA salary-deduction cap — retirees (25% of pension)",
        )
    else:
        cap, code, label = (
            CAP_SALARY_DEDUCTION_EMPLOYEE,
            "sama_salary_deduction_employee",
            "SAMA salary-deduction cap — employees (33.33% of gross salary)",
        )
    return DbrPolicy(
        cap=cap,
        code=code,
        label=label,
        total_obligations_ceiling=total_obligations_ceiling(monthly_income, redf_beneficiary),
    )
