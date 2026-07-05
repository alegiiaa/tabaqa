"""D8 · Third replication — AlfaBattle 2.0 (real bank, ~1M labeled applications).

Source: https://huggingface.co/datasets/pytorch-lifestream/alfa-scoring-trx
(AlfaBattle 2.0 / ods.ai "dl-fintech-card-transactions" — real card-transaction
histories + real default labels, public and ungated).

The claim this replicates — stated with the same discipline as the UCI cross-check
(mechanism-transfer, NOT coefficient-transfer):

    transaction-behaviour features add material default signal over the
    application-only view, on a third real population at ~1M scale.

Honest scope, disclosed up front:
  * Card transactions, not full bank statements: amounts are normalized (amnt in
    [0,1]) and there are NO balances — so Tabaqa's balance features
    (avg/min_balance, nsf_count) are NOT computable here. Feature mapping below.
  * The baseline is the application-only view (product), deliberately weak —
    this dataset ships no bureau features, so the ablation reads
    "app-only vs +behaviour", not "bureau vs +behaviour".
  * income_flag semantics are inferred from data (the level whose transactions
    are largest and rarest = inflows) and reported in the output for audit.

Usage:  python3 eval/alfabattle.py            # uses all downloaded parts
Output: eval/alfabattle_result.json (additive; UI wiring is a separate step)
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler

APP = Path(__file__).resolve().parent.parent
DATA = APP / "data" / "external" / "alfabattle"
OUT = Path(__file__).resolve().parent / "alfabattle_result.json"

TRX_COLS = ["app_id", "amnt", "income_flag", "days_before", "weekofyear",
            "hour", "hour_diff", "ecommerce_flag", "mcc_category",
            "operation_type", "transaction_number"]

RNG = np.random.default_rng(7)
N_BOOT = 500


def infer_income_level(df: pd.DataFrame) -> int:
    """Pick the income_flag level that behaves like inflows: rare + large."""
    g = df.groupby("income_flag")["amnt"].agg(["mean", "size"])
    g["score"] = g["mean"] / g["mean"].max() - g["size"] / g["size"].max()
    return int(g["score"].idxmax())


def aggregate_part(path: Path, income_level: int | None) -> tuple[pd.DataFrame, int]:
    df = pd.read_parquet(path, columns=TRX_COLS)
    if income_level is None:
        income_level = infer_income_level(df)
    df["is_in"] = (df["income_flag"] == income_level)
    df["in_amt"] = df["amnt"].where(df["is_in"], 0.0)
    df["out_amt"] = df["amnt"].where(~df["is_in"], 0.0)

    g = df.groupby("app_id")
    feats = pd.DataFrame({
        "txn_count": g.size(),
        "active_days": g["days_before"].nunique(),
        "span_days": g["days_before"].max() - g["days_before"].min(),
        "amt_mean": g["amnt"].mean(),
        "amt_std": g["amnt"].std().fillna(0.0),          # spend-volatility proxy
        "inflow_sum": g["in_amt"].sum(),
        "outflow_sum": g["out_amt"].sum(),
        "inflow_n": g["is_in"].sum(),
        "ecom_share": g["ecommerce_flag"].apply(lambda s: (s == s.mode().iat[0]).mean() if len(s) else 0.0),
        "mcc_nunique": g["mcc_category"].nunique(),
        "hour_diff_mean": g["hour_diff"].mean(),          # burstiness
        "night_share": g["hour"].apply(lambda s: ((s <= 5) | (s >= 23)).mean()),
    })
    # weekly-inflow regularity: CV of weekly inflow sums (income_regularity proxy)
    win = df[df["is_in"]].groupby(["app_id", "weekofyear"])["amnt"].sum()
    wk = win.groupby("app_id").agg(["mean", "std", "size"])
    feats["inflow_week_cv"] = (wk["std"] / wk["mean"]).replace([np.inf, -np.inf], np.nan)
    feats["inflow_weeks"] = wk["size"]
    feats["inflow_week_cv"] = feats["inflow_week_cv"].fillna(feats["inflow_week_cv"].max() if feats["inflow_week_cv"].notna().any() else 0.0)
    feats["inflow_weeks"] = feats["inflow_weeks"].fillna(0)
    feats["io_ratio"] = feats["inflow_sum"] / feats["outflow_sum"].replace(0, np.nan)
    feats["io_ratio"] = feats["io_ratio"].fillna(0.0).clip(upper=feats["io_ratio"].quantile(0.99))
    return feats.reset_index(), income_level


def cv_auc(X: np.ndarray, y: np.ndarray, folds: int = 5) -> tuple[float, np.ndarray]:
    """5-fold out-of-fold predictions + pooled AUC (same recipe as berka_train)."""
    oof = np.zeros(len(y))
    skf = StratifiedKFold(n_splits=folds, shuffle=True, random_state=7)
    for tr, va in skf.split(X, y):
        sc = StandardScaler().fit(X[tr])
        m = LogisticRegression(max_iter=2000, class_weight="balanced")
        m.fit(sc.transform(X[tr]), y[tr])
        oof[va] = m.predict_proba(sc.transform(X[va]))[:, 1]
    return roc_auc_score(y, oof), oof


def boot_ci(y: np.ndarray, a: np.ndarray, b: np.ndarray, n: int = N_BOOT) -> tuple[float, float]:
    """Bootstrap CI of AUC(b) − AUC(a) on the pooled OOF predictions."""
    idx = np.arange(len(y))
    diffs = []
    for _ in range(n):
        s = RNG.choice(idx, size=len(idx), replace=True)
        if y[s].sum() == 0 or y[s].sum() == len(s):
            continue
        diffs.append(roc_auc_score(y[s], b[s]) - roc_auc_score(y[s], a[s]))
    lo, hi = np.percentile(diffs, [2.5, 97.5])
    return float(lo), float(hi)


def main() -> None:
    t0 = time.time()
    parts = sorted((DATA / "train_transactions").glob("*.parquet"))
    if not parts:
        raise SystemExit("no parquet parts downloaded yet")
    target = pd.read_csv(DATA / "train_target.csv.gz")

    income_level = None
    agg = []
    for p in parts:
        f, income_level = aggregate_part(p, income_level)
        agg.append(f)
        print(f"  {p.name}: {len(f):,} apps  ({time.time()-t0:.0f}s)")
    feats = pd.concat(agg, ignore_index=True).merge(target, on="app_id", how="inner")
    y = feats["flag"].to_numpy()
    print(f"apps: {len(feats):,} | bad rate: {y.mean():.4f} | income_flag level used as inflow: {income_level}")

    prod = pd.get_dummies(feats["product"], prefix="prod").to_numpy(dtype=float)
    fcols = [c for c in feats.columns if c not in ("app_id", "product", "flag")]
    Xtrx = feats[fcols].to_numpy(dtype=float)
    Xtrx = np.nan_to_num(Xtrx, nan=0.0, posinf=0.0, neginf=0.0)

    auc_base, oof_base = cv_auc(prod, y)
    auc_full, oof_full = cv_auc(np.hstack([prod, Xtrx]), y)
    lo, hi = boot_ci(y, oof_base, oof_full)
    print(f"baseline (product only) AUC {auc_base:.4f}  →  +behaviour AUC {auc_full:.4f}"
          f"  lift +{auc_full-auc_base:.4f}  CI [{lo:+.4f}, {hi:+.4f}]")

    # thin-file cut: shortest-history third by observed span (mirrors Berka/DATA_REPORT)
    thin = feats["span_days"] <= feats["span_days"].quantile(1 / 3)
    ty = y[thin.to_numpy()]
    t_base = roc_auc_score(ty, oof_base[thin.to_numpy()])
    t_full = roc_auc_score(ty, oof_full[thin.to_numpy()])
    print(f"thin-file third (span ≤ P33): baseline {t_base:.4f} → full {t_full:.4f}  (n={int(thin.sum()):,})")

    OUT.write_text(json.dumps({
        "dataset": "AlfaBattle 2.0 (real bank card transactions, ods.ai dl-fintech-card-transactions)",
        "source": "huggingface.co/datasets/pytorch-lifestream/alfa-scoring-trx (public, ungated)",
        "n_accounts": int(len(feats)),
        "n_defaults": int(y.sum()),
        "bad_rate": round(float(y.mean()), 5),
        "n_parts_used": len(parts),
        "n_parts_total": 50,
        "baseline": {"label": "Application-only view (product)", "auc": round(auc_base, 4)},
        "full": {"label": "+ transaction-behaviour layer (14 mapped features)", "auc": round(auc_full, 4)},
        "lift": {"auc": round(auc_full - auc_base, 4), "ci_low": round(lo, 4), "ci_high": round(hi, 4),
                 "n_boot": N_BOOT},
        "thin_file": {"definition": "shortest-history third by observed transaction span",
                      "n": int(thin.sum()), "baseline_auc": round(t_base, 4), "full_auc": round(t_full, 4)},
        "income_flag_level_inferred_as_inflow": income_level,
        "feature_mapping": [
            {"tabaqa": "income_regularity", "alfabattle": "weekly-inflow CV + inflow weeks (income_flag)"},
            {"tabaqa": "income_expense_ratio", "alfabattle": "inflow/outflow sum ratio (normalized amounts)"},
            {"tabaqa": "balance_volatility", "alfabattle": "NOT computable (no balances) — amount volatility stands in"},
            {"tabaqa": "avg/min_balance, nsf_count", "alfabattle": "NOT computable (card stream has no balance)"},
            {"tabaqa": "months_observed", "alfabattle": "active days + observed span"},
        ],
        "caveats": [
            "Card-transaction stream, not full bank statements: normalized amounts, no balances.",
            "Baseline is application-only (product) — this dataset ships no bureau features, so the ablation reads app-only vs +behaviour, weaker baseline than Berka's bureau-view.",
            "Mechanism replication only: sign and significance of the behaviour lift; magnitudes are population-specific (performance-ledger discipline).",
        ],
    }, indent=2))
    print(f"wrote {OUT} ({time.time()-t0:.0f}s total)")


if __name__ == "__main__":
    main()
