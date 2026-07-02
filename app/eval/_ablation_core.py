"""Shared nested-ablation metric engine.

The exact schema ``ablation.run()`` emits, factored into ONE pure function so the
synthetic corpus (``corpus.py``) and the Home-Credit cross-check (``homecredit.py``)
can emit an *identical* ``model_card.json`` block on their own data — same shape,
same rigor, same UI consumer.

``ablation.run()`` is deliberately left untouched (it powers the live Model panel);
this module re-packages the same computation as a parameterized, dataset-agnostic
function. Reuses ``ablation._model/_ks/_roc_pts`` and ``berka_train.woe_iv`` verbatim
so the numbers are byte-for-byte comparable to the flagship card.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ablation import _model, _ks, _roc_pts  # noqa: E402
from berka_train import woe_iv  # noqa: E402


def nested_ablation(
    df,
    baseline_cols,
    cashflow_cols,
    *,
    y_col: str = "bad",
    thin_col: str | None = "pre_months",
    baseline_label: str | None = None,
    full_label: str | None = None,
    approval_rate: float = 0.60,
    thin_quantile: float = 0.33,
    n_boot: int = 3000,
    seed: int = 42,
) -> dict:
    """Run the controlled nested ablation and return the model-card block dict.

    ``FULL = BASELINE + cashflow_cols`` on the SAME rows (no confound). Every metric
    is out-of-sample (5-fold CV). Mirrors ``ablation.run()`` exactly, parameterized
    so any dataset (Berka, synthetic corpus, Home Credit) emits the same schema.
    """
    import numpy as np
    import pandas as pd
    from sklearn.metrics import brier_score_loss, roc_auc_score
    from sklearn.model_selection import StratifiedKFold, cross_val_predict

    baseline_cols = list(baseline_cols)
    cashflow_cols = list(cashflow_cols)
    cols = baseline_cols + cashflow_cols

    d = df.dropna(subset=cols + [y_col]).reset_index(drop=True)
    y = d[y_col].astype(int)
    yv = y.values
    Xb = d[baseline_cols]
    Xf = d[cols]  # nested: baseline + wallet layer
    n, n_bad = len(d), int(y.sum())
    if n == 0 or n_bad == 0 or n_bad == n:
        raise ValueError(f"degenerate ablation set: n={n}, n_bad={n_bad}")

    # out-of-sample predictions for EVERY account (same folds → paired comparison)
    skf = StratifiedKFold(5, shuffle=True, random_state=seed)
    pb = cross_val_predict(_model(), Xb, y, cv=skf, method="predict_proba")[:, 1]
    pf = cross_val_predict(_model(), Xf, y, cv=skf, method="predict_proba")[:, 1]

    auc_b, auc_f = roc_auc_score(yv, pb), roc_auc_score(yv, pf)
    ks_b, ks_f = _ks(yv, pb), _ks(yv, pf)
    lift = auc_f - auc_b

    # bootstrap 95% CI on the PAIRED AUC lift (naively differencing two AUCs is a trap)
    rng = np.random.default_rng(seed)
    lifts = []
    for _ in range(n_boot):
        s = rng.integers(0, n, n)
        ys = yv[s]
        if ys.min() == ys.max():
            continue
        lifts.append(roc_auc_score(ys, pf[s]) - roc_auc_score(ys, pb[s]))
    lifts = np.array(lifts)
    if len(lifts):
        ci_lo, ci_hi = float(np.percentile(lifts, 2.5)), float(np.percentile(lifts, 97.5))
        p_gt0 = float((lifts > 0).mean())
    else:
        ci_lo = ci_hi = p_gt0 = None

    # thin-file conditional (bureau's blind spot) — skipped if no thin column
    thin_block = None
    if thin_col and thin_col in d.columns:
        thr = float(np.quantile(d[thin_col], thin_quantile))
        thin = (d[thin_col] <= thr).values
        two = lambda m: len(set(yv[m])) > 1  # noqa: E731
        tb = roc_auc_score(yv[thin], pb[thin]) if two(thin) else None
        tf = roc_auc_score(yv[thin], pf[thin]) if two(thin) else None
        thin_block = {
            "definition": f"shortest-history third (≤ {thr:.0f} {thin_col})",
            "n": int(thin.sum()), "n_defaults": int(yv[thin].sum()),
            "baseline_auc": round(tb, 4) if tb else None,
            "full_auc": round(tf, 4) if tf else None,
            "baseline_roc": _roc_pts(yv[thin], pb[thin]) if tb else [],
            "full_roc": _roc_pts(yv[thin], pf[thin]) if tf else [],
        }

    # swap-set at a fixed approval volume (approve safest APPROVAL_RATE)
    cut_b, cut_f = np.quantile(pb, approval_rate), np.quantile(pf, approval_rate)
    appr_b, appr_f = pb <= cut_b, pf <= cut_f
    swap_in = appr_f & ~appr_b        # wallet layer RESCUES (bureau declined)
    swap_out = appr_b & ~appr_f       # wallet layer REJECTS (bureau wrongly approved)
    rate = lambda m: float(yv[m].mean()) if m.sum() else None  # noqa: E731

    # calibration (full model) — reliability curve + Brier
    try:
        cal = pd.DataFrame({"p": pf, "y": yv})
        cal["bin"] = pd.qcut(cal["p"], 10, duplicates="drop")
        cg = cal.groupby("bin", observed=True).agg(pred=("p", "mean"), obs=("y", "mean"),
                                                   n=("y", "size"))
        calibration = [{"pred": round(float(r.pred), 4), "obs": round(float(r.obs), 4),
                        "n": int(r.n)} for _, r in cg.iterrows()]
    except Exception:
        calibration = []

    # score bands (full model) — monotonicity check
    try:
        ptp = pf.max() - pf.min() or 1.0
        score = 1 + 98 * (1 - (pf - pf.min()) / ptp)
        bnd = pd.DataFrame({"score": score, "bad": yv})
        bnd["band"] = pd.qcut(bnd["score"], 5, labels=["1 (worst)", "2", "3", "4", "5 (best)"],
                              duplicates="drop")
        bt = bnd.groupby("band", observed=True).agg(n=("bad", "size"), bad=("bad", "sum"),
                                                    rate=("bad", "mean"))
        bands = [{"band": str(i), "n": int(r.n), "defaults": int(r.bad),
                  "rate": round(float(r.rate), 4)} for i, r in bt.iterrows()]
    except Exception:
        bands = []

    # Information Value per cash-flow feature (feature strength)
    iv = sorted(({"name": f, "iv": round(woe_iv(d[f], y), 3)} for f in cashflow_cols),
                key=lambda r: r["iv"], reverse=True)

    return {
        "n_accounts": n, "n_defaults": n_bad, "bad_rate": round(n_bad / n, 4),
        "baseline": {
            "label": baseline_label or "Bureau view",
            "features": baseline_cols, "auc": round(auc_b, 4), "ks": round(ks_b, 4),
            "brier": round(brier_score_loss(yv, pb), 4), "roc": _roc_pts(yv, pb),
        },
        "full": {
            "label": full_label or "+ Wallet layer",
            "features": cols, "auc": round(auc_f, 4), "ks": round(ks_f, 4),
            "brier": round(brier_score_loss(yv, pf), 4), "roc": _roc_pts(yv, pf),
        },
        "lift": {
            "auc": round(lift, 4),
            "ci_low": round(ci_lo, 4) if ci_lo is not None else None,
            "ci_high": round(ci_hi, 4) if ci_hi is not None else None,
            "p_gt_0": round(p_gt0, 4) if p_gt0 is not None else None,
            "n_boot": int(len(lifts)),
        },
        "thin_file": thin_block,
        "swap_set": {
            "approval_rate": approval_rate,
            "note": "at equal approval volume, safest applicants approved by each model",
            "baseline_approved_bad_rate": round(rate(appr_b), 4) if rate(appr_b) is not None else None,
            "full_approved_bad_rate": round(rate(appr_f), 4) if rate(appr_f) is not None else None,
            "swap_in_n": int(swap_in.sum()),
            "swap_in_bad_rate": round(rate(swap_in), 4) if swap_in.sum() else None,
            "swap_out_n": int(swap_out.sum()),
            "swap_out_bad_rate": round(rate(swap_out), 4) if swap_out.sum() else None,
        },
        "calibration": {
            "bins": calibration,
            "brier_baseline": round(brier_score_loss(yv, pb), 4),
            "brier_full": round(brier_score_loss(yv, pf), 4),
        },
        "score_bands": bands,
        "information_value": iv,
        "method": {
            "validation": "5-fold cross-validated out-of-sample predictions",
            "ablation": "nested — FULL = BASELINE + wallet layer, same accounts",
            "model": "standardized, class-balanced logistic regression",
        },
    }
