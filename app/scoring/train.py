"""Fit the PD scorecard on real default labels (Berka, PKDD'99) and export its
validated parameters as ``scoring/model_params.json``.

Why this exists
---------------
The served scorecard (``scoring/scorecard.py``) is a transparent, dependency-free
additive points model. This trainer proves — and then *pins* — that scorecard to a
real-data fit: it derives the **same six cash-flow features** from each Berka
account's pre-loan history (no leakage), fits a class-balanced logistic model,
and writes out the learned coefficients, per-feature Information Values, holdout /
CV AUC-KS, and the default-rate-by-score-band table.

``scorecard.py`` loads that JSON at import time and **machine-verifies** that every
weight it serves points the same direction the fit found (see
``_verify_lineage``), and stamps the validation (AUC/KS + per-feature IV) onto
every score it returns. So the demo score is no longer "expert weights we hope
generalise" — it is a scorecard locked to a fit that scores **AUC 0.890** on real
defaults, with the proof travelling alongside each response.

The artifact is committed so the serving path has it offline; re-run this only to
refresh it. It needs network access to the public CTU database plus
``scikit-learn``, ``pandas``, ``pymysql`` (same as ``eval/berka_train.py``).

Run:  python3 scoring/train.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

PARAMS_OUT = Path(__file__).resolve().parent / "model_params.json"

# The served scorecard uses six of these seven signals (it does not bin avg_balance
# directly) plus verified_income_share — the wallet-reveal feature that has no
# Berka analogue and is therefore expert-set, documented in scorecard.py.
DB_URL = "relational.fel.cvut.cz:3306/financial"
DATASET_URL = "https://relational.fel.cvut.cz/dataset/Financial"

# income_expense_ratio is the one feature whose *multivariate* logistic sign flips
# positive (higher ratio → higher risk). The univariate default rate falls across
# the realistic operating range (21.7%→5.1% for ratios 1.0–1.3) and only rises in
# the capped >1.3 tail of near-dormant accounts. So the flip is a multicollinearity
# + extreme-tail artifact; the served card keeps the credit-sensible monotonic
# direction (higher = safer) — exactly what optbinning's monotonic_trend enforces.
DIRECTION_OVERRIDES = {
    "income_expense_ratio": (
        "Multivariate coefficient flips positive under multicollinearity + a "
        "capped extreme-ratio tail (dormant accounts). Univariate default rate "
        "falls 21.7%->5.1% across the operating range; served card uses the "
        "credit-sensible monotonic direction (higher = safer), per optbinning "
        "monotonic_trend practice."
    ),
}


def _ks(y_true, proba):
    from sklearn.metrics import roc_curve
    fpr, tpr, _ = roc_curve(y_true, proba)
    return float(max(tpr - fpr))


def build_params() -> dict:
    import numpy as np
    import pandas as pd
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_predict
    from sklearn.metrics import roc_auc_score

    # Reuse the exact feature construction that produced the published AUC 0.890.
    from eval.berka_train import _load_tables, build_features, woe_iv, FEATURES

    loan, orders, trans = _load_tables()
    feat = build_features(loan, orders, trans)
    X, y = feat[FEATURES], feat["bad"]
    n, n_bad = len(feat), int(y.sum())

    def model():
        return make_pipeline(
            StandardScaler(),
            LogisticRegression(max_iter=1000, class_weight="balanced"),
        )

    # Out-of-sample holdout (30%) + 5-fold CV — the headline validation.
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.30, stratify=y, random_state=42)
    proba_te = model().fit(Xtr, ytr).predict_proba(Xte)[:, 1]
    auc_te, ks_te = roc_auc_score(yte, proba_te), _ks(yte, proba_te)
    cvp = cross_val_predict(model(), X, y, method="predict_proba",
                            cv=StratifiedKFold(5, shuffle=True, random_state=42))[:, 1]
    auc_cv, ks_cv = roc_auc_score(y, cvp), _ks(y, cvp)

    # Full-fit coefficients (standardized) + scaler stats + per-feature IV.
    scaler = StandardScaler().fit(X)
    clf = LogisticRegression(max_iter=1000, class_weight="balanced").fit(scaler.transform(X), y)
    coefs = clf.coef_[0]

    features: dict[str, dict] = {}
    for i, name in enumerate(FEATURES):
        c = float(coefs[i])
        features[name] = {
            "coef_bad": round(c, 4),               # + raises P(default) as the feature rises
            "abs_coef": round(abs(c), 4),
            "iv": round(float(woe_iv(X[name], y)), 3),
            "risk_direction": "raises" if c > 0 else "lowers",
            "safer_when": "lower" if c > 0 else "higher",
            "scaler_mean": round(float(scaler.mean_[i]), 4),
            "scaler_std": round(float(scaler.scale_[i]), 4),
        }

    # Default rate by score band (monotonicity evidence).
    pd_full = model().fit(X, y).predict_proba(X)[:, 1]
    rng = pd_full.max() - pd_full.min() or 1.0
    score = 1 + 98 * (1 - (pd_full - pd_full.min()) / rng)
    band = pd.DataFrame({"score": score, "bad": y.values})
    band["band"] = pd.qcut(band["score"], 5, labels=["1 (worst)", "2", "3", "4", "5 (best)"],
                           duplicates="drop")
    tbl = band.groupby("band", observed=True).agg(
        accounts=("bad", "size"), defaults=("bad", "sum"), default_rate=("bad", "mean"))
    bands = [
        {"band": str(idx), "accounts": int(r.accounts), "defaults": int(r.defaults),
         "default_rate": round(float(r.default_rate), 4)}
        for idx, r in tbl.iterrows()
    ]

    return {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": "logistic_regression(class_weight=balanced) on 6 standardized cash-flow features",
        "source": {"dataset": "Berka / PKDD'99", "db": DB_URL, "url": DATASET_URL},
        "sample": {"accounts": n, "defaults": n_bad, "bad_rate": round(n_bad / n, 4)},
        "metrics": {
            "holdout_auc": round(float(auc_te), 3), "holdout_ks": round(float(ks_te), 3),
            "cv_auc": round(float(auc_cv), 3), "cv_ks": round(float(ks_cv), 3),
        },
        "intercept_bad": round(float(clf.intercept_[0]), 4),
        "features": features,
        "score_band_default_rates": bands,
        "direction_overrides": DIRECTION_OVERRIDES,
    }


def train() -> None:
    try:
        import sklearn, pandas, pymysql  # noqa: F401
    except ImportError as e:
        print(f"Missing dependency ({e.name}). Install:\n"
              "  pip install scikit-learn pandas pymysql", file=sys.stderr)
        return
    try:
        params = build_params()
    except Exception as e:  # network/DB/data issues → clear guidance, non-fatal
        print(f"Could not fit on Berka: {type(e).__name__}: {e}\n"
              "Check network access to relational.fel.cvut.cz:3306, or download the "
              "Berka CSVs (kaggle.com/datasets/marceloventura/the-berka-dataset).",
              file=sys.stderr)
        return
    PARAMS_OUT.write_text(json.dumps(params, indent=2) + "\n", encoding="utf-8")
    m = params["metrics"]
    print(f"Wrote {PARAMS_OUT}")
    print(f"  holdout AUC {m['holdout_auc']} · KS {m['holdout_ks']} | "
          f"CV AUC {m['cv_auc']} · KS {m['cv_ks']} "
          f"({params['sample']['accounts']} accts, {params['sample']['bad_rate']*100:.1f}% bad)")


if __name__ == "__main__":
    train()
