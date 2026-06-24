"""Orchestrator — ingest a fixture/feed through the full pipeline.

    raw feeds → clean → enrich → reconcile → verify → resolve income → features

Returns a ``ProfileResult`` that the scoring layer and the dashboard both read.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .schema import Transaction
from .enrich import enrich_all
from .reconcile import reconcile
from .verify import verify_transactions, resolve_income, IncomeProfile
from .features import extract_features, CashFlowFeatures


@dataclass
class ProfileResult:
    applicant: dict
    transactions: list[Transaction]
    income: IncomeProfile
    features: CashFlowFeatures
    opening_balances: dict[str, float] = field(default_factory=dict)


def run_pipeline(fixture: dict) -> ProfileResult:
    """Run a canonical fixture (see data/synthetic/fahd.json) end-to-end.

    ``fixture`` shape: {applicant, accounts[], masdr{}, transactions[]}.
    """
    txns = [Transaction.from_dict(raw) for raw in fixture.get("transactions", [])]

    # [1]+[2] clean is invoked inside enrich (normalize); enrich labels merchant/category
    enrich_all(txns)
    # [3a] reconcile cross-account transfers (no double-count)
    reconcile(txns)
    # [3b] verify against Masdr ground-truth (3-tier provenance)
    verify_transactions(txns, fixture.get("masdr", {}))
    # [4a] resolve the income breakdown (the reveal)
    income = resolve_income(txns)

    opening = {
        a["source"]: float(a.get("opening_balance", 0.0))
        for a in fixture.get("accounts", [])
    }
    # [4b] the six cash-flow features
    features = extract_features(txns, opening, income)

    return ProfileResult(
        applicant=fixture.get("applicant", {}),
        transactions=txns,
        income=income,
        features=features,
        opening_balances=opening,
    )
