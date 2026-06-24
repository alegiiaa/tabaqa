"""[3b] Verify against Masdr + resolve income (the reveal).

Applies the 3-tier provenance model (PRD §6) and turns tagged inflows into an
income breakdown. ``masdr`` here is the mock ground-truth carried in the demo
fixture; in production it's the Masdr/Mofeed APIs (Payslip, Establishment, Akeed
IBAN). The honesty of the tiers is the credibility play — we never tag a P2P
transfer as Masdr-verified.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .clean import normalize
from .schema import (
    Transaction,
    DIRECTION_INFLOW,
    INCOME_TYPES,
    TYPE_SALARY,
    TYPE_GIG,
    TYPE_P2P,
    TYPE_INTERNAL,
    VERIFY_AMOUNT,
    VERIFY_SOURCE,
    VERIFY_INFERRED,
)


def verify_transactions(transactions: list[Transaction], masdr: dict) -> list[Transaction]:
    """Stamp each income inflow with its verification tier."""
    payslip = masdr.get("payslip", {})
    wage = payslip.get("monthly_wage")
    employer_iban = payslip.get("iban")
    establishments = {normalize(e) for e in masdr.get("establishments", [])}

    for t in transactions:
        if t.direction != DIRECTION_INFLOW or t.txn_type == TYPE_INTERNAL:
            continue

        salary_match = (
            wage is not None
            and employer_iban
            and t.counterparty_iban == employer_iban
            and abs(t.amount - wage) <= max(1.0, 0.05 * wage)
        )
        merchant_norm = normalize(t.merchant) if t.merchant else ""

        if t.txn_type == TYPE_SALARY or salary_match:
            t.txn_type = TYPE_SALARY
            if salary_match:
                t.verification, t.verified_via, t.confidence = VERIFY_AMOUNT, "masdr:payslip", 0.99
        elif t.txn_type == TYPE_GIG or merchant_norm in establishments:
            t.txn_type = TYPE_GIG
            t.verification, t.verified_via, t.confidence = VERIFY_SOURCE, "masdr:establishment", 0.90
        elif t.txn_type == TYPE_P2P:
            t.verification, t.verified_via, t.confidence = VERIFY_INFERRED, "none", 0.50

    return transactions


@dataclass
class IncomeComponent:
    label: str
    monthly_amount: float
    txn_type: str
    verification: str
    verified_via: str


@dataclass
class IncomeProfile:
    components: list[IncomeComponent] = field(default_factory=list)
    total_income: float = 0.0       # true monthly income (all sources)
    bank_only_income: float = 0.0   # what a bank-only view would see
    verified_income: float = 0.0    # amount- or source-verified portion
    verified_share: float = 0.0     # verified / total

    @property
    def reveal_delta(self) -> float:
        return self.total_income - self.bank_only_income


_LABELS = {
    TYPE_SALARY: "Salary — Masdr payslip",
    TYPE_GIG: "Gig — Jahez / HungerStation",
    TYPE_P2P: "P2P transfers (recurring)",
}


def resolve_income(transactions: list[Transaction]) -> IncomeProfile:
    """Aggregate verified inflows into a monthly income breakdown + the reveal."""
    months = {t.month for t in transactions} or {"_"}
    n_months = max(1, len(months))

    income_txns = [t for t in transactions if t.txn_type in INCOME_TYPES]
    if not income_txns:
        return IncomeProfile()

    profile = IncomeProfile()
    for ttype in (TYPE_SALARY, TYPE_GIG, TYPE_P2P):
        group = [t for t in income_txns if t.txn_type == ttype]
        if not group:
            continue
        monthly = sum(t.amount for t in group) / n_months
        # pick the strongest verification seen in the group
        verification = group[0].verification
        verified_via = group[0].verified_via
        for t in group:
            if t.verification == VERIFY_AMOUNT:
                verification, verified_via = t.verification, t.verified_via
                break
            if t.verification == VERIFY_SOURCE and verification != VERIFY_AMOUNT:
                verification, verified_via = t.verification, t.verified_via
        profile.components.append(
            IncomeComponent(_LABELS[ttype], round(monthly, 2), ttype, verification, verified_via)
        )

    profile.total_income = round(sum(c.monthly_amount for c in profile.components), 2)
    profile.bank_only_income = round(
        sum(t.amount for t in income_txns if t.is_bank) / n_months, 2
    )
    profile.verified_income = round(
        sum(c.monthly_amount for c in profile.components
            if c.verification in (VERIFY_AMOUNT, VERIFY_SOURCE)),
        2,
    )
    profile.verified_share = round(
        profile.verified_income / profile.total_income if profile.total_income else 0.0, 3
    )
    return profile
