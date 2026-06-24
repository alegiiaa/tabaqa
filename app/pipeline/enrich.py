"""[2] Enrich → merchant + category.

Rule-based resolver for the known ~80% (gig platforms, Saudi acquirers, transfer
and salary keywords). In production this sits in front of banking-class /
AraBERT embeddings for the long-tail; here the rules are enough to run the demo.
"""
from __future__ import annotations

from .clean import normalize
from .schema import (
    Transaction,
    DIRECTION_INFLOW,
    TYPE_GIG,
    TYPE_OBLIGATION,
    TYPE_PURCHASE,
    TYPE_SALARY,
    TYPE_P2P,
)

# merchant token → (canonical merchant, category)
_MERCHANTS = {
    "jahez": ("Jahez", "gig_platform"),
    "جاهز": ("Jahez", "gig_platform"),
    "hungerstation": ("HungerStation", "gig_platform"),
    "هنقرستيشن": ("HungerStation", "gig_platform"),
    "mrsool": ("Mrsool", "gig_platform"),
    "uber": ("Uber", "gig_platform"),
    "kareem": ("Careem", "gig_platform"),
    "careem": ("Careem", "gig_platform"),
    "بنده": ("Panda", "grocery"),
    "panda": ("Panda", "grocery"),
    "tamimi": ("Tamimi", "grocery"),
    "stc": ("STC", "telecom"),
}

# keyword → txn_type hint (applied to the normalized string)
_SALARY_KW = ("راتب", "salary", "wage", "payroll")
_OBLIGATION_KW = ("قسط", "تمويل", "installment", "loan", "murabaha")
_GIG_KW = ("jahez", "جاهز", "hungerstation", "هنقرستيشن", "mrsool", "payout", "دفعه")
_P2P_KW = ("تحويل من", "p2p", "فرد", "transfer from")
_ACQUIRER_KW = ("مدى", "mada", "geidea", "urpay", "pos", "نقاط بيع")


def enrich(txn: Transaction) -> Transaction:
    """Populate ``merchant`` / ``category`` / a first-pass ``txn_type``.

    Does NOT decide income provenance — that's the verifier's job. It only labels
    what the string plainly says.
    """
    norm = normalize(txn.raw_desc)

    # merchant lookup
    for token, (merchant, category) in _MERCHANTS.items():
        if token in norm:
            txn.merchant = merchant
            txn.category = category
            break

    inflow = txn.direction == DIRECTION_INFLOW

    if any(k in norm for k in _GIG_KW) and inflow:
        txn.txn_type = TYPE_GIG
        txn.category = txn.category or "gig_income"
    elif any(k in norm for k in _SALARY_KW) and inflow:
        txn.txn_type = TYPE_SALARY
        txn.category = "salary"
    elif any(k in norm for k in _P2P_KW) and inflow:
        txn.txn_type = TYPE_P2P
        txn.category = txn.category or "p2p_transfer"
    elif any(k in norm for k in _OBLIGATION_KW) and not inflow:
        txn.txn_type = TYPE_OBLIGATION
        txn.category = "loan_obligation"
    elif any(k in norm for k in _ACQUIRER_KW) and not inflow:
        txn.txn_type = TYPE_PURCHASE
        txn.category = txn.category or "retail"

    txn.confidence = max(txn.confidence, 0.6 if txn.merchant else 0.4)
    return txn


def enrich_all(transactions: list[Transaction]) -> list[Transaction]:
    return [enrich(t) for t in transactions]
