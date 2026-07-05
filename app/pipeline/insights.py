"""[6] Financial intelligence — the *deep meaning* of a money history.

The score answers "how risky?". This layer answers "what is actually going on
in this person's finances?" — the thing a human analyst would read off the
statement: where income comes from and whether it's growing, where money goes,
how much cushion there is, what's recurring, and what looks risky.

Two halves, mirroring the rest of Tabaqa:
  * **Deterministic signals** (pure-stdlib) — income trend & stability, source
    diversification & concentration, spending by category, savings rate, runway
    (months of buffer), recurring obligations, and machine risk ``flags``. These
    are reproducible and run offline.
  * **Narrative** — those signals handed to Claude (Sonnet by default) to write a
    factual, lender-facing explanation + highlights + risks. Falls back to a
    deterministic template when no key is set, so the panel always renders.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from typing import Optional

from . import llm
from .pipeline import ProfileResult
from .schema import (
    Transaction,
    DIRECTION_INFLOW,
    INCOME_TYPES,
    TYPE_INTERNAL,
    TYPE_OBLIGATION,
    TYPE_SALARY,
    TYPE_GIG,
    TYPE_P2P,
)

# categories that read as recurring commitments rather than one-off purchases
_RECURRING_CATEGORIES = {"telecom", "loan_obligation", "insurance", "subscription", "utilities"}

_SOURCE_LABELS = {TYPE_SALARY: "Salary", TYPE_GIG: "Gig income", TYPE_P2P: "P2P transfers"}


@dataclass
class FinancialInsights:
    # ── narrative (Claude or templated) ──
    summary_line: str
    narrative: str
    highlights: list[str]
    risks: list[str]
    generated_by: str  # "claude:<model>" | "rules"
    # ── deterministic signals ──
    income_trend: dict           # {direction, pct_change, monthly:[{month,amount}]}
    diversification: dict        # {label, concentration, sources:[{label,monthly,share}]}
    spending: dict               # {monthly_total, by_category:[...], top_merchants:[...]}
    savings_rate: float          # 0..1 (negative = overspending)
    runway_months: Optional[float]
    recurring: dict              # {obligation_load, items:[{label,monthly,kind}]}
    health: dict                 # {stability, resilience, diversification} 0..100
    flags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


# ── deterministic signal extraction ──────────────────────────────────────────
def _round(x: float, n: int = 2) -> float:
    return round(float(x), n)


def _income_trend(txns: list[Transaction], months: list[str]) -> dict:
    monthly = [
        (m, sum(t.amount for t in txns
                if t.month == m and t.txn_type in INCOME_TYPES and t.direction == DIRECTION_INFLOW))
        for m in months
    ]
    series = [{"month": m, "amount": _round(v)} for m, v in monthly]
    vals = [v for _, v in monthly]
    direction, pct = "stable", 0.0
    if len(vals) >= 2 and vals[0] > 0:
        pct = (vals[-1] - vals[0]) / vals[0]
        direction = "growing" if pct > 0.1 else "declining" if pct < -0.1 else "stable"
    return {"direction": direction, "pct_change": _round(pct, 3), "monthly": series}


def _diversification(income) -> dict:
    total = income.total_income or 0.0
    sources = []
    for c in income.components:
        share = (c.monthly_amount / total) if total else 0.0
        sources.append({
            "label": _SOURCE_LABELS.get(c.txn_type, c.label),
            "txn_type": c.txn_type,
            "monthly": _round(c.monthly_amount),
            "share": _round(share, 3),
        })
    sources.sort(key=lambda s: s["monthly"], reverse=True)
    concentration = max((s["share"] for s in sources), default=0.0)
    label = ("single-source" if concentration >= 0.85
             else "concentrated" if concentration >= 0.6 else "diversified")
    return {"label": label, "concentration": _round(concentration, 3), "sources": sources}


def _spending(txns: list[Transaction], n_months: int) -> dict:
    expenses = [t for t in txns if t.direction != DIRECTION_INFLOW and t.txn_type != TYPE_INTERNAL]
    total = sum(t.amount for t in expenses)

    by_cat: dict[str, float] = {}
    for t in expenses:
        by_cat[t.category or "other"] = by_cat.get(t.category or "other", 0.0) + t.amount
    by_category = sorted(
        ({"category": k, "monthly": _round(v / n_months), "share": _round(v / total, 3) if total else 0.0}
         for k, v in by_cat.items()),
        key=lambda c: c["monthly"], reverse=True,
    )

    by_merch: dict[str, float] = {}
    for t in expenses:
        if t.merchant:
            by_merch[t.merchant] = by_merch.get(t.merchant, 0.0) + t.amount
    top_merchants = sorted(
        ({"merchant": k, "monthly": _round(v / n_months)} for k, v in by_merch.items()),
        key=lambda m: m["monthly"], reverse=True,
    )[:5]

    return {
        "monthly_total": _round(total / n_months),
        "by_category": by_category[:8],
        "top_merchants": top_merchants,
    }


def _recurring(txns: list[Transaction], n_months: int, obligation_load: float) -> dict:
    items: dict[str, dict] = {}
    for t in txns:
        is_obl = t.txn_type == TYPE_OBLIGATION
        is_rec_cat = (t.category or "") in _RECURRING_CATEGORIES
        if t.direction == DIRECTION_INFLOW or not (is_obl or is_rec_cat):
            continue
        label = t.merchant or ("Financing instalment" if is_obl else (t.category or "Recurring"))
        kind = "obligation" if is_obl else "subscription"
        slot = items.setdefault(label, {"label": label, "kind": kind, "total": 0.0})
        slot["total"] += t.amount
    out = sorted(
        ({"label": v["label"], "kind": v["kind"], "monthly": _round(v["total"] / n_months)}
         for v in items.values()),
        key=lambda x: x["monthly"], reverse=True,
    )
    return {"obligation_load": _round(obligation_load, 3), "items": out}


def _current_balance(result: ProfileResult) -> float:
    bal = sum(result.opening_balances.values())
    for t in result.transactions:
        bal += t.amount if t.direction == DIRECTION_INFLOW else -t.amount
    return bal


def extract_signals(result: ProfileResult) -> dict:
    """The deterministic half — every number traceable to the ledger."""
    txns = result.transactions
    inc, feats = result.income, result.features
    months = sorted({t.month for t in txns}) or ["_"]
    n_months = max(1, len(months))

    expenses = [t for t in txns if t.direction != DIRECTION_INFLOW and t.txn_type != TYPE_INTERNAL]
    monthly_expense = sum(t.amount for t in expenses) / n_months
    monthly_income = inc.total_income
    savings_rate = ((monthly_income - monthly_expense) / monthly_income) if monthly_income else 0.0

    balance = _current_balance(result)
    runway = _round(balance / monthly_expense, 1) if monthly_expense > 0 else None

    trend = _income_trend(txns, months)
    div = _diversification(inc)

    # descriptive 0..100 sub-scores (NOT the credit score — these are explanatory)
    stability = round(max(0.0, min(1.0, feats.income_regularity)) * 100)
    resilience = round(max(0.0, min(1.0, (runway or 0) / 3.0)) * 100) - (12 if feats.nsf_count else 0)
    resilience = max(0, min(100, resilience))
    diversification_score = round((1 - div["concentration"]) * 100)

    flags: list[str] = []
    if feats.nsf_count:
        flags.append("nsf")
    if feats.min_balance < 0:
        flags.append("negative_buffer")
    if savings_rate < 0:
        flags.append("negative_savings")
    if feats.recurring_obligation_load > 0.4:
        flags.append("high_obligation_load")
    if div["concentration"] >= 0.85:
        flags.append("income_concentration")
    if trend["direction"] == "declining":
        flags.append("declining_income")
    if runway is not None and runway < 1:
        flags.append("short_runway")
    if feats.months_observed < 2 or len(txns) < 10:
        flags.append("thin_file")

    return {
        "applicant": result.applicant.get("name", "Applicant"),
        "months_observed": feats.months_observed,
        "income": {
            "monthly_total": _round(monthly_income),
            "bank_only": _round(inc.bank_only_income),
            "reveal_delta": _round(inc.reveal_delta),
            "verified_share": _round(inc.verified_share, 3),
        },
        "income_trend": trend,
        "diversification": div,
        "spending": _spending(txns, n_months),
        "savings_rate": _round(savings_rate, 3),
        "runway_months": runway,
        "recurring": _recurring(txns, n_months, feats.recurring_obligation_load),
        "current_balance": _round(balance),
        "health": {
            "stability": stability,
            "resilience": resilience,
            "diversification": diversification_score,
        },
        "flags": flags,
    }


# ── narrative (Claude, with a deterministic template fallback) ────────────────
_NARRATIVE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary_line": {"type": "string"},
        "narrative": {"type": "string"},
        "highlights": {"type": "array", "items": {"type": "string"}},
        "risks": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary_line", "narrative", "highlights", "risks"],
    "additionalProperties": False,
}

_NARRATIVE_SYSTEM = (
    "You are Tabaqa's credit-intelligence analyst. You read a Saudi consumer's "
    "verified open-banking signals (income, spending, stability, obligations) and "
    "explain, in clear factual lender-facing language, what the money history MEANS "
    "for their creditworthiness. Be specific and quantitative — cite SAR amounts and "
    "percentages from the data. Never invent a number that isn't in the signals. "
    "Context is Saudi: gig income is Jahez/HungerStation/Mrsool, wallets are Barq/urpay, "
    "card rails are mada. Keep the narrative to 3-5 sentences; highlights and risks to "
    "short phrases. If there are no real risks, return an empty risks array."
)


def _narrate_with_claude(signals: dict) -> Optional[dict]:
    payload = json.dumps(signals, ensure_ascii=False, sort_keys=True)
    out = llm.structured(
        model=llm.INSIGHTS_MODEL,
        system=_NARRATIVE_SYSTEM,
        prompt="Financial signals (JSON):\n" + payload + "\n\nWrite the analysis.",
        schema=_NARRATIVE_SCHEMA,
        max_tokens=3000,  # room for adaptive thinking + the JSON so it doesn't truncate
        thinking=True,
        cache_key="insights:" + hashlib.sha256(payload.encode("utf-8")).hexdigest(),
    )
    if not out:
        return None
    narrated = {
        "summary_line": str(out.get("summary_line", "")).strip(),
        "narrative": str(out.get("narrative", "")).strip(),
        "highlights": [str(h).strip() for h in out.get("highlights", []) if str(h).strip()],
        "risks": [str(r).strip() for r in out.get("risks", []) if str(r).strip()],
    }
    # A salvaged or truncated generation can be valid JSON yet miss the essentials —
    # an empty narrative on screen is worse than the deterministic template.
    if not narrated["summary_line"] or not narrated["narrative"]:
        return None
    return narrated


_FLAG_RISK = {
    "nsf": "Account went negative — NSF/overdraft events present.",
    "negative_buffer": "Minimum balance dips below zero.",
    "negative_savings": "Spending exceeds income in the observed window.",
    "high_obligation_load": "Recurring debt consumes a large share of income.",
    "income_concentration": "Income concentrated in a single source.",
    "declining_income": "Income is trending downward over the window.",
    "short_runway": "Under one month of expense buffer on hand.",
    "thin_file": "Thin history — limited months/transactions to judge.",
}


def _templated_narrative(signals: dict) -> dict:
    name = signals["applicant"]
    inc = signals["income"]
    div = signals["diversification"]
    sr = signals["savings_rate"]
    runway = signals["runway_months"]
    trend = signals["income_trend"]["direction"]

    mix = ", ".join(f"{s['label']} {round(s['share'] * 100)}%" for s in div["sources"][:3]) or "no verified income"
    runway_txt = f"{runway} months of runway" if runway is not None else "runway not estimable"
    summary = (
        f"{name} shows SAR {inc['monthly_total']:,.0f}/mo verified income ({mix}); "
        f"income is {trend}, savings rate {round(sr * 100)}%, {runway_txt}."
    )
    narrative = (
        f"Verified monthly income is SAR {inc['monthly_total']:,.0f}, of which SAR "
        f"{inc['bank_only']:,.0f} is visible bank-side — Tabaqa surfaces an extra SAR "
        f"{inc['reveal_delta']:,.0f} from wallet/gig sources. Income mix: {mix}. "
        f"Spending averages SAR {signals['spending']['monthly_total']:,.0f}/mo, a "
        f"{round(sr * 100)}% savings rate. {runway_txt.capitalize()}. "
        f"{round(inc['verified_share'] * 100)}% of income is Masdr-verified."
    )
    highlights = []
    if inc["reveal_delta"] > 0:
        highlights.append(f"Wallet reveal adds SAR {inc['reveal_delta']:,.0f}/mo over bank-only view")
    if trend == "growing":
        highlights.append("Income trending upward")
    if sr >= 0.2:
        highlights.append(f"Healthy {round(sr * 100)}% savings rate")
    if "nsf" not in signals["flags"] and signals["health"]["resilience"] >= 60:
        highlights.append("No overdrafts; solid balance buffer")
    risks = [_FLAG_RISK[f] for f in signals["flags"] if f in _FLAG_RISK]
    return {
        "summary_line": summary,
        "narrative": narrative,
        "highlights": highlights or ["Stable, verifiable income profile"],
        "risks": risks,
    }


def build_insights(result: ProfileResult, *, use_llm: bool = True) -> FinancialInsights:
    """Deterministic signals + a narrative (Claude when available, else templated)."""
    signals = extract_signals(result)

    narration, generated_by = None, "rules"
    if use_llm:
        narration = _narrate_with_claude(signals)
        if narration:
            generated_by = f"{llm.PROVIDER_TAG}:{llm.INSIGHTS_MODEL}"
    if narration is None:
        narration = _templated_narrative(signals)

    return FinancialInsights(
        summary_line=narration["summary_line"],
        narrative=narration["narrative"],
        highlights=narration["highlights"],
        risks=narration["risks"],
        generated_by=generated_by,
        income_trend=signals["income_trend"],
        diversification=signals["diversification"],
        spending=signals["spending"],
        savings_rate=signals["savings_rate"],
        runway_months=signals["runway_months"],
        recurring=signals["recurring"],
        health=signals["health"],
        flags=signals["flags"],
    )
