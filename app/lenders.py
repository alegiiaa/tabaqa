"""Service ④ — the lender layer: demo lenders as PUBLISHED PRODUCT POLICIES.

Server-side twin of ``web/src/lib/lenders.ts``. The browser runs the same math
client-side for instant search UX (like the checkIntegrity mirror in adapters.ts);
this module is the authority the API serves, so an offer on screen is provably the
same arithmetic a lender gets from ``POST /v1/offers``.

Each lender is a **policy config** — rate tiers, DBR cap, score floor, amount and
tenor range — never a proprietary model. Real lenders don't hand over their
underwriting formula, but they do publish product criteria, and that is what a
marketplace runs on.

The chain, and every step is visible to the applicant (no magic numbers):

    max_installment = min(lender_cap, SAMA_CAP) * income - existing_obligations
    AF              = annuity_factor(rate/12, tenor)          # affordability.py
    max_financing   = min(max(0, max_installment) * AF, lender.max_amount)
    amount          = requested is None ? max_financing : min(requested, max_financing)
    installment     = amount / AF
    admin_fee       = min(amount * fee_pct, amount * 1%, SAR 5,000)   # SAMA ceiling

All lenders here are fictional and labelled illustrative. Offers are
pre-qualifications on SAMA rules — the final credit decision always belongs to the
licensed lender.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from affordability import annuity_factor

# SAMA Responsible Lending Principles for Individuals, Circular 46538/99, Ch. IV —
# the binding salary-deduction cap. Every lender policy is clamped to it.
SAMA_CAP_EMPLOYEE = 0.3333
SAMA_ADMIN_FEE_CEILING_SAR = 5_000.0
SAMA_ADMIN_FEE_CEILING_PCT = 0.01

PRODUCTS = ("auto", "personal", "goods")
RISK_ORDER = {"low": 0, "medium": 1, "high": 2}

DISCLAIMER = (
    "Illustrative lenders with published product policies. Offers are "
    "pre-qualifications computed on SAMA responsible-lending rules — the final "
    "credit decision always belongs to the licensed lender."
)


def _round(x: float) -> float:
    """JS ``Math.round`` semantics (half-up), so Python and TS agree to the riyal."""
    return float(math.floor(x + 0.5))


@dataclass(frozen=True)
class LenderPolicy:
    id: str
    name_en: str
    name_ar: str
    kind: str                       # bank | digital | finance | micro
    products: tuple[str, ...]
    min_score: int
    max_risk: str                   # most permissive Tabaqa risk band accepted
    dbr_cap: float                  # lender's own cap — may be tighter than SAMA's
    min_amount: float
    max_amount: float
    min_tenor: int
    max_tenor: int
    base_rate: float                # annual rate for low-risk applicants
    medium_spread: float            # added for medium risk (risk-based pricing)
    admin_fee_pct: float

    def to_dict(self) -> dict:
        from dataclasses import asdict
        d = asdict(self)
        d["products"] = list(self.products)
        return d


LENDERS: list[LenderPolicy] = [
    LenderPolicy(
        id="waha", name_en="Al Waha Bank", name_ar="مصرف الواحة", kind="bank",
        products=("auto", "personal"),
        min_score=72, max_risk="low", dbr_cap=0.30,
        min_amount=20_000, max_amount=500_000, min_tenor=12, max_tenor=60,
        base_rate=0.069, medium_spread=0.015, admin_fee_pct=0.01,
    ),
    LenderPolicy(
        id="sidra", name_en="Sidra Bank", name_ar="بنك السدرة", kind="bank",
        products=("auto", "personal", "goods"),
        min_score=62, max_risk="medium", dbr_cap=0.3333,
        min_amount=10_000, max_amount=300_000, min_tenor=12, max_tenor=60,
        base_rate=0.084, medium_spread=0.015, admin_fee_pct=0.01,
    ),
    LenderPolicy(
        id="mada", name_en="Mada Digital Bank", name_ar="بنك المدى الرقمي", kind="digital",
        products=("auto", "personal", "goods"),
        min_score=55, max_risk="medium", dbr_cap=0.3333,
        min_amount=5_000, max_amount=150_000, min_tenor=6, max_tenor=48,
        base_rate=0.099, medium_spread=0.02, admin_fee_pct=0.005,
    ),
    LenderPolicy(
        id="nakhla", name_en="Nakhla Finance", name_ar="النخلة للتمويل", kind="finance",
        products=("auto", "personal", "goods"),
        min_score=45, max_risk="medium", dbr_cap=0.3333,
        min_amount=5_000, max_amount=100_000, min_tenor=6, max_tenor=36,
        base_rate=0.125, medium_spread=0.03, admin_fee_pct=0.01,
    ),
    LenderPolicy(
        id="yusr", name_en="Yusr Microfinance", name_ar="يُسر للتمويل الأصغر", kind="micro",
        products=("personal", "goods"),
        min_score=35, max_risk="high", dbr_cap=0.3333,
        min_amount=2_000, max_amount=30_000, min_tenor=6, max_tenor=24,
        base_rate=0.15, medium_spread=0.04, admin_fee_pct=0.01,
    ),
]


@dataclass
class OfferInputs:
    """What the offer engine needs out of a scored profile."""
    income: float                        # the verified monthly income offers run on
    obligations: float = 0.0             # existing monthly obligations (absolute SAR)
    score: int = 0
    risk_flag: str = "medium"
    recourse_projected: int | None = None  # score after recourse steps → unlock hints


@dataclass
class Offer:
    lender_id: str
    lender_name_en: str
    lender_name_ar: str
    lender_kind: str
    amount: float
    reduced_from: float | None           # counter-offer: what was asked for
    tenor_months: int
    annual_rate: float
    installment: float
    admin_fee: float
    total_cost: float                    # installment × tenor + admin fee
    dbr_before: float
    dbr_after: float
    dbr_cap: float
    max_financing: float                 # ceiling under this lender's policy
    annuity_factor: float
    best: bool = False

    def to_dict(self) -> dict:
        from dataclasses import asdict
        return asdict(self)


@dataclass
class LockedOffer:
    """A lender that cannot serve this applicant — and exactly why (the unlock path)."""
    lender_id: str
    lender_name_en: str
    lender_name_ar: str
    reason: str                          # score | risk | dbr | amount_range | income
    detail: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        from dataclasses import asdict
        return asdict(self)


@dataclass
class Ceiling:
    """The derivation behind the biggest number on screen — nothing is granted.

    income × SAMA cap − obligations = installment room; × the annuity factor = the
    most any lender will extend at this tenor.
    """
    verified_income: float
    obligations: float
    sama_cap: float
    max_installment: float               # regulator-level room, lender-independent
    max_financing: float                 # best across the lenders open to this applicant
    at_lender: str | None
    tenor_months: int

    def to_dict(self) -> dict:
        from dataclasses import asdict
        return asdict(self)


@dataclass
class OffersResult:
    offers: list[Offer]
    locked: list[LockedOffer]
    full_offer_count: int                # offers at the full requested amount (the headline)
    best_max_financing: float
    ceiling: Ceiling

    def to_dict(self) -> dict:
        return {
            "offers": [o.to_dict() for o in self.offers],
            "locked": [l.to_dict() for l in self.locked],
            "full_offer_count": self.full_offer_count,
            "best_max_financing": self.best_max_financing,
            "ceiling": self.ceiling.to_dict(),
        }


def compute_offers(
    inp: OfferInputs,
    product: str = "personal",
    amount: float | None = None,          # None → "the maximum I qualify for"
    tenor_months: int = 48,
) -> OffersResult:
    """Run every lender's published policy against one verified money picture."""
    if product not in PRODUCTS:
        raise ValueError(f"Unknown product '{product}'. Known: {list(PRODUCTS)}")

    offers: list[Offer] = []
    locked: list[LockedOffer] = []
    best_af = 0.0
    ceiling_amount = 0.0
    ceiling_lender: str | None = None

    for lender in LENDERS:
        if product not in lender.products:
            continue

        if inp.income <= 0:
            locked.append(LockedOffer(lender.id, lender.name_en, lender.name_ar, "income"))
            continue
        if inp.score < lender.min_score:
            locked.append(LockedOffer(
                lender.id, lender.name_en, lender.name_ar, "score",
                {"min_score": lender.min_score,
                 "gap": lender.min_score - inp.score,
                 "unlocked_by_recourse": (inp.recourse_projected is not None
                                          and inp.recourse_projected >= lender.min_score)},
            ))
            continue
        if RISK_ORDER.get(inp.risk_flag, 1) > RISK_ORDER[lender.max_risk]:
            locked.append(LockedOffer(lender.id, lender.name_en, lender.name_ar, "risk",
                                      {"max_risk": lender.max_risk}))
            continue

        cap = min(lender.dbr_cap, SAMA_CAP_EMPLOYEE)
        rate = lender.base_rate + (lender.medium_spread if inp.risk_flag == "medium" else 0.0)
        tenor = min(max(int(tenor_months), lender.min_tenor), lender.max_tenor)
        af = annuity_factor(rate / 12.0, tenor)

        max_installment = cap * inp.income - inp.obligations
        max_financing = min(max(0.0, max_installment) * af, lender.max_amount)

        if max_financing > ceiling_amount:
            ceiling_amount, ceiling_lender, best_af = max_financing, lender.id, af

        got = max_financing if amount is None else min(amount, max_financing, lender.max_amount)
        if got < lender.min_amount:
            # Distinguish "you can't afford it here" from "this lender doesn't do that size".
            if amount is not None and lender.min_amount <= amount <= lender.max_amount:
                locked.append(LockedOffer(lender.id, lender.name_en, lender.name_ar, "dbr",
                                          {"max_financing": _round(max_financing)}))
            else:
                locked.append(LockedOffer(lender.id, lender.name_en, lender.name_ar, "amount_range",
                                          {"min_amount": lender.min_amount,
                                           "max_amount": lender.max_amount}))
            continue

        installment = got / af
        admin_fee = min(got * lender.admin_fee_pct,
                        got * SAMA_ADMIN_FEE_CEILING_PCT,
                        SAMA_ADMIN_FEE_CEILING_SAR)
        offers.append(Offer(
            lender_id=lender.id,
            lender_name_en=lender.name_en,
            lender_name_ar=lender.name_ar,
            lender_kind=lender.kind,
            amount=_round(got),
            reduced_from=(_round(amount) if amount is not None and got < amount else None),
            tenor_months=tenor,
            annual_rate=round(rate, 4),
            installment=_round(installment),
            admin_fee=_round(admin_fee),
            total_cost=_round(installment * tenor + admin_fee),
            dbr_before=round(inp.obligations / inp.income, 4),
            dbr_after=round((inp.obligations + installment) / inp.income, 4),
            dbr_cap=cap,
            max_financing=_round(max_financing),
            annuity_factor=round(af, 4),
        ))

    # Rank: full-amount offers first, cheapest total cost wins the "best" badge;
    # counter-offers after, largest amount first. In max mode, largest amount wins.
    if amount is None:
        offers.sort(key=lambda o: (-o.amount, o.total_cost))
    else:
        offers.sort(key=lambda o: (o.reduced_from is not None,
                                   o.total_cost if o.reduced_from is None else -o.amount))
    if offers:
        offers[0].best = True

    return OffersResult(
        offers=offers,
        locked=locked,
        full_offer_count=sum(1 for o in offers if o.reduced_from is None),
        best_max_financing=_round(max((o.max_financing for o in offers), default=0.0)),
        ceiling=Ceiling(
            verified_income=_round(inp.income),
            obligations=_round(inp.obligations),
            sama_cap=SAMA_CAP_EMPLOYEE,
            max_installment=_round(max(0.0, SAMA_CAP_EMPLOYEE * inp.income - inp.obligations)),
            max_financing=_round(ceiling_amount),
            at_lender=ceiling_lender,
            tenor_months=int(tenor_months),
        ),
    )


if __name__ == "__main__":  # the reveal, spoken in offers — Fahd (con_8842)
    verified = OfferInputs(income=10_000, obligations=800, score=82, risk_flag="low")
    bank_only = OfferInputs(income=4_000, obligations=800, score=82, risk_flag="low")

    v = compute_offers(verified, "auto", 60_000, 48)
    b = compute_offers(bank_only, "auto", 60_000, 48)

    print(f"verified 10,000 → {v.full_offer_count} full offers "
          f"(ceiling {v.ceiling.max_financing:,.0f} SAR)")
    for o in v.offers:
        tail = "" if o.reduced_from is None else f"  ← counter-offer (asked {o.reduced_from:,.0f})"
        print(f"  {o.lender_name_en:<22} {o.amount:>9,.0f} SAR  "
              f"{o.installment:>6,.0f}/mo  {o.annual_rate * 100:.1f}%{tail}")
    print(f"bank-only 4,000  → {b.full_offer_count} full offers "
          f"(ceiling {b.ceiling.max_financing:,.0f} SAR)")

    assert b.full_offer_count == 0, "bank-only income must yield no full offers"
    assert v.full_offer_count > b.full_offer_count, "the wallet reveal must add offers"
    assert v.ceiling.max_installment == 2533, v.ceiling.max_installment  # 0.3333×10k − 800
    print("OK — the wallet reveal holds in offers")
