"""Service ② — Affordability (README §8.8).

Pure-stdlib annuity → installment → DBR → APPROVE / REVIEW / DECLINE. The decisive
input is **verified_income** (the reveal from Service ①), not bank-only income —
that gap is the value Tabaqa unlocks.

    i   = annual_rate / 12
    AF  = ((1+i)^n - 1) / (i*(1+i)^n)            # i = 0  -> AF = n
    installment      = amount / AF
    DBR_before       = existing_obligations / verified_income
    DBR_after        = (existing_obligations + installment) / verified_income
    max_installment  = dbr_cap * verified_income - existing_obligations
    max_financing    = max(0, max_installment) * AF

    decision = APPROVE   if DBR_after <= dbr_cap and risk = low (and not marginal)
               REVIEW    if marginal (near the cap) or Tabaqa risk = medium
               DECLINE   if DBR_after > dbr_cap or risk = high

The DBR cap is a per-lender policy knob (demo uses 33%).
"""
from __future__ import annotations

from dataclasses import dataclass, field

DECISION_APPROVE = "APPROVE"
DECISION_REVIEW = "REVIEW"
DECISION_DECLINE = "DECLINE"


@dataclass
class AffordabilityResult:
    installment: float
    dbr_before: float
    dbr_after: float
    dbr_cap: float
    max_installment: float
    max_financing: float
    decision: str                      # APPROVE | REVIEW | DECLINE
    annuity_factor: float
    pd: float | None = None
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        from dataclasses import asdict
        return asdict(self)


def annuity_factor(i: float, n: int) -> float:
    """Present-value annuity factor. i is the *monthly* rate; i=0 → n."""
    n = max(1, int(n))
    if i == 0:
        return float(n)
    return ((1 + i) ** n - 1) / (i * (1 + i) ** n)


def affordability(
    amount: float,
    tenor_months: int,
    annual_rate: float,
    verified_income: float,
    existing_obligations: float = 0.0,
    dbr_cap: float = 0.3333,
    risk_flag: str | None = None,
    pd: float | None = None,
    review_margin: float = 0.03,
) -> AffordabilityResult:
    """Compute the installment, DBR before/after, headroom and a decision.

    ``risk_flag`` is the Tabaqa risk band ("low"|"medium"|"high") from the score;
    when omitted the decision is driven by DBR alone.
    """
    i = annual_rate / 12.0
    af = annuity_factor(i, tenor_months)

    installment = amount / af if af else 0.0

    if verified_income > 0:
        dbr_before = existing_obligations / verified_income
        dbr_after = (existing_obligations + installment) / verified_income
    else:
        dbr_before = float("inf")
        dbr_after = float("inf")

    max_installment = dbr_cap * verified_income - existing_obligations
    max_financing = max(0.0, max_installment) * af

    decision, reasons = _decide(dbr_after, dbr_cap, risk_flag, review_margin, dbr_before, installment)

    return AffordabilityResult(
        installment=round(installment, 2),
        dbr_before=round(dbr_before, 4) if dbr_before != float("inf") else dbr_before,
        dbr_after=round(dbr_after, 4) if dbr_after != float("inf") else dbr_after,
        dbr_cap=dbr_cap,
        max_installment=round(max_installment, 2),
        max_financing=round(max_financing, 2),
        decision=decision,
        annuity_factor=round(af, 4),
        pd=pd,
        reasons=reasons,
    )


def _decide(
    dbr_after: float,
    dbr_cap: float,
    risk_flag: str | None,
    review_margin: float,
    dbr_before: float,
    installment: float,
) -> tuple[str, list[str]]:
    reasons: list[str] = []
    pct = lambda x: "n/a" if x == float("inf") else f"{x * 100:.1f}%"  # noqa: E731

    if dbr_after > dbr_cap or risk_flag == "high":
        if dbr_after > dbr_cap:
            reasons.append(f"DBR after financing {pct(dbr_after)} exceeds the {pct(dbr_cap)} cap")
        if risk_flag == "high":
            reasons.append("Tabaqa risk is high")
        return DECISION_DECLINE, reasons

    if risk_flag == "medium":
        reasons.append(f"DBR after financing {pct(dbr_after)} is within cap, but Tabaqa risk is medium")
        return DECISION_REVIEW, reasons

    if dbr_after > dbr_cap - review_margin:
        reasons.append(f"DBR after financing {pct(dbr_after)} is close to the {pct(dbr_cap)} cap")
        return DECISION_REVIEW, reasons

    reasons.append(f"DBR after financing {pct(dbr_after)} is comfortably within the {pct(dbr_cap)} cap")
    if risk_flag == "low":
        reasons.append("Tabaqa risk is low")
    return DECISION_APPROVE, reasons


if __name__ == "__main__":  # quick self-check against README §9 worked numbers
    verified = affordability(60_000, 48, 0.10, 10_000, existing_obligations=800)
    bank_only = affordability(60_000, 48, 0.10, 4_000, existing_obligations=800)
    print("AF:", verified.annuity_factor, "installment:", verified.installment)
    print("verified 10k →", verified.decision, "DBR_after", verified.dbr_after)
    print("bank-only 4k →", bank_only.decision, "DBR_after", bank_only.dbr_after)
    assert abs(verified.annuity_factor - 39.4282) < 0.01
    assert abs(verified.installment - 1521.7) < 1.0
    assert verified.decision == DECISION_APPROVE
    assert bank_only.decision == DECISION_DECLINE
    print("OK")
