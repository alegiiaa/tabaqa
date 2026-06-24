"""Synthesize a canonical fixture from a high-level "applicant form".

This is the bridge that makes Tabaqa testable by *anyone*: a lender fills in a
plain-language financial picture (salary, gig platforms, P2P, obligations,
spending) and we emit a realistic multi-month bank+wallet statement plus the
matching Masdr ground-truth — written so the **real** pipeline
(enrich → reconcile → verify) classifies every line correctly:

  • salary  → raw_desc "راتب …" + counterparty_iban == payslip.iban  → amount_verified
  • gig     → raw_desc "<PLATFORM> دفعة" + platform in masdr.establishments → source_verified
  • p2p     → raw_desc "تحويل من <name>"                                → inferred
  • loan    → raw_desc "قسط تمويل …"                                    → loan_obligation
  • spend   → raw_desc "مدى - …"                                        → purchase (expense)

We deliberately route salary to the **bank** and gig/P2P to the **wallet**, so a
bank-only view sees only the salary while Tabaqa surfaces the full income — the
"reveal". Nothing here decides provenance; the pipeline does. We only generate
honest inputs.
"""
from __future__ import annotations

import hashlib
from datetime import date
from typing import Any

# Known gig platforms → (token embedded in raw_desc, canonical name the enricher
# resolves to). Any platform not listed still classifies as gig via the "دفعة"
# keyword; we add it to masdr.establishments so the verifier source-verifies it.
_GIG_TOKENS: dict[str, tuple[str, str]] = {
    "jahez": ("JAHEZ-RYD", "Jahez"),
    "hungerstation": ("HUNGERSTATION SA", "HungerStation"),
    "mrsool": ("MRSOOL", "Mrsool"),
    "careem": ("CAREEM", "Careem"),
    "uber": ("UBER", "Uber"),
}


def _dec_month(y: int, m: int) -> tuple[int, int]:
    return (y - 1, 12) if m == 1 else (y, m - 1)


def _recent_months(n: int, as_of: str | None) -> list[str]:
    """`n` complete `YYYY-MM` months, oldest→newest, ending the month before `as_of`."""
    if as_of:
        y, m = int(as_of[:4]), int(as_of[5:7])
    else:
        today = date.today()
        y, m = today.year, today.month
    y, m = _dec_month(y, m)  # latest *complete* month
    out: list[str] = []
    for _ in range(max(1, n)):
        out.append(f"{y:04d}-{m:02d}")
        y, m = _dec_month(y, m)
    return list(reversed(out))


def _iban(seed: str) -> str:
    """Deterministic, plausibly-shaped Saudi IBAN (not checksum-valid — demo only)."""
    h = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    digits = "".join(str(int(c, 16) % 10) for c in h)[:22]
    return "SA" + digits


def _f(x: Any, default: float = 0.0) -> float:
    try:
        v = float(x)
        return v if v >= 0 else 0.0
    except (TypeError, ValueError):
        return default


def synthesize_fixture(form: dict) -> dict:
    """Turn an applicant form into a `{applicant, accounts, masdr, transactions}` fixture.

    Form shape (all money values are SAR/month)::

        {
          "name": "Sara K.",
          "months": 3,                       # 1..12, default 3
          "as_of": "2026-06",                # optional anchor; default = today
          "bank":   {"name": "alinma", "opening_balance": 8000},
          "wallet": {"name": "barq",   "opening_balance": 300},   # optional
          "salary": {"monthly": 4000, "employer": "شركة الأفق"},  # optional
          "gigs":   [{"platform": "Jahez", "monthly": 2600}],     # optional, repeatable
          "p2p":    [{"from": "عبدالله", "monthly": 800}],        # optional, repeatable
          "obligations": [{"label": "قسط عقاري", "monthly": 800}],# optional, repeatable
          "monthly_spending": 600            # bank card spend, default 0
        }
    """
    name = str(form.get("name") or "Applicant").strip()
    months = int(form.get("months") or 3)
    months = max(1, min(12, months))
    month_keys = _recent_months(months, form.get("as_of"))

    bank = form.get("bank") or {}
    bank_src = f"bank:{(bank.get('name') or 'alinma')}"
    wallet = form.get("wallet") or None
    has_wallet = bool(wallet)
    wallet_src = f"wallet:{(wallet.get('name') or 'barq')}" if has_wallet else None

    salary = form.get("salary") or None
    gigs = [g for g in (form.get("gigs") or []) if _f(g.get("monthly")) > 0]
    p2p = [p for p in (form.get("p2p") or []) if _f(p.get("monthly")) > 0]
    obligations = [o for o in (form.get("obligations") or []) if _f(o.get("monthly")) > 0]
    spending = _f(form.get("monthly_spending"))

    # If gig/P2P income exists but no wallet was given, default one so the reveal
    # has somewhere to land (gig/P2P that sit in the bank wouldn't be "hidden").
    if (gigs or p2p) and not has_wallet:
        has_wallet = True
        wallet = {"name": "barq", "opening_balance": 0.0}
        wallet_src = "wallet:barq"

    seed = f"{name}|{salary.get('employer') if salary else ''}"
    employer = str(salary.get("employer") or "صاحب العمل").strip() if salary else ""
    wage = _f(salary.get("monthly")) if salary else 0.0
    payslip_iban = _iban(seed) if wage > 0 else None

    # ── accounts ──
    accounts = [{
        "source": bank_src,
        "opening_balance": _f(bank.get("opening_balance"), 0.0),
        "currency": "SAR",
    }]
    if has_wallet:
        accounts.append({
            "source": wallet_src,
            "opening_balance": _f(wallet.get("opening_balance"), 0.0),
            "currency": "SAR",
        })

    # ── masdr ground-truth ──
    establishments: list[str] = []
    for g in gigs:
        plat = str(g.get("platform") or "").strip()
        canonical = _GIG_TOKENS.get(plat.lower(), (plat.upper(), plat or "Gig"))[1]
        if canonical not in establishments:
            establishments.append(canonical)

    masdr: dict[str, Any] = {"establishments": establishments}
    if wage > 0 and payslip_iban:
        masdr["payslip"] = {"employer": employer, "monthly_wage": wage, "iban": payslip_iban}
        masdr["akeed_ibans"] = {payslip_iban: {"owner": employer, "status": "active"}}

    # ── transactions (one set per month) ──
    txns: list[dict] = []
    for mk in month_keys:
        if wage > 0:
            txns.append({
                "source": bank_src, "timestamp": f"{mk}-27", "amount": wage,
                "direction": "inflow", "raw_desc": f"راتب - {employer}",
                "counterparty_iban": payslip_iban,
            })
        for i, o in enumerate(obligations):
            txns.append({
                "source": bank_src, "timestamp": f"{mk}-0{(5 + i) % 9 or 5}",
                "amount": _f(o.get("monthly")), "direction": "outflow",
                "raw_desc": f"قسط تمويل - {str(o.get('label') or 'تمويل').strip()}",
            })
        if spending > 0:
            txns.append({
                "source": bank_src, "timestamp": f"{mk}-12", "amount": spending,
                "direction": "outflow", "raw_desc": "مدى - نقاط بيع",
            })
        for i, g in enumerate(gigs):
            plat = str(g.get("platform") or "").strip()
            token = _GIG_TOKENS.get(plat.lower(), (plat.upper() or "GIG", plat))[0]
            txns.append({
                "source": wallet_src, "timestamp": f"{mk}-{15 + i:02d}",
                "amount": _f(g.get("monthly")), "direction": "inflow",
                "raw_desc": f"{token} دفعة",
            })
        for i, p in enumerate(p2p):
            txns.append({
                "source": wallet_src, "timestamp": f"{mk}-{19 + i:02d}",
                "amount": _f(p.get("monthly")), "direction": "inflow",
                "raw_desc": f"تحويل من {str(p.get('from') or 'فرد').strip()}",
            })

    connection_id = form.get("connection_id") or f"con_{_iban(seed + name)[2:10]}"
    return {
        "applicant": {"id": f"applicant_{connection_id}", "name": name, "connection_id": connection_id},
        "accounts": accounts,
        "masdr": masdr,
        "transactions": txns,
    }
