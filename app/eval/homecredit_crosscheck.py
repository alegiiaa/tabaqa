"""D6 · Home Credit cross-check — replicate the wallet-layer lift on a SECOND real dataset.

The model card already proves the cash-flow lift on real Berka defaults. This script
repeats the same ablation on the **Home Credit Default Risk** data (Kaggle, ~307k real
labelled applications) so the card can say "replicated on a second real dataset" — the
single most credibility-buying line in the panel.

STATUS: ready to run, PENDING DATA. It is intentionally gated: with no CSVs present it
prints where to drop them and exits, and model_card.json["cross_check"] stays null (the
panel hides the section). We do NOT synthesise a fake "second dataset" — that would defeat
the entire point of an independent replication.

    1. Download from  https://www.kaggle.com/c/home-credit-default-risk/data
    2. Put application_train.csv + installments_payments.csv in  app/data/homecredit/
    3. python3 eval/homecredit_crosscheck.py   →  merges cross_check into model_card.json

Method (mirrors eval/ablation.py):
  • baseline  = application demographics + credit terms (a bureau-baseline analogue)
  • +cashflow = baseline + payment-behaviour features engineered from installments_payments
                (payment regularity, late-payment rate, instalment/income load, volatility)
                — the Home Credit proxies for Tabaqa's transaction cash-flow features
  • report out-of-fold AUC(baseline) vs AUC(+cashflow) + a bootstrap CI on the lift.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
HC_DIR = APP / "data" / "homecredit"
CARD_PATHS = [APP / "eval" / "model_card.json", APP / "web" / "src" / "data" / "model_card.json"]

# Tabaqa cash-flow feature → the Home Credit payment-behaviour proxy that stands in for it.
FEATURE_MAPPING = [
    {"tabaqa": "income_regularity", "homecredit": "payment regularity (1 − late-payment rate)"},
    {"tabaqa": "recurring_obligation_load", "homecredit": "AMT_ANNUITY ÷ AMT_INCOME_TOTAL"},
    {"tabaqa": "nsf_count", "homecredit": "count of instalments paid late"},
    {"tabaqa": "balance_volatility", "homecredit": "std of (paid ÷ due) across instalments"},
    {"tabaqa": "income_expense_ratio", "homecredit": "AMT_INCOME_TOTAL ÷ AMT_CREDIT"},
]


def _missing() -> bool:
    need = ["application_train.csv", "installments_payments.csv"]
    return not all((HC_DIR / f).exists() for f in need)


def run() -> dict:
    import numpy as np
    import pandas as pd
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import cross_val_predict
    from sklearn.metrics import roc_auc_score
    from scipy.stats import ks_2samp  # noqa: F401  (KS via helper below)

    app = pd.read_csv(HC_DIR / "application_train.csv")
    inst = pd.read_csv(HC_DIR / "installments_payments.csv")

    # ── baseline: application demographics + credit terms (bureau-baseline analogue) ──
    base_cols = ["AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY", "DAYS_BIRTH",
                 "DAYS_EMPLOYED", "CNT_FAM_MEMBERS", "REGION_POPULATION_RELATIVE"]
    df = app[["SK_ID_CURR", "TARGET"] + base_cols].copy()

    # ── +cashflow: payment-behaviour features from installments_payments ──
    inst["late"] = (inst["DAYS_ENTRY_PAYMENT"] > inst["DAYS_INSTALMENT"]).astype(float)
    inst["paid_ratio"] = inst["AMT_PAYMENT"] / inst["AMT_INSTALMENT"].replace(0, np.nan)
    g = inst.groupby("SK_ID_CURR").agg(
        late_rate=("late", "mean"),
        n_late=("late", "sum"),
        paid_ratio_std=("paid_ratio", "std"),
        paid_ratio_mean=("paid_ratio", "mean"),
    ).reset_index()
    g["payment_regularity"] = 1.0 - g["late_rate"]
    df = df.merge(g, on="SK_ID_CURR", how="left")
    df["obligation_load"] = df["AMT_ANNUITY"] / df["AMT_INCOME_TOTAL"].replace(0, np.nan)
    df["income_credit_ratio"] = df["AMT_INCOME_TOTAL"] / df["AMT_CREDIT"].replace(0, np.nan)

    cash_cols = ["payment_regularity", "n_late", "paid_ratio_std", "paid_ratio_mean",
                 "obligation_load", "income_credit_ratio"]
    df = df.fillna(df.median(numeric_only=True))
    y = df["TARGET"].to_numpy()

    def oof_auc(cols):
        X = df[cols].to_numpy()
        clf = LogisticRegression(max_iter=1000, class_weight="balanced")
        p = cross_val_predict(clf, X, y, cv=5, method="predict_proba")[:, 1]
        return roc_auc_score(y, p), p

    auc_base, _ = oof_auc(base_cols)
    auc_full, _ = oof_auc(base_cols + cash_cols)

    # bootstrap CI on the lift
    rng = np.random.default_rng(42)
    Xb = df[base_cols].to_numpy(); Xf = df[base_cols + cash_cols].to_numpy()
    from sklearn.model_selection import cross_val_predict as cvp
    pb = cvp(LogisticRegression(max_iter=1000, class_weight="balanced"), Xb, y, cv=5, method="predict_proba")[:, 1]
    pf = cvp(LogisticRegression(max_iter=1000, class_weight="balanced"), Xf, y, cv=5, method="predict_proba")[:, 1]
    lifts = []
    n = len(y)
    for _ in range(300):
        idx = rng.integers(0, n, n)
        if y[idx].sum() == 0 or y[idx].sum() == len(idx):
            continue
        lifts.append(roc_auc_score(y[idx], pf[idx]) - roc_auc_score(y[idx], pb[idx]))
    lifts = np.array(lifts)

    return {
        "dataset": "Home Credit Default Risk (Kaggle)",
        "n_accounts": int(len(df)),
        "n_defaults": int(y.sum()),
        "bad_rate": round(float(y.mean()), 4),
        "baseline": {"auc": round(float(auc_base), 3), "ks": None},
        "full": {"auc": round(float(auc_full), 3), "ks": None},
        "lift": {
            "auc": round(float(auc_full - auc_base), 3),
            "ci_low": round(float(np.percentile(lifts, 2.5)), 3),
            "ci_high": round(float(np.percentile(lifts, 97.5)), 3),
            "p_gt_0": round(float((lifts > 0).mean()), 3),
        },
        "feature_mapping": FEATURE_MAPPING,
        "caveats": [
            "Independent replication on a second real labelled dataset. Home Credit has no "
            "wallet feed, so payment-behaviour features stand in as the cash-flow proxy — the "
            "lift is directional evidence the mechanism generalises beyond Berka, not a like-"
            "for-like wallet result.",
        ],
    }


def main() -> None:
    if _missing():
        print("Home Credit cross-check: PENDING DATA — no CSVs found.")
        print(f"  Drop application_train.csv + installments_payments.csv into  {HC_DIR.relative_to(APP)}/")
        print("  (https://www.kaggle.com/c/home-credit-default-risk/data)")
        print("  cross_check stays null; the model-card section stays hidden. Nothing faked.")
        sys.exit(0)

    cc = run()
    print(f"cross-check: baseline AUC {cc['baseline']['auc']} → +cashflow {cc['full']['auc']} "
          f"(+{cc['lift']['auc']}, 95% CI {cc['lift']['ci_low']}…{cc['lift']['ci_high']})")
    for path in CARD_PATHS:
        card = json.loads(path.read_text())
        card["cross_check"] = cc
        path.write_text(json.dumps(card, indent=2))
        print(f"merged into {path.relative_to(APP)}")


if __name__ == "__main__":
    main()
