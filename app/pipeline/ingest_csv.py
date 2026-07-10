"""Ingest a real uploaded statement (CSV) into a canonical fixture.

This is the "any applicant on *real* data" bridge: a user uploads their actual
bank + wallet transactions and we map them onto the exact same
``{applicant, accounts, masdr, transactions}`` shape ``synthesize_fixture``
emits — so the **real** pipeline (clean → enrich → reconcile → verify → score)
runs on them unchanged. We only produce honest rows; the pipeline decides
``txn_type`` / ``verification`` itself (we never pre-stamp those).

Documented CSV columns (header row required)::

    date                ISO YYYY-MM-DD (or YYYY-MM → padded to -01).  [required]
    description         raw statement memo, Arabic or Latin.          [required]
    amount              signed: positive = inflow, negative = outflow [required*]
    debit / credit      alternative to `amount` when amount_convention="debit_credit"
    source              "bank" | "wallet" | "bank:<name>" | "wallet:<name>" [required]
    counterparty_iban   optional — drives salary amount_verification
    balance             optional — post-txn running balance (used to back out opening)
    currency            optional — default SAR

Verification context (optional, unlocks the Masdr tiers — mirrors synthesize.py)::

    {
      "bank_name": "alinma", "wallet_name": "barq",
      "amount_convention": "signed",                 # or "debit_credit"
      "opening_balances": {"bank:alinma": 8000, "wallet:barq": 300},
      "employer": "...", "salary_iban": "SA..", "monthly_wage": 4000,
      "gig_platforms": ["Jahez", "HungerStation"]
    }
"""
from __future__ import annotations

import csv
import io
from typing import Any

from .synthesize import _GIG_TOKENS, _iban


def _to_float(x: Any) -> float | None:
    if x is None:
        return None
    s = str(x).strip().replace(",", "").replace("٬", "")  # strip thousands sep
    if s == "":
        return None
    # parenthesised negatives, e.g. (500)
    neg = s.startswith("(") and s.endswith(")")
    if neg:
        s = s[1:-1]
    try:
        v = float(s)
    except ValueError:
        return None
    return -v if neg else v


def _norm_timestamp(raw: Any) -> str:
    s = str(raw or "").strip()
    if len(s) == 7 and s[4] == "-":          # YYYY-MM → pad to first of month
        s = s + "-01"
    if len(s) < 7 or s[4] != "-":
        raise ValueError(f"Invalid date '{raw}' — expected ISO YYYY-MM-DD or YYYY-MM")
    # validate the YYYY-MM head is numeric
    if not (s[:4].isdigit() and s[5:7].isdigit()):
        raise ValueError(f"Invalid date '{raw}' — expected ISO YYYY-MM-DD or YYYY-MM")
    return s


def _norm_source(raw: Any, bank_name: str, wallet_name: str) -> str:
    s = str(raw or "").strip().lower()
    if s.startswith("bank:") or s.startswith("wallet:"):
        return s
    if s in ("bank", "b"):
        return f"bank:{bank_name}"
    if s in ("wallet", "w", "barq"):
        return f"wallet:{wallet_name}"
    raise ValueError(
        f"Invalid source '{raw}' — expected 'bank', 'wallet', or 'bank:<name>'/'wallet:<name>'"
    )


def _row_amount_direction(row: dict, amount_convention: str) -> tuple[float, str]:
    if amount_convention == "debit_credit":
        credit = _to_float(row.get("credit"))
        debit = _to_float(row.get("debit"))
        if credit and credit > 0:
            return abs(credit), "inflow"
        if debit and debit > 0:
            return abs(debit), "outflow"
        raise ValueError("debit_credit convention requires a positive 'debit' or 'credit' value")
    amt = _to_float(row.get("amount"))
    if amt is None:
        raise ValueError("Missing 'amount' — expected a signed number (+inflow / -outflow)")
    return abs(amt), ("inflow" if amt >= 0 else "outflow")


def _opening_for(source: str, opening_balances: dict[str, float] | None) -> float | None:
    if not opening_balances:
        return None
    if source in opening_balances:
        return float(opening_balances[source])
    prefix = source.split(":", 1)[0]              # "bank" / "wallet"
    if prefix in opening_balances:
        return float(opening_balances[prefix])
    return None


def parse_statement_rows(
    rows: list[dict],
    *,
    bank_name: str = "alinma",
    wallet_name: str = "barq",
    amount_convention: str = "signed",
    opening_balances: dict[str, float] | None = None,
) -> tuple[list[dict], list[dict]]:
    """Map raw CSV rows → (transactions, accounts) in run_pipeline's shape.

    Each emitted transaction carries only the honest, observable fields; merchant,
    txn_type and verification are left for enrich/verify to assign.
    """
    if not rows:
        raise ValueError("No statement rows provided")

    txns: list[dict] = []
    # remember first chronological signed event per source for balance back-out
    by_source: dict[str, list[tuple[str, float, float | None]]] = {}

    for raw in rows:
        # normalize keys to lowercase for resilience to header casing
        row = {str(k).strip().lower(): v for k, v in raw.items()}
        ts = _norm_timestamp(row.get("date") or row.get("timestamp"))
        desc = str(row.get("description") or row.get("raw_desc") or "").strip()
        if not desc:
            raise ValueError(f"Missing 'description' on row dated {ts}")
        amount, direction = _row_amount_direction(row, amount_convention)
        source = _norm_source(row.get("source"), bank_name, wallet_name)
        iban = str(row.get("counterparty_iban") or "").strip() or None
        currency = str(row.get("currency") or "SAR").strip() or "SAR"
        balance = _to_float(row.get("balance"))

        txns.append({
            "source": source,
            "timestamp": ts,
            "amount": amount,
            "direction": direction,
            "raw_desc": desc,
            "counterparty_iban": iban,
            "currency": currency,
        })
        signed = amount if direction == "inflow" else -amount
        by_source.setdefault(source, []).append((ts, signed, balance))

    # ── derive accounts / opening balances ──
    accounts: list[dict] = []
    for source, events in by_source.items():
        events.sort(key=lambda e: e[0])           # chronological
        opening = _opening_for(source, opening_balances)
        if opening is None:
            first_ts, first_signed, first_balance = events[0]
            if first_balance is not None:
                # balance is the post-txn balance of the earliest row → back it out
                opening = round(first_balance - first_signed, 2)
            else:
                opening = 0.0
        accounts.append({"source": source, "opening_balance": float(opening), "currency": "SAR"})

    return txns, accounts


def parse_statement_csv(text: str, **kwargs) -> tuple[list[dict], list[dict]]:
    """Convenience: parse raw CSV text → (transactions, accounts)."""
    reader = csv.DictReader(io.StringIO(text))
    return parse_statement_rows(list(reader), **kwargs)


def build_masdr_from_context(ctx: dict | None) -> dict:
    """Build the Masdr ground-truth from an optional verification context.

    Mirrors synthesize.py:132-143 so verify.py assigns the same 3-tier provenance.
    No context → ``{"establishments": []}`` (everything degrades to `inferred`).
    """
    ctx = ctx or {}
    establishments: list[str] = []
    for p in ctx.get("gig_platforms", []) or []:
        plat = str(p or "").strip()
        if not plat:
            continue
        canonical = _GIG_TOKENS.get(plat.lower(), (plat.upper(), plat))[1]
        if canonical not in establishments:
            establishments.append(canonical)

    masdr: dict[str, Any] = {"establishments": establishments}

    wage = _to_float(ctx.get("monthly_wage")) or 0.0
    iban = str(ctx.get("salary_iban") or "").strip()
    if wage > 0 and iban:
        employer = str(ctx.get("employer") or "صاحب العمل").strip()
        masdr["payslip"] = {"employer": employer, "monthly_wage": wage, "iban": iban}
        masdr["akeed_ibans"] = {iban: {"owner": employer, "status": "active"}}
    return masdr


def statement_integrity(rows: list[dict], amount_convention: str = "signed") -> dict | None:
    """Running-balance integrity: a genuine export's balance column must reconcile
    with the transaction arithmetic — ``balance[i] == balance[i-1] ± amount[i]``.
    Editing a single row in Excel breaks the chain on both sides, so this is the
    computed answer to "what stops me tampering with my CSV?".

    Checked per source in FILE order (statements are oldest- or newest-first —
    both directions are tried, the better one counted). Strict: any break fails.
    Returns ``None`` when fewer than 2 consecutive balance-bearing pairs exist.
    """
    def signed(r: dict) -> float | None:
        if amount_convention == "debit_credit" or (r.get("amount") is None and (r.get("debit") is not None or r.get("credit") is not None)):
            credit, debit = _to_float(r.get("credit")), _to_float(r.get("debit"))
            if credit:
                return abs(credit)
            if debit:
                return -abs(debit)
            return None
        return _to_float(r.get("amount"))

    by_source: dict[str, list[tuple[float, float]]] = {}
    for r in rows or []:
        bal, amt = _to_float(r.get("balance")), signed(r)
        if bal is None or amt is None:
            continue
        by_source.setdefault(str(r.get("source") or "bank"), []).append((amt, bal))

    pairs = breaks = 0
    for events in by_source.values():
        n = len(events) - 1
        if n < 1:
            continue
        fwd = sum(1 for i in range(1, len(events))
                  if abs(events[i][1] - (events[i - 1][1] + events[i][0])) <= 0.011)
        rev = sum(1 for i in range(1, len(events))
                  if abs(events[i - 1][1] - (events[i][1] + events[i - 1][0])) <= 0.011)
        pairs += n
        breaks += n - max(fwd, rev)
    if pairs < 2:
        return None
    return {"checked": True, "passed": breaks == 0, "pairs": pairs, "breaks": breaks}


def build_fixture_from_statement(
    statement: dict,
    *,
    name: str = "Applicant",
    connection_id: str | None = None,
) -> dict:
    """Turn ``{"rows": [...], "context": {...}}`` into a canonical fixture.

    Returns the exact same top-level shape as ``synthesize_fixture`` so the whole
    downstream pipeline is untouched.
    """
    ctx = statement.get("context") or {}
    rows = statement.get("rows") or []
    name = str(statement.get("name") or name or "Applicant").strip()

    txns, accounts = parse_statement_rows(
        rows,
        bank_name=str(ctx.get("bank_name") or "alinma"),
        wallet_name=str(ctx.get("wallet_name") or "barq"),
        amount_convention=str(ctx.get("amount_convention") or "signed"),
        opening_balances=ctx.get("opening_balances"),
    )
    masdr = build_masdr_from_context(ctx)

    connection_id = connection_id or ctx.get("connection_id") or f"con_{_iban(name)[2:10]}"
    applicant: dict[str, Any] = {"id": f"applicant_{connection_id}", "name": name, "connection_id": connection_id}
    integrity = statement_integrity(rows, str(ctx.get("amount_convention") or "signed"))
    if integrity is not None:
        applicant["statement_integrity"] = integrity
    return {
        "applicant": applicant,
        "accounts": accounts,
        "masdr": masdr,
        "transactions": txns,
    }
