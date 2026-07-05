"""Wire the AlfaBattle third replication (eval/alfabattle_result.json) into the
served model card — additively and idempotently, same pattern as the corpus and
cross_check keys. Never rebuilds the card (the hand-hardened defense text stays).

Injects:
  * card["alfabattle"]                — the third-replication block (new Replication-tab card)
  * external_validity.populations    — an 'alfabattle' row before the not-validated 'saudi' row
  * performance_ledger.rows          — the two tagged AUCs (ledger discipline: no untagged numbers)
  * lineage 'Generalization' tier    — claim now cites both replications

Usage: python3 eval/wire_alfabattle.py
"""
from __future__ import annotations

import json
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
RESULT = Path(__file__).resolve().parent / "alfabattle_result.json"
CARDS = [
    Path(__file__).resolve().parent / "model_card.json",
    APP / "web" / "src" / "data" / "model_card.json",
    APP / "web" / "public" / "model_card.json",
]


def patch(card: dict, res: dict) -> bool:
    # Replace-not-skip: re-running after a bigger eval refreshes the numbers.
    prev = card.pop("alfabattle", None)
    if prev and prev.get("n_accounts") == res["n_accounts"]:
        card["alfabattle"] = prev
        return False  # same run already wired
    card["external_validity"]["populations"] = [
        p for p in card["external_validity"]["populations"] if p["key"] != "alfabattle"
    ]
    card["performance_ledger"]["rows"] = [
        r for r in card["performance_ledger"]["rows"]
        if not str(r.get("role", "")).startswith("third-replication")
    ]

    card["alfabattle"] = {
        "dataset": res["dataset"],
        "source": res["source"],
        "n_accounts": res["n_accounts"],
        "n_defaults": res["n_defaults"],
        "bad_rate": res["bad_rate"],
        "n_parts_used": res["n_parts_used"],
        "n_parts_total": res["n_parts_total"],
        "baseline": res["baseline"],
        "full": res["full"],
        "lift": res["lift"],
        "thin_file": res["thin_file"],
        "feature_mapping": res["feature_mapping"],
        "caveats": res["caveats"],
    }

    pops = card["external_validity"]["populations"]
    saudi_idx = next(i for i, p in enumerate(pops) if p["key"] == "saudi")
    pops.insert(saudi_idx, {
        "key": "alfabattle",
        "label": "AlfaBattle 2.0 — bank card transactions (2020s)",
        "n": f"{res['n_accounts']:,} applications · {res['n_defaults']:,} real defaults (first {res['n_parts_used']} of {res['n_parts_total']} public parts)",
        "role": "Independent replication — at scale",
        "finding": (
            f"Behaviour lift replicates at ~{round(res['n_accounts'] / 682, -2):,.0f}× Berka's n: +{res['lift']['auc']:.3f} AUC "
            f"(CI {res['lift']['ci_low']:+.3f}…{res['lift']['ci_high']:+.3f}) over the application-only view; "
            f"thin-file third {res['thin_file']['baseline_auc']:.2f}→{res['thin_file']['full_auc']:.2f}. "
            "Card stream (no balances) — feature-mapped like UCI."
        ),
    })

    rows = card["performance_ledger"]["rows"]
    ds = f"AlfaBattle 2.0 (real bank cards, n={res['n_accounts']:,})"
    rows.append({"value": res["baseline"]["auc"], "metric": "AUC", "headline": False,
                 "dataset": ds, "features": "application-only (product)",
                 "model": "logistic (class-balanced)", "split": "5-fold CV, out-of-fold",
                 "role": "third-replication baseline"})
    rows.append({"value": res["full"]["auc"], "metric": "AUC", "headline": False,
                 "dataset": ds, "features": "+14 mapped transaction-behaviour aggregates",
                 "model": "logistic (class-balanced)", "split": "5-fold CV, out-of-fold",
                 "role": "third-replication full"})

    for t in card["lineage"]["tiers"]:
        if t["tier"] == "Generalization":
            t["source"] = f"UCI Taiwan (30,000) + AlfaBattle 2.0 ({res['n_accounts']:,}) — both real, labeled"
            t["claim"] = (
                "Lift sign + significance replicate on two more real populations: "
                f"+0.13 (Taiwan cards) · +{res['lift']['auc']:.2f} (bank card stream at scale)"
            )
    return True


def main() -> None:
    res = json.loads(RESULT.read_text())
    for path in CARDS:
        card = json.loads(path.read_text())
        changed = patch(card, res)
        if changed:
            path.write_text(json.dumps(card, indent=2, ensure_ascii=False) + "\n")
        print(f"{'wired' if changed else 'already wired'}: {path.relative_to(APP)}")


if __name__ == "__main__":
    main()
