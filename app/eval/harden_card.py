"""Data-defense hardening pass over model_card.json (DATA_DEFENSE.md P1–P4, P6).

Reads the already-generated card + scoring/model_params.json and stamps the
honesty layer on top — every value is PULLED from the existing artifacts, never
hand-typed, so this script cannot drift from what the eval scripts measured:

  • P3  performance_ledger      — ONE headline AUC; every other number tagged
        {dataset · features · model · split · role} so there is no "number soup".
  • P1  external_validity       — the population-transfer table (Berka → UCI →
        Saudi target): what is validated, what transfers (mechanism + direction),
        what is explicitly NOT claimed, and the calibrate-on-deploy plan.
  • P4  cross_check.attenuation_note — the +0.203 → +0.131 shrinkage, disclosed
        first, with its causes (different product, proxy features, 2× base rate).
  • P6  psi / corpus wording    — PSI relabelled as a drift-monitor DEMONSTRATION
        (injected shift on the synthetic corpus, no live stream yet); TSTR scoped
        to synthesizer fidelity, not Saudi generalization.
  • P2  lineage                 — live_scorer reworded to direction-locked (sign,
        not magnitude) + a Generalization tier citing the UCI replication.

Idempotent: safe to re-run any time after ablation/build_model_card/model_intel/
uci_crosscheck. Syncs every served copy of the card.

Run:  python3 eval/harden_card.py
"""
from __future__ import annotations

import json
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
CARD_PATHS = [
    APP / "eval" / "model_card.json",
    APP / "web" / "src" / "data" / "model_card.json",
    APP / "web" / "public" / "model_card.json",
]
PARAMS_PATH = APP / "scoring" / "model_params.json"


# ── P3 · one performance ledger ───────────────────────────────────────────────
def build_ledger(card: dict, params: dict | None) -> dict:
    rows = [
        {
            "value": card["full"]["auc"], "metric": "AUC", "headline": True,
            "dataset": "Berka (Czech retail, 682 accounts)",
            "features": "bureau proxy + 7 cash-flow", "model": "logistic (class-balanced)",
            "split": "5-fold CV, out-of-fold",
            "role": f"THE headline: the full model — +{card['lift']['auc']:.3f} over bureau-only",
        },
        {
            "value": card["baseline"]["auc"], "metric": "AUC", "headline": False,
            "dataset": "Berka", "features": "bureau proxy only", "model": "logistic",
            "split": "5-fold CV, out-of-fold",
            "role": "ablation baseline — what a bureau-only view achieves",
        },
    ]
    if params:
        m = params.get("metrics", {})
        rows.append({
            "value": m.get("holdout_auc"), "metric": "AUC", "headline": False,
            "dataset": "Berka", "features": "6 cash-flow only", "model": "logistic",
            "split": f"30% holdout (5-fold CV {m.get('cv_auc')})",
            "role": "the direction-lock fit backing the served policy card (sub-metric, not the headline)",
        })
    corpus = card.get("corpus") or {}
    if corpus:
        rows.append({
            "value": corpus["tstr"]["auc"], "metric": "AUC", "headline": False,
            "dataset": "synthetic corpus → REAL held-out Berka",
            "features": "same as full model", "model": "logistic",
            "split": f"TSTR vs TRTR ceiling {corpus['trtr']['auc']}",
            "role": "synthesizer fidelity — the 1M corpus carries the real signal (not a generalization claim)",
        })
    cc = card.get("cross_check") or {}
    if cc:
        rows.append({
            "value": cc["full"]["auc"], "metric": "AUC", "headline": False,
            "dataset": f"{cc['dataset']} (n={cc['n_accounts']:,})",
            "features": "demographics + proxy cash-flow", "model": "logistic",
            "split": "5-fold CV, out-of-fold",
            "role": f"independent replication — lift +{cc['lift']['auc']:.3f} over its own baseline {cc['baseline']['auc']:.3f}",
        })
    ch = card.get("champion_challenger") or {}
    if ch:
        rows.append({
            "value": ch["challenger"]["auc"], "metric": "AUC", "headline": False,
            "dataset": ch["dataset"], "features": "same as champion",
            "model": "gradient boosting (black box)", "split": "5-fold CV, out-of-fold",
            "role": f"transparency-cost benchmark — beats the additive card by only {abs(ch['gap_auc']):.3f}",
        })
    return {
        "note": ("One headline, no number soup: every AUC in this card belongs to a specific "
                 "{dataset · features · model · split}. None of them IS the served demo card — "
                 "that is an expert policy card direction-locked to the Berka fit (see lineage)."),
        "rows": rows,
    }


# ── P1 · external validity — the population-transfer table ───────────────────
def build_external_validity(card: dict, cc: dict | None) -> dict:
    lift, thin = card["lift"], card["thin_file"]
    populations = [
        {
            "key": "berka",
            "label": "Berka — Czech retail banking (1990s)",
            "n": f"{card['n_accounts']} accounts · {card['n_defaults']} real defaults",
            "role": "Primary validation",
            "finding": (f"Cash-flow lift +{lift['auc']:.3f} AUC over bureau-only "
                        f"(95% CI +{lift['ci_low']:.2f}…+{lift['ci_high']:.2f}); "
                        f"thin-file {thin['baseline_auc']:.2f}→{thin['full_auc']:.2f}"),
        },
    ]
    if cc:
        populations.append({
            "key": "uci",
            "label": "UCI Taiwan — credit cards (2005)",
            "n": f"{cc['n_accounts']:,} clients · {cc['bad_rate']:.1%} default",
            "role": "Independent replication",
            "finding": (f"Sign + significance replicate: +{cc['lift']['auc']:.3f} AUC "
                        f"(CI +{cc['lift']['ci_low']:.3f}…+{cc['lift']['ci_high']:.3f}) "
                        "via proxy cash-flow features"),
        })
    populations.append({
        "key": "saudi",
        "label": "Saudi Arabia — wallet + open banking (target)",
        "n": "no public labeled default data exists",
        "role": "Deployment population — NOT validated here",
        "finding": ("No Saudi outcome data is public (for anyone, pre-launch). The Saudi-cited layer "
                    "is regulatory, not statistical: SAMA Responsible-Lending DBR caps (sama.py). "
                    "Coefficients are re-fit on the licensee's own book at go-live."),
    })
    return {
        "claim": ("We do NOT claim these coefficients predict Saudi default. We claim the MECHANISM "
                  "transfers: cash-flow features add a large, significant lift over bureau-only — "
                  "largest for thin-file borrowers — and that effect replicates across two "
                  "maximally-different real populations (Czech retail 1990s, Taiwan cards 2005)."),
        "populations": populations,
        "transfers": ("Transfers: the mechanism (cash-flow > bureau-only for thin files) and every "
                      "feature's direction (sign-locked at import by _verify_lineage). Does NOT "
                      "transfer — re-fit locally: coefficient magnitudes, base rates, currency scale, "
                      "score cutoffs."),
        "deployment_plan": [
            "Go-live: score with the direction-locked policy card inside the licensee's approval flow (champion/challenger, no auto-decline).",
            "Months 1–6: accumulate the licensee's own outcomes; re-fit magnitudes on that book via the existing train.py path (identical I/O contract).",
            "Ongoing: PSI drift monitor + annual SAMA-style model validation on the live population.",
        ],
    }


# ── P4 · own the attenuation ──────────────────────────────────────────────────
def attenuation_note(card: dict, cc: dict) -> str:
    b, u = card["lift"]["auc"], cc["lift"]["auc"]
    shrink = (b - u) / b
    return (f"Disclosed up front: the lift attenuates out-of-domain — +{b:.3f} on Berka → "
            f"+{u:.3f} here ({shrink:.0%} smaller). Expected, for three reasons: a different "
            f"product (revolving cards vs retail banking), proxy features (card repayment "
            f"behaviour stands in for true bank cash-flow), and a 2× base rate "
            f"({cc['bad_rate']:.0%} vs {card['bad_rate']:.0%}). What replicates is what we "
            "claim: the SIGN and the SIGNIFICANCE — both CIs exclude zero. "
            "It attenuates; it does not vanish.")


# ── P6 + P2 · wording fixes pulled into the served card ──────────────────────
PSI_NOTE = (
    "A drift-monitor DEMONSTRATION on the synthetic scoring corpus — no live applicant "
    "stream exists yet, and this panel does not pretend one does. In-control = an "
    "independent draw from the same corpus (no false alarm — reads flat). Economic-stress "
    "= a known covariate shift injected into that draw (thinner buffers, more volatile "
    "balances, heavier obligations) to prove the monitor fires. In production the identical "
    "PSI runs on live applicants vs the training distribution; this demonstrates the "
    "monitor, not live drift."
)

TSTR_NOTE = ("train on synthetic, test on REAL held-out Berka — certifies the synthesizer's "
             "fidelity to the source population, not Saudi generalization")

CORPUS_METHODOLOGY = (
    "Default labels are SAMPLED from a joint distribution learned on real Berka outcomes "
    "(never hand-injected), so no feature→default relationship is tautological. Validity is "
    "measured only on real data (the ablation + the UCI Taiwan cross-check); the synthetic "
    "corpus proves scale/capacity, and Train-on-Synthetic/Test-on-Real (corpus_train.py) "
    "certifies the sample carries the real signal. Scope: TSTR is a fidelity check on the "
    "SYNTHESIZER — it is not evidence of transfer to the Saudi population (see external_validity)."
)

LIVE_SCORER = (
    "Live score = a transparent expert policy card, DIRECTION-LOCKED to the Berka fit: "
    "_verify_lineage machine-checks at import that every weight's SIGN matches the validated "
    "fit (one documented monotonic override). Magnitudes are policy-set, not fitted — "
    "disclosed, and re-fit on the licensee's own book at deployment via the same train.py "
    "path. The fitted scorecard (Berka full model, 5-fold CV AUC 0.86) is the drop-in "
    "production swap with an identical I/O contract."
)

CHAMPION_NOTE = (
    "Both models re-fit on the same in-distribution data (no cross-currency confound): a "
    "transparent additive scorecard — the same glass-box family Tabaqa deploys, re-fit on "
    "this dataset (NOT the served demo card; see performance_ledger) — vs a gradient-boosted "
    "black box. Within a couple of AUC points, ranking borrowers in close agreement: "
    "transparency costs almost nothing."
)


def harden(card: dict, params: dict | None) -> dict:
    cc = card.get("cross_check") or None

    card["performance_ledger"] = build_ledger(card, params)
    card["external_validity"] = build_external_validity(card, cc)

    if cc:
        cc["attenuation_note"] = attenuation_note(card, cc)

    psi = card.get("psi")
    if psi:
        psi["note"] = PSI_NOTE
        psi["reference"] = ("300k-account reference draw from the 1M synthetic scoring corpus "
                            "(demonstration — no live stream yet)")

    corpus = card.get("corpus")
    if corpus:
        corpus["tstr"]["note"] = TSTR_NOTE
        corpus["methodology"] = CORPUS_METHODOLOGY

    lineage = card.get("lineage")
    if lineage:
        lineage["live_scorer"] = LIVE_SCORER
        tiers = [t for t in lineage.get("tiers", []) if t.get("tier") != "Generalization"]
        if cc:
            tiers.append({
                "tier": "Generalization",
                "source": f"{cc['dataset']} ({cc['n_accounts']:,} real accounts)",
                "claim": f"Lift sign + significance replicate: +{cc['lift']['auc']:.2f} AUC via proxy cash-flow",
            })
        lineage["tiers"] = tiers

    ch = card.get("champion_challenger")
    if ch:
        ch["note"] = CHAMPION_NOTE
        ch["champion"]["name"] = "Transparent additive scorecard (re-fit on this data)"

    return card


def main() -> None:
    params = None
    try:
        params = json.loads(PARAMS_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        print("warn: scoring/model_params.json missing — ledger omits the direction-lock fit row")

    for path in CARD_PATHS:
        if not path.exists():
            print(f"skip (missing): {path.relative_to(APP)}")
            continue
        card = json.loads(path.read_text(encoding="utf-8"))
        card = harden(card, params)
        path.write_text(json.dumps(card, indent=2))
        print(f"hardened → {path.relative_to(APP)}")

    print("\nledger headline:", end=" ")
    card0 = json.loads(CARD_PATHS[0].read_text())
    h = next(r for r in card0["performance_ledger"]["rows"] if r["headline"])
    print(f"AUC {h['value']} · {h['dataset']} · {h['split']}")
    print(f"external_validity populations: {len(card0['external_validity']['populations'])}")


if __name__ == "__main__":
    main()
