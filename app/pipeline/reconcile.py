"""[3a] Reconcile bank ↔ wallet transfers.

The core anti-double-count trick: a bank→Barq transfer is money *moved*, not
*spent*, and the gig pay landing in Barq is *real income* — but the two legs must
be matched so the transfer itself is never counted as either income or expense.

Deterministic match on (amount, opposite direction, time window).
"""
from __future__ import annotations

from datetime import datetime

from .clean import normalize
from .schema import Transaction, DIRECTION_OUTFLOW, DIRECTION_INFLOW, TYPE_INTERNAL

# transfer-intent keywords that make a leg eligible for internal matching
_TRANSFER_KW = ("برق", "barq", "stc pay", "stcpay", "urpay", "محفظه", "wallet", "تحويل")

_MATCH_WINDOW_DAYS = 3
_AMOUNT_TOLERANCE = 0.01  # SAR


def _parse(ts: str) -> datetime:
    # accept date-only or full ISO timestamps
    try:
        return datetime.fromisoformat(ts)
    except ValueError:
        return datetime.fromisoformat(ts[:10])


def _looks_like_transfer(t: Transaction) -> bool:
    return any(k in normalize(t.raw_desc) for k in _TRANSFER_KW)


def reconcile(transactions: list[Transaction]) -> list[Transaction]:
    """Tag matched cross-account transfer legs as ``internal_movement``.

    Mutates and returns the same list. A leg already tagged internal is skipped,
    so each transfer is matched at most once.
    """
    bank_out = [
        t for t in transactions
        if t.is_bank and t.direction == DIRECTION_OUTFLOW and _looks_like_transfer(t)
    ]
    wallet_in = [
        t for t in transactions
        if t.is_wallet and t.direction == DIRECTION_INFLOW and _looks_like_transfer(t)
    ]

    used: set[str] = set()
    for out_leg in bank_out:
        for in_leg in wallet_in:
            if in_leg.id in used:
                continue
            if abs(out_leg.amount - in_leg.amount) > _AMOUNT_TOLERANCE:
                continue
            if abs((_parse(out_leg.timestamp) - _parse(in_leg.timestamp)).days) > _MATCH_WINDOW_DAYS:
                continue
            # matched pair → mark both as internal movement
            for leg in (out_leg, in_leg):
                leg.txn_type = TYPE_INTERNAL
                leg.category = "internal_movement"
                leg.confidence = 0.95
            used.add(in_leg.id)
            break

    return transactions
