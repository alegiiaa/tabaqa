#!/usr/bin/env python3
"""Regression / drift check for the enricher (NOT the headline number).

The synthesizer (`pipeline.synthesize.synthesize_fixture`) builds statements whose
narrations are constructed *so the real pipeline classifies every line correctly*
— salary as «راتب …», gig as «<PLATFORM> دفعة», p2p as «تحويل من …», obligations
as «قسط تمويل …», card spend as «مدى - نقاط بيع». That contract is exactly what
makes the persona gallery honest.

This script re-derives each row's *intended* label from how the synthesizer wrote
it, runs the real `enrich_all` + `reconcile`, and asserts they still agree across
every persona archetype (salaried_gig, gig_driver, sme_owner, thin_file). It is a
**drift guard**: if someone edits `enrich.py` and breaks a keyword, this goes red.

It is deliberately separate from `eval_enrich.py` — that one is the honest,
messy, real-world headline number; this one is a clean self-consistency check.

    python eval/eval_regression.py     # run from app/ ; exits non-zero on drift
"""
from __future__ import annotations

import sys
from pathlib import Path

# put app/ on the path so `import pipeline` / `import api` work from any cwd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import Transaction, synthesize_fixture, enrich_all, reconcile  # noqa: E402
from api.personas import _PERSONA_FORMS  # noqa: E402

# A Fahd-like salaried+gig archetype (the canonical reveal) plus the three gallery
# personas — covers all four archetypes named in api/personas.py.
SALARIED_GIG = ("Salaried + gig (the reveal)", {
    "name": "Fahd-like salaried gig",
    "months": 3,
    "bank": {"name": "alinma", "opening_balance": 8000},
    "wallet": {"name": "barq", "opening_balance": 300},
    "salary": {"monthly": 4000, "employer": "شركة الأفق للتجارة"},
    "gigs": [{"platform": "Jahez", "monthly": 3200},
             {"platform": "HungerStation", "monthly": 2000}],
    "p2p": [{"from": "عبدالله", "monthly": 800}],
    "obligations": [{"label": "قسط عقاري", "monthly": 800}],
    "monthly_spending": 600,
})

ARCHETYPES: dict[str, tuple[str, dict]] = {
    "salaried_gig": SALARIED_GIG,
    **_PERSONA_FORMS,
}


def intended_label(raw_desc: str, direction: str) -> str:
    """Re-derive the synthesizer's intent from the narration it emitted."""
    d = raw_desc.strip()
    if d.startswith("راتب"):
        return "salary"
    if d.startswith("قسط تمويل"):
        return "loan_obligation"
    if d == "مدى - نقاط بيع":
        return "purchase"
    if d.startswith("تحويل من"):
        return "p2p"
    if direction == "inflow" and d.endswith("دفعة"):
        return "gig_income"
    return "unknown"


def main() -> None:
    print("\n" + "=" * 64)
    print("  TABAQA ENRICHER — regression / drift check (synthesized)")
    print("=" * 64)

    total = 0
    consistent = 0
    failures: list[str] = []

    print(f"  {'archetype':16} {'rows':>5} {'consistent':>11}")
    for pid, (_role, form) in ARCHETYPES.items():
        fixture = synthesize_fixture({**form, "connection_id": f"con_{pid}"})
        rows = fixture["transactions"]
        txns = [Transaction.from_dict(r) for r in rows]
        enrich_all(txns)
        reconcile(txns)

        a_total = a_ok = 0
        for r, t in zip(rows, txns):
            want = intended_label(r["raw_desc"], r["direction"])
            a_total += 1
            if t.txn_type == want:
                a_ok += 1
            else:
                failures.append(
                    f"    [{pid}] «{r['raw_desc']}» ({r['direction']}) "
                    f"intended={want} got={t.txn_type}"
                )
        total += a_total
        consistent += a_ok
        flag = "OK" if a_ok == a_total else "DRIFT"
        print(f"  {pid:16} {a_total:5d} {f'{a_ok}/{a_total}':>11}  {flag}")

    rate = consistent / total if total else 0.0
    print("-" * 64)
    print(f"  overall self-consistency: {consistent}/{total} = {rate:.1%}")
    if failures:
        print("\n  DRIFT — the enricher no longer matches the synthesizer contract:")
        print("\n".join(failures))
    print("=" * 64 + "\n")

    if consistent != total:
        raise SystemExit(1)
    print("✓ no drift — enrich_all + reconcile match the synthesizer on every persona\n")


if __name__ == "__main__":
    main()
