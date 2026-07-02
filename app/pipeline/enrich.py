"""[2] Enrich → merchant + category.

Rule-based resolver for the known ~80% (gig platforms, Saudi acquirers, transfer
and salary keywords). The messy long-tail — any Saudi merchant or transliterated
Arabic memo the dict doesn't know — is resolved by a cached Claude (Haiku) pass in
:func:`enrich_all` when a key is present (see ``llm.py``); with no key it's a no-op
and the rules stand alone, so the offline eval stays reproducible.
"""
from __future__ import annotations

import hashlib
import json

from . import llm
from .clean import normalize
from .schema import (
    Transaction,
    DIRECTION_INFLOW,
    TYPE_GIG,
    TYPE_INTERNAL,
    TYPE_OBLIGATION,
    TYPE_PURCHASE,
    TYPE_SALARY,
    TYPE_P2P,
    TYPE_UNKNOWN,
)

# merchant token → (canonical merchant, category). `category` doubles as the
# brand key the dashboard uses to pick a logo, so keep the canonical name stable.
_MERCHANTS = {
    # gig / delivery platforms
    "jahez": ("Jahez", "gig_platform"),
    "جاهز": ("Jahez", "gig_platform"),
    "hungerstation": ("HungerStation", "gig_platform"),
    "هنقرستيشن": ("HungerStation", "gig_platform"),
    "mrsool": ("Mrsool", "gig_platform"),
    "مرسول": ("Mrsool", "gig_platform"),
    "uber": ("Uber", "gig_platform"),
    "kareem": ("Careem", "gig_platform"),
    "careem": ("Careem", "gig_platform"),
    "كريم": ("Careem", "gig_platform"),
    # groceries & retail
    "بنده": ("Panda", "grocery"),
    "panda": ("Panda", "grocery"),
    "tamimi": ("Tamimi", "grocery"),
    "تميمي": ("Tamimi", "grocery"),
    "carrefour": ("Carrefour", "grocery"),
    "كارفور": ("Carrefour", "grocery"),
    "othaim": ("Othaim", "grocery"),
    "العثيم": ("Othaim", "grocery"),
    "جرير": ("Jarir", "electronics"),
    "jarir": ("Jarir", "electronics"),
    # food & coffee
    "starbucks": ("Starbucks", "coffee"),
    "ستاربكس": ("Starbucks", "coffee"),
    "بارنز": ("Barns", "coffee"),
    "barns": ("Barns", "coffee"),
    # fuel
    "sasco": ("SASCO", "fuel"),
    "ساسكو": ("SASCO", "fuel"),
    "petromin": ("Petromin", "fuel"),
    # e-commerce & wallets
    "noon": ("noon", "ecommerce"),
    "نون": ("noon", "ecommerce"),
    "amazon": ("Amazon", "ecommerce"),
    "امازون": ("Amazon", "ecommerce"),
    "urpay": ("urpay", "wallet"),
    # telecom
    "stc": ("STC", "telecom"),
    "mobily": ("Mobily", "telecom"),
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

    # A resolved consumer merchant on an outflow (Starbucks, fuel, …) is a
    # purchase even when it carried no acquirer keyword — label it for the feed.
    if txn.txn_type == TYPE_UNKNOWN and not inflow and txn.merchant:
        txn.txn_type = TYPE_PURCHASE

    txn.confidence = max(txn.confidence, 0.6 if txn.merchant else 0.4)
    return txn


# ── LLM long-tail fallback (optional, additive, cached) ──────────────────────
_VALID_TYPES = {
    TYPE_SALARY, TYPE_GIG, TYPE_P2P, TYPE_INTERNAL,
    TYPE_OBLIGATION, TYPE_PURCHASE, TYPE_UNKNOWN,
}

_ENRICH_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "merchant": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "category": {"type": "string"},
                    "txn_type": {"type": "string", "enum": sorted(_VALID_TYPES)},
                },
                "required": ["index", "merchant", "category", "txn_type"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}

_ENRICH_SYSTEM = (
    "You label Saudi bank/wallet transactions. For each raw description, return the "
    "canonical merchant (or null if it's a person-to-person transfer, salary, or has no "
    "merchant), a lowercase category (e.g. grocery, coffee, fuel, telecom, ecommerce, "
    "restaurant, gig_platform, salary, p2p_transfer, loan_obligation, retail), and a "
    "txn_type from the allowed enum. Descriptions may be Arabic, transliterated, or "
    "mixed script. Inflows from Jahez/HungerStation/Mrsool/Careem are gig_income; "
    "salary keywords (راتب) are salary; person transfers (تحويل من) are p2p; financing/"
    "instalments (قسط/تمويل) are loan_obligation; everything else paid out is purchase. "
    "Use the exact index you were given for each item."
)


def _gap(t: Transaction) -> bool:
    """A txn the rules couldn't fully resolve — unknown type or no merchant on a spend."""
    if t.txn_type == TYPE_UNKNOWN:
        return True
    return t.merchant is None and t.direction != DIRECTION_INFLOW


def _llm_enrich_gaps(transactions: list[Transaction]) -> None:
    """Fill rule-misses with a single cached Claude call. No-op when LLM is disabled.

    Conservative by design: only *fills* gaps — never overrides a confident rule.
    Income provenance is untouched (that stays the verifier's Masdr job); the LLM
    only labels merchant/category and a first-pass type where the rules said unknown.
    """
    gaps = [t for t in transactions if _gap(t)]
    if not gaps or not llm.available():
        return

    listing = "\n".join(
        f"{i}\t{'IN' if t.direction == DIRECTION_INFLOW else 'OUT'}\t{t.amount:.0f}\t{t.raw_desc}"
        for i, t in enumerate(gaps)
    )
    key = "enrich:" + hashlib.sha256(
        "\n".join(sorted(normalize(t.raw_desc) for t in gaps)).encode("utf-8")
    ).hexdigest()
    out = llm.structured(
        model=llm.ENRICH_MODEL,
        system=_ENRICH_SYSTEM,
        prompt="index\tdir\tamount\tdescription\n" + listing,
        schema=_ENRICH_SCHEMA,
        max_tokens=4096,  # one JSON object per gap row; give the batch room
        cache_key=key,
    )
    if not out:
        return

    # the model may return {"items": [...]} or a bare [...] — accept either
    items = out if isinstance(out, list) else out.get("items", []) if isinstance(out, dict) else []
    for item in items:
        if not isinstance(item, dict):
            continue
        idx = item.get("index")
        if not isinstance(idx, int) or not (0 <= idx < len(gaps)):
            continue
        t = gaps[idx]
        merchant = item.get("merchant")
        if t.merchant is None and isinstance(merchant, str) and merchant.strip():
            t.merchant = merchant.strip()
        category = item.get("category")
        if not t.category and isinstance(category, str) and category.strip():
            t.category = category.strip()
        ttype = item.get("txn_type")
        if t.txn_type == TYPE_UNKNOWN and ttype in _VALID_TYPES:
            t.txn_type = ttype
        t.confidence = max(t.confidence, 0.7 if t.merchant else 0.55)


def enrich_all(transactions: list[Transaction]) -> list[Transaction]:
    for t in transactions:
        enrich(t)
    _llm_enrich_gaps(transactions)  # additive: fills only what the rules missed
    return transactions
