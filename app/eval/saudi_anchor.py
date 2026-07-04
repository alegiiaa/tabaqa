"""P1 Build 2 — the Saudi-anchored DEMONSTRATION population (DATA_DEFENSE.md).

Takes the 1M-account synthetic corpus (Gaussian copula learned on real Berka —
see corpus.py) and re-anchors its MONEY SCALE to verified, in-repo Saudi priors
(data/saudi_priors/ — every number cited to its source file, see SOURCES.md there).

The method is deliberately minimal so it cannot smuggle in fabricated structure:

  ONE global scale factor  s = SAR_MEDIAN_INCOME / median(corpus.distr_salary)

applied to the 5 money columns only. A single multiplicative rescale preserves
every ratio, rank, correlation and copula relationship of the validated source —
the SCALE becomes Saudi (SAR), the SHAPE remains Berka's, and we say so out loud.
Everything else (regularity, volatility, NSF counts, ratios) is unitless and
untouched.

HARD GUARDRAIL (the prime directive): this population yields NO accuracy number.
It exists for exactly two purposes: (a) the pipeline runs end-to-end on
Saudi-scale data, and (b) an honest demo/stress surface (e.g. the D5 percentile
ruler now compares an applicant's SAR min_balance against a SAR grid — fixing a
latent koruna-vs-SAR unit mismatch). The card block it writes is named
``demonstration_population`` and carries ``no_accuracy_claim: true``.

Run:  python3 eval/saudi_anchor.py        (after corpus.py; before/after harden_card.py — order-independent)
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

APP = Path(__file__).resolve().parent.parent
PRIORS = APP / "data" / "saudi_priors"
CORPUS = APP / "data" / "synthetic" / "corpus"
CORPUS_SAUDI = APP / "data" / "synthetic" / "corpus_saudi"
QUANTILES_OUT = APP / "scoring" / "corpus_quantiles.json"
CARD_PATHS = [
    APP / "eval" / "model_card.json",
    APP / "web" / "src" / "data" / "model_card.json",
    APP / "web" / "public" / "model_card.json",
]

# the 5 koruna-scale columns; every other feature is a unitless ratio/count
MONEY_COLS = ["avg_balance", "min_balance", "loan_amount", "loan_payments", "distr_salary"]

# ── verified Saudi priors (each cites its in-repo source file; see SOURCES.md) ─
# The ONE anchor used for the rescale:
SAR_MEDIAN_HOUSEHOLD_INCOME = 7362.0   # SAR/month, median household disposable income,
#   GASTAT Household Income & Consumption Expenditure Survey 2023
#   (data/saudi_priors/hies23_tables.xlsx; publication Feb 2025, n=122,325 households)

# Context priors rendered in the card block (NOT used to reshape anything):
HICES_EXPENSE_SHARES = [  # final monetary consumption shares, HICES 2023
    # (data/saudi_priors/hices2023.pdf)
    {"category": "Food & beverages", "share": 0.279},
    {"category": "Housing & utilities", "share": 0.141},
    {"category": "Restaurants & hotels", "share": 0.117},
    {"category": "Transport", "share": 0.105},
    {"category": "Clothing & footwear", "share": 0.096},
]
FINDEX_ACCOUNT_OWNERSHIP_2024 = 0.788  # World Bank Global Findex 2025 (data/saudi_priors/findex2025.csv)
FINDEX_BORROWED_FORMALLY_2024 = 0.305  # same source
SAMA_CONSUMER_LOANS_BN_Q1_2026 = 481.1  # SAR bn, SAMA Monthly Bulletin May 2026, table 13a
#   (data/saudi_priors/sama_bulletin_may2026.xlsx)
GASTAT_AVG_WAGE = {"saudi": 11034.0, "non_saudi": 3933.0}  # SAR/mo, GASTAT Labor Market
#   Statistics Q2 2025 (data/saudi_priors/lms_q2_2025.xlsx)


def load_income_deciles() -> list[dict]:
    """GASTAT HIES cube (database.stats.gov.sa) — 2024 income deciles, Kingdom level.

    Source file: data/saudi_priors/sel_decile.json (raw Flexmonster API response).
    Concept caveat (disclosed in the card): Kingdom-level individual income deciles,
    not crossed with nationality; the 2024 DB vintage is used for the distribution
    SHAPE display only — the headline anchor is the 2023 publication median.
    """
    raw = json.loads((PRIORS / "sel_decile.json").read_text(encoding="utf-8"))
    order = {"First": 1, "Second": 2, "Third": 3, "Fourth": 4, "Fifth": 5,
             "Sixth": 6, "Seventh": 7, "Eighth": 8, "Ninth": 9, "Tenth": 10}
    out = {}
    for agg in raw["aggs"]:
        keys = agg.get("keys", {})
        label = keys.get("INCOME_DECILES_ENGL", "")
        m = re.match(r"(\w+) decile", label)
        # keep only the pure-decile rows (skip nationality-crossed and totals)
        if m and m.group(1) in order and len(keys) == 1:
            out[order[m.group(1)]] = round(float(agg["values"]["OBS_VALUE"]["average"]), 1)
    deciles = [{"decile": d, "sar_month": out[d]} for d in sorted(out)]
    assert len(deciles) == 10, f"expected 10 deciles, parsed {len(deciles)}"
    return deciles


def load_gosi_bands() -> list[dict]:
    """GOSI 'Contributors by Contributory Wage' Q2 2025 (open.data.gov.sa).

    Source file: data/saudi_priors/gosi_wage.csv (Arabic headers, 6 wage bands).
    """
    rows = []
    with open(PRIORS / "gosi_wage.csv", encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            if not row or "~" not in row[0] and ">=" not in row[0]:
                continue
            band = row[0].strip()
            n = int(row[1].replace(",", "").replace('"', ""))
            rows.append({"band_sar": band.replace("~", "–"), "contributors": n})
    assert len(rows) == 6, f"expected 6 GOSI bands, parsed {len(rows)}"
    total = sum(r["contributors"] for r in rows)
    for r in rows:
        r["share"] = round(r["contributors"] / total, 4)
    return rows


def build_quantiles(df: pd.DataFrame) -> dict:
    """Regenerate the D5 percentile grid from the SAR-anchored population.

    Only min_balance actually changes (the other 5 ruler features are unitless) —
    this fixes the latent koruna-grid-vs-SAR-applicant unit mismatch in D5.
    """
    CASH = ["income_regularity", "income_expense_ratio", "min_balance",
            "nsf_count", "recurring_obligation_load", "balance_volatility"]
    HIB = {"income_regularity": True, "income_expense_ratio": True, "min_balance": True,
           "nsf_count": False, "recurring_obligation_load": False, "balance_volatility": False}
    grid = list(np.round(np.linspace(0, 1, 101), 2))
    out = {"n": int(len(df)), "grid": [round(g, 2) for g in grid], "features": {}}
    for f in CASH:
        qs = np.quantile(df[f].to_numpy(), grid)
        out["features"][f] = [round(float(v), 4) for v in qs]
    out["higher_is_better"] = HIB
    out["note"] = "money grid in SAR — Saudi-anchored demonstration population (eval/saudi_anchor.py)"
    return out


def main() -> None:
    df = pd.read_parquet(CORPUS)
    print(f"corpus: {len(df):,} accounts (Berka-scale)")

    czk_median_salary = float(df["distr_salary"].median())
    s = SAR_MEDIAN_HOUSEHOLD_INCOME / czk_median_salary
    print(f"scale anchor: SAR {SAR_MEDIAN_HOUSEHOLD_INCOME:,.0f} (GASTAT HIES 2023 median) "
          f"/ CZK {czk_median_salary:,.0f} (corpus median district salary) → s = {s:.4f}")

    saudi = df.copy()
    for col in MONEY_COLS:
        saudi[col] = (saudi[col] * s).round(2)

    # sanity: the rescale must not disturb any unitless feature or the label
    for col in ["income_regularity", "balance_volatility", "nsf_count", "bad"]:
        assert (saudi[col] == df[col]).all() or np.allclose(saudi[col], df[col])
    # sanity: ranks (and hence every correlation) are preserved on money columns
    assert (saudi["min_balance"].rank() == df["min_balance"].rank()).all()

    CORPUS_SAUDI.mkdir(parents=True, exist_ok=True)
    saudi.to_parquet(CORPUS_SAUDI / "corpus_saudi.parquet", index=False)
    print(f"wrote {CORPUS_SAUDI.relative_to(APP)}/corpus_saudi.parquet")

    q = build_quantiles(saudi)
    QUANTILES_OUT.write_text(json.dumps(q, separators=(",", ":")))
    print(f"D5 quantiles regenerated in SAR → {QUANTILES_OUT.name} "
          f"(min_balance median now SAR {q['features']['min_balance'][50]:,.0f})")

    seg = (saudi.groupby("segment")
           .agg(n=("bad", "size"), bad_rate=("bad", "mean"),
                median_min_balance_sar=("min_balance", "median"),
                median_avg_balance_sar=("avg_balance", "median"))
           .round({"bad_rate": 4, "median_min_balance_sar": 0, "median_avg_balance_sar": 0})
           .reset_index())

    block = {
        "name": "Saudi-anchored demonstration population",
        "no_accuracy_claim": True,
        "n_accounts": int(len(saudi)),
        "method": (
            "One global scale factor s = SAR 7,362 (GASTAT HIES 2023 median household "
            f"disposable income) / CZK {czk_median_salary:,.0f} (corpus median district salary) "
            f"= {s:.3f}, applied to the 5 money columns only. A single multiplicative rescale "
            "preserves every rank, ratio and correlation of the Berka-learned copula: the SCALE "
            "is Saudi (SAR), the SHAPE remains the validated Czech source — disclosed, not hidden. "
            "No Saudi default labels exist publicly, so this population carries NO accuracy claim; "
            "it exists so the pipeline demonstrably runs end-to-end on Saudi-scale data and so the "
            "percentile ruler compares SAR against SAR."
        ),
        "scale_factor": round(s, 4),
        "priors_used": [
            {"prior": "Median household disposable income — SAR 7,362/mo (THE scale anchor)",
             "source": "GASTAT HIES 2023 · data/saudi_priors/hies23_tables.xlsx"},
            {"prior": "Income deciles 2024 (distribution context, Kingdom level)",
             "source": "GASTAT database.stats.gov.sa HIES cube · data/saudi_priors/sel_decile.json"},
            {"prior": "Wage bands, 13.1M GOSI contributors Q2 2025 (segment context)",
             "source": "GOSI via open.data.gov.sa · data/saudi_priors/gosi_wage.csv"},
            {"prior": f"Avg wage Saudi SAR {GASTAT_AVG_WAGE['saudi']:,.0f} / non-Saudi {GASTAT_AVG_WAGE['non_saudi']:,.0f}",
             "source": "GASTAT Labor Market Statistics Q2 2025 · data/saudi_priors/lms_q2_2025.xlsx"},
            {"prior": f"Account ownership {FINDEX_ACCOUNT_OWNERSHIP_2024:.1%} · borrowed formally {FINDEX_BORROWED_FORMALLY_2024:.1%} (2024)",
             "source": "World Bank Global Findex 2025 · data/saudi_priors/findex2025.csv"},
            {"prior": f"Consumer loans outstanding SAR {SAMA_CONSUMER_LOANS_BN_Q1_2026}bn (Q1 2026)",
             "source": "SAMA Monthly Bulletin May 2026, table 13a · data/saudi_priors/sama_bulletin_may2026.xlsx"},
        ],
        "income_deciles_sar": load_income_deciles(),
        "gosi_wage_bands": load_gosi_bands(),
        "expense_shares": HICES_EXPENSE_SHARES,
        "segments_sar": seg.to_dict(orient="records"),
        "caveats": [
            "Distribution SHAPES (including balances and default correlations) remain those of the "
            "validated Czech Berka fit — only the money scale is Saudi. No observed Saudi balance or "
            "DBR distribution exists publicly; SAMA DBR figures are regulatory caps, not distributions.",
            "GASTAT 2024 decile cube is Kingdom-level individual income (not nationality-crossed); "
            "the 2023 publication median is used as the headline anchor per GASTAT vintage guidance.",
            "GOSI bands are contributory basic wage (excludes allowances), 82% in the lowest band.",
        ],
    }

    for path in CARD_PATHS:
        card = json.loads(path.read_text(encoding="utf-8"))
        card["demonstration_population"] = block
        path.write_text(json.dumps(card, indent=2))
        print(f"demonstration_population → {path.relative_to(APP)}")

    assert "auc" not in json.dumps(block).lower(), "guardrail: no accuracy metric may enter this block"
    print("\nGUARDRAIL OK: block contains no accuracy metric · no_accuracy_claim=true")


if __name__ == "__main__":
    main()
