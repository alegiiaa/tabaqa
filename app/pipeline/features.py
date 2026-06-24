"""[4] Cash-flow features — the 6 the score is built on.

  1. income regularity        4. NSF count
  2. income / expense ratio   5. recurring-obligation load
  3. min & avg balance        6. balance volatility

Pure-stdlib (``statistics``) so the demo runs with zero dependencies. In
production this is a pandas/numpy job over the lender's full AIS history.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime
from statistics import mean, pstdev

from .schema import (
    Transaction,
    DIRECTION_INFLOW,
    INCOME_TYPES,
    TYPE_INTERNAL,
    TYPE_OBLIGATION,
)
from .verify import IncomeProfile


@dataclass
class CashFlowFeatures:
    income_regularity: float        # 0..1 — higher = steadier inflows
    income_expense_ratio: float     # >1 means saving
    avg_balance: float
    min_balance: float
    nsf_count: int                  # times any account went negative
    recurring_obligation_load: float  # recurring debt / income
    balance_volatility: float       # coeff. of variation of balance
    months_observed: int
    verified_income_share: float    # carried through for the scorecard

    def to_dict(self) -> dict:
        return asdict(self)


def _parse(ts: str) -> datetime:
    try:
        return datetime.fromisoformat(ts)
    except ValueError:
        return datetime.fromisoformat(ts[:10])


def _running_balances(txns: list[Transaction], opening: float) -> list[float]:
    """Event-by-event balance series for one account, oldest → newest."""
    series: list[float] = []
    bal = opening
    for t in sorted(txns, key=lambda x: _parse(x.timestamp)):
        bal += t.amount if t.direction == DIRECTION_INFLOW else -t.amount
        series.append(round(bal, 2))
    return series or [opening]


def extract_features(
    transactions: list[Transaction],
    opening_balances: dict[str, float],
    income: IncomeProfile,
) -> CashFlowFeatures:
    months = sorted({t.month for t in transactions}) or ["_"]
    n_months = max(1, len(months))

    # ── monthly income / expense (internal movements excluded) ──
    def _month_sum(month: str, predicate) -> float:
        return sum(t.amount for t in transactions if t.month == month and predicate(t))

    is_income = lambda t: t.txn_type in INCOME_TYPES and t.direction == DIRECTION_INFLOW  # noqa: E731
    is_expense = lambda t: (  # noqa: E731
        t.direction != DIRECTION_INFLOW and t.txn_type != TYPE_INTERNAL
    )

    monthly_income = [_month_sum(m, is_income) for m in months]
    monthly_expense = [_month_sum(m, is_expense) for m in months]

    inc_mean = mean(monthly_income) if monthly_income else 0.0
    # regularity: low variation + present every month → near 1.0
    cv_income = (pstdev(monthly_income) / inc_mean) if inc_mean else 1.0
    coverage = sum(1 for v in monthly_income if v > 0) / n_months
    income_regularity = round(max(0.0, min(1.0, (1.0 - cv_income))) * coverage, 3)

    exp_mean = mean(monthly_expense) if monthly_expense else 0.0
    income_expense_ratio = round(inc_mean / exp_mean, 3) if exp_mean else float("inf")

    # ── balances per account ──
    by_source: dict[str, list[Transaction]] = {}
    for t in transactions:
        by_source.setdefault(t.source, []).append(t)

    nsf_count = 0
    bank_series: list[float] = []
    for source, txns in by_source.items():
        series = _running_balances(txns, opening_balances.get(source, 0.0))
        nsf_count += sum(1 for b in series if b < 0)
        if source.startswith("bank:"):
            bank_series = series
    if not bank_series:  # no bank account → fall back to everything combined
        bank_series = [b for txns in by_source.values()
                       for b in _running_balances(txns, 0.0)]

    avg_balance = round(mean(bank_series), 2)
    min_balance = round(min(bank_series), 2)
    bal_cv = (pstdev(bank_series) / avg_balance) if avg_balance else 0.0
    balance_volatility = round(abs(bal_cv), 3)

    # ── recurring obligations ──
    monthly_obligation = [
        _month_sum(m, lambda t: t.txn_type == TYPE_OBLIGATION) for m in months
    ]
    obl_mean = mean(monthly_obligation) if monthly_obligation else 0.0
    recurring_obligation_load = round(obl_mean / inc_mean, 3) if inc_mean else 0.0

    return CashFlowFeatures(
        income_regularity=income_regularity,
        income_expense_ratio=income_expense_ratio,
        avg_balance=avg_balance,
        min_balance=min_balance,
        nsf_count=nsf_count,
        recurring_obligation_load=recurring_obligation_load,
        balance_volatility=balance_volatility,
        months_observed=n_months,
        verified_income_share=income.verified_share,
    )
