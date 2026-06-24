"""Canonical transaction schema — the single shape every downstream step reads.

Mirrors PRD §9. Kept as a stdlib dataclass (no pydantic) so the pipeline runs
with zero third-party dependencies; the API layer converts these to/from its own
Pydantic models.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from typing import Optional

# ── controlled vocabularies ──────────────────────────────────────────────────
DIRECTION_INFLOW = "inflow"
DIRECTION_OUTFLOW = "outflow"

# txn_type values
TYPE_SALARY = "salary"
TYPE_GIG = "gig_income"
TYPE_P2P = "p2p"
TYPE_INTERNAL = "internal_movement"
TYPE_OBLIGATION = "loan_obligation"
TYPE_PURCHASE = "purchase"
TYPE_UNKNOWN = "unknown"

INCOME_TYPES = {TYPE_SALARY, TYPE_GIG, TYPE_P2P}

# verification tiers (the 3-tier provenance model, PRD §6)
VERIFY_AMOUNT = "amount_verified"
VERIFY_SOURCE = "source_verified"
VERIFY_INFERRED = "inferred"


@dataclass
class Transaction:
    source: str  # "bank:alinma" | "wallet:barq"
    timestamp: str  # ISO-8601 (YYYY-MM-DD or full)
    amount: float
    direction: str  # inflow | outflow
    raw_desc: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    currency: str = "SAR"
    merchant: Optional[str] = None  # set by the Arabic Cleaner / enricher
    category: Optional[str] = None
    txn_type: str = TYPE_UNKNOWN
    counterparty_iban: Optional[str] = None
    verification: str = VERIFY_INFERRED
    verified_via: str = "none"  # masdr:payslip | masdr:establishment | masdr:akeed | none
    confidence: float = 0.0

    @property
    def month(self) -> str:
        """`YYYY-MM` bucket from the timestamp."""
        return self.timestamp[:7]

    @property
    def is_bank(self) -> bool:
        return self.source.startswith("bank:")

    @property
    def is_wallet(self) -> bool:
        return self.source.startswith("wallet:")

    @classmethod
    def from_dict(cls, d: dict) -> "Transaction":
        known = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        return cls(**{k: v for k, v in d.items() if k in known})

    def to_dict(self) -> dict:
        return asdict(self)
