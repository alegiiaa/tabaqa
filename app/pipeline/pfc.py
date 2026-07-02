"""Map Tabaqa's internal labels onto the Plaid Personal Finance Category taxonomy.

Adopting an industry-standard taxonomy (instead of a bespoke category list) makes
the enrichment output portable and credible: any lender already speaks PFC, and the
two-level primary→detailed tree + a confidence band is exactly the shape Plaid/Tink/
Salt Edge emit. We keep our own granular `category` (it drives merchant logos), and
*additionally* stamp each transaction with `pfc_primary` / `pfc_detailed`.

Taxonomy reference (free, public CSV):
  https://plaid.com/documents/transactions-personal-finance-category-taxonomy.csv
"""
from __future__ import annotations

from typing import Optional, Tuple

from .schema import (
    Transaction,
    DIRECTION_INFLOW,
    TYPE_SALARY,
    TYPE_GIG,
    TYPE_P2P,
    TYPE_INTERNAL,
    TYPE_OBLIGATION,
)

# internal category → (PFC primary, PFC detailed) for spend transactions
_CATEGORY_PFC = {
    "grocery": ("FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES"),
    "coffee": ("FOOD_AND_DRINK", "FOOD_AND_DRINK_COFFEE"),
    "restaurant": ("FOOD_AND_DRINK", "FOOD_AND_DRINK_RESTAURANT"),
    "fuel": ("TRANSPORTATION", "TRANSPORTATION_GAS"),
    "telecom": ("RENT_AND_UTILITIES", "RENT_AND_UTILITIES_TELEPHONE"),
    "ecommerce": ("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES"),
    "electronics": ("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_ELECTRONICS"),
    "retail": ("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_OTHER"),
    "wallet": ("TRANSFER_OUT", "TRANSFER_OUT_ACCOUNT_TRANSFER"),
}

# txn_type → (PFC primary, PFC detailed); transfers resolve by direction below
_TYPE_PFC = {
    TYPE_SALARY: ("INCOME", "INCOME_WAGES"),
    TYPE_GIG: ("INCOME", "INCOME_OTHER_INCOME"),
    TYPE_P2P: ("TRANSFER_IN", "TRANSFER_IN_OTHER_TRANSFER_IN"),
    TYPE_OBLIGATION: ("LOAN_PAYMENTS", "LOAN_PAYMENTS_OTHER_PAYMENT"),
}


def confidence_level(confidence: float) -> str:
    """PFC-style confidence band — the 'needs review' routing signal."""
    if confidence >= 0.95:
        return "VERY_HIGH"
    if confidence >= 0.80:
        return "HIGH"
    if confidence >= 0.55:
        return "MEDIUM"
    return "LOW"


def to_pfc(txn: Transaction) -> Tuple[Optional[str], Optional[str]]:
    """Resolve (pfc_primary, pfc_detailed) for one classified transaction."""
    if txn.txn_type == TYPE_INTERNAL:
        return (("TRANSFER_IN", "TRANSFER_IN_ACCOUNT_TRANSFER")
                if txn.direction == DIRECTION_INFLOW
                else ("TRANSFER_OUT", "TRANSFER_OUT_ACCOUNT_TRANSFER"))
    if txn.txn_type in _TYPE_PFC:
        return _TYPE_PFC[txn.txn_type]
    # purchases / everything else → resolve by merchant category
    if txn.category in _CATEGORY_PFC:
        return _CATEGORY_PFC[txn.category]
    if txn.direction != DIRECTION_INFLOW:
        return ("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_OTHER")
    return (None, None)  # unknown inflow — don't guess


def apply_pfc(transactions: list[Transaction]) -> list[Transaction]:
    """Stamp pfc_primary / pfc_detailed on every transaction (after classification)."""
    for t in transactions:
        t.pfc_primary, t.pfc_detailed = to_pfc(t)
    return transactions
