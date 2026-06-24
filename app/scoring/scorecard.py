"""[5] Score → 1–99 PD + reason codes.

A transparent, additive points model — the same shape ``optbinning.Scorecard``
produces (binned features → points → score), kept dependency-free so the demo
runs anywhere. Every point of the score is attributable to a feature bin, which
is exactly what a SAMA-minded reviewer wants: no black box.

To swap in the trained model, replace ``score_profile`` with a call to a
persisted ``optbinning.Scorecard`` (see scoring/train.py) — the I/O contract
(features in, ScoreResult out) stays identical.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict

from pipeline.features import CashFlowFeatures
from pipeline.verify import IncomeProfile

BASE_POINTS = 20


@dataclass
class ReasonCode:
    code: str       # machine-readable, e.g. "regular_income"
    label: str      # plain-language explanation
    points: int     # signed contribution to the score
    polarity: str   # "positive" | "negative"


@dataclass
class ScoreResult:
    tabaqa_score: int                       # 1–99 (higher = lower risk)
    pd: float                               # probability of default
    risk_flag: str                          # low | medium | high
    reasons: list[str]                      # top machine codes (API headline)
    reason_codes: list[ReasonCode] = field(default_factory=list)
    base_points: int = BASE_POINTS

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


def _bin(value, bins):
    """Return (points, code, label) for the first matching (threshold, ...) bin.

    ``bins`` is a list of (predicate, points, code, label); first match wins.
    """
    for predicate, points, code, label in bins:
        if predicate(value):
            return points, code, label
    return 0, "", ""


def score_profile(features: CashFlowFeatures, income: IncomeProfile | None = None) -> ScoreResult:
    """Map the six cash-flow features to a 1–99 score + reason codes."""
    f = features
    ratio = f.income_expense_ratio
    if ratio == float("inf"):
        ratio = 99.0  # no expenses observed → treat as very healthy

    contributions: list[ReasonCode] = []

    def add(points, code, label):
        if points != 0:
            contributions.append(
                ReasonCode(code, label, points, "positive" if points > 0 else "negative")
            )

    # 1 — income regularity
    p, c, l = _bin(f.income_regularity, [
        (lambda v: v >= 0.8, 18, "regular_income", "Income arrives on a regular monthly schedule"),
        (lambda v: v >= 0.6, 12, "regular_income", "Income is mostly regular"),
        (lambda v: v >= 0.4, 6, "irregular_income", "Income is somewhat irregular"),
        (lambda v: True, -6, "irregular_income", "Income is irregular / sporadic"),
    ])
    add(p, c, l)

    # 2 — verified income share (the wallet reveal, Masdr-backed)
    p, c, l = _bin(f.verified_income_share, [
        (lambda v: v >= 0.7, 14, "wallet_income_verified", "Most income is Masdr-verified (amount or source)"),
        (lambda v: v >= 0.4, 8, "wallet_income_verified", "A meaningful share of income is verified"),
        (lambda v: True, 0, "", ""),
    ])
    add(p, c, l)

    # 3 — NSF / overdraft events
    p, c, l = _bin(f.nsf_count, [
        (lambda v: v == 0, 12, "zero_nsf", "No NSF or overdraft events observed"),
        (lambda v: v <= 2, 3, "some_nsf", "Few NSF / overdraft events"),
        (lambda v: True, -12, "frequent_nsf", "Frequent NSF / overdraft events"),
    ])
    add(p, c, l)

    # 4 — income / expense ratio
    p, c, l = _bin(ratio, [
        (lambda v: v >= 1.4, 8, "healthy_cashflow", "Spends well under income"),
        (lambda v: v >= 1.15, 5, "healthy_cashflow", "Spends under income"),
        (lambda v: v >= 1.0, 1, "tight_cashflow", "Income roughly equals spend"),
        (lambda v: True, -8, "negative_cashflow", "Spends more than income"),
    ])
    add(p, c, l)

    # 5 — minimum balance buffer
    p, c, l = _bin(f.min_balance, [
        (lambda v: v >= 1000, 6, "positive_buffer", "Maintains a healthy minimum balance"),
        (lambda v: v >= 0, 2, "thin_buffer", "Thin minimum-balance buffer"),
        (lambda v: True, -8, "negative_buffer", "Balance goes negative"),
    ])
    add(p, c, l)

    # 6 — balance volatility (coefficient of variation)
    p, c, l = _bin(f.balance_volatility, [
        (lambda v: v <= 0.4, 4, "stable_balance", "Stable account balance"),
        (lambda v: v <= 0.8, 1, "moderate_volatility", "Moderately volatile balance"),
        (lambda v: True, -4, "volatile_balance", "Highly volatile balance"),
    ])
    add(p, c, l)

    # recurring-obligation load (modifier — already one of the six signals)
    p, c, l = _bin(f.recurring_obligation_load, [
        (lambda v: v <= 0.3, 0, "low_debt_load", "Light recurring-debt load"),
        (lambda v: v <= 0.5, -5, "elevated_debt_load", "Elevated recurring-debt load"),
        (lambda v: True, -12, "high_debt_load", "High recurring-debt load"),
    ])
    add(p, c, l)

    raw = BASE_POINTS + sum(rc.points for rc in contributions)
    score = max(1, min(99, round(raw)))

    pd = max(0.002, min(0.99, round(1.39 * (1 - score / 99) ** 2, 3)))
    risk_flag = "low" if pd < 0.06 else "medium" if pd < 0.15 else "high"

    # headline reasons = strongest contributors (by absolute points)
    ranked = sorted(contributions, key=lambda rc: abs(rc.points), reverse=True)
    reasons = [rc.code for rc in ranked if rc.code][:3]

    return ScoreResult(
        tabaqa_score=score,
        pd=pd,
        risk_flag=risk_flag,
        reasons=reasons,
        reason_codes=ranked,
    )
