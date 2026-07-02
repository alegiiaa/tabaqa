"""Tabaqa — the wallet-layer ABLATION on real default data (Berka / PKDD'99).

The demo-grade data-analysis engine. It answers, on real loan outcomes, the one
question the whole product rests on:

    *How much does the wallet layer (cash-flow features) add on top of everything
     a traditional bureau/bank already sees?*

Method (a controlled, nested ablation on the SAME accounts — no confound):
  • BASELINE model = "bureau view": demographics + district socio-economics +
    account tenure + card tier + requested loan terms.  (What a lender sees today.)
  • FULL model     = BASELINE + the 7 cash-flow features (the wallet layer).
  • The gap between them, out-of-sample, IS the value of the wallet layer.

Rigor a credit-risk reviewer looks for, all emitted here:
  • Leakage discipline — cash-flow features use strictly PRE-LOAN transactions.
  • Out-of-sample everywhere — 5-fold cross-validated predictions for every account.
  • Bootstrap 95% CI on the *paired* AUC lift (comparing two AUCs naively is a trap).
  • Thin-file conditional — AUC within the shortest-history borrowers (bureau's blind spot).
  • Calibration — reliability curve + Brier (is the PD an accurate probability, not just a rank?).
  • Swap-set — at a fixed approval rate, who the wallet layer flips, and their REALIZED default rate.
  • Reproducible — public data, no login, fixed seed; emits web/public/model_card.json.

Run:  pip install scikit-learn pandas pymysql numpy && python3 eval/ablation.py
Data: CTU "relational" MariaDB — host relational.fel.cvut.cz  db financial  user guest  pass ctu-relational
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from berka_train import build_features, woe_iv, _to_dt, FEATURES  # noqa: E402

CASHFLOW = FEATURES  # the 7 cash-flow features (the wallet layer)
BASELINE = [
    "age", "gender", "account_tenure_yrs", "card_tier",
    "loan_amount", "loan_duration", "loan_payments",
    "distr_salary", "distr_unemp", "distr_crime", "distr_urban", "distr_entrep",
]

DB = dict(host="relational.fel.cvut.cz", user="guest", password="ctu-relational",
          database="financial", port=3306, connect_timeout=20)

OUT_APP = HERE / "model_card.json"
OUT_WEB = HERE.parent / "web" / "public" / "model_card.json"
OUT_SRC = HERE.parent / "web" / "src" / "data" / "model_card.json"  # bundled into the app build

APPROVAL_RATE = 0.60   # swap-set: approve the safest 60% (illustrative, DBR-agnostic)
THIN_QUANTILE = 0.33   # thin-file = shortest-history third of the book
N_BOOT = 3000


# ── data ────────────────────────────────────────────────────────────────────
def _load():
    import pandas as pd
    import pymysql
    conn = pymysql.connect(**DB)
    try:
        q = lambda s: pd.read_sql(s, conn)  # noqa: E731
        loan = q("SELECT account_id, date, amount, duration, payments, status FROM loan")
        order = q("SELECT account_id, amount, k_symbol FROM `order`")
        trans = q("SELECT account_id, date, type, amount, balance FROM trans "
                  "WHERE account_id IN (SELECT account_id FROM loan)")
        account = q("SELECT account_id, district_id, date FROM account")
        disp = q("SELECT disp_id, client_id, account_id, type FROM disp WHERE type='OWNER'")
        client = q("SELECT client_id, gender, birth_date FROM client")
        card = q("SELECT disp_id, type, issued FROM card")
        district = q("SELECT * FROM district")
    finally:
        conn.close()
    return loan, order, trans, account, disp, client, card, district


def _num(series):
    import pandas as pd
    s = pd.to_numeric(series.replace("?", None), errors="coerce")
    return s.fillna(s.median())


def build_baseline(loan, account, disp, client, card, district):
    """One row per loan account: the 'bureau view' features known at application."""
    import numpy as np
    import pandas as pd

    loan = loan.copy()
    loan["loan_date"] = _to_dt(loan["date"])

    acc = account.copy()
    acc["acc_date"] = _to_dt(acc["date"])

    cl = client.copy()
    cl["birth_date"] = _to_dt(cl["birth_date"])

    # district socio-economic overlay (a bureau's geographic risk proxy)
    d = district.copy()
    d = d.rename(columns={"A4": "pop", "A10": "urban", "A11": "salary",
                          "A13": "unemp", "A14": "entrep", "A16": "crime"})
    for col in ["pop", "urban", "salary", "unemp", "entrep", "crime"]:
        d[col] = _num(d[col])
    d["distr_salary"] = d["salary"]
    d["distr_unemp"] = d["unemp"]
    d["distr_urban"] = d["urban"]
    d["distr_entrep"] = d["entrep"]
    d["distr_crime"] = d["crime"] / d["pop"] * 1000.0   # crimes per 1000 inhabitants
    d = d[["district_id", "distr_salary", "distr_unemp", "distr_urban",
           "distr_entrep", "distr_crime"]]

    owner = disp[["account_id", "client_id", "disp_id"]]
    df = (loan.merge(owner, on="account_id", how="left")
              .merge(cl, on="client_id", how="left")
              .merge(acc[["account_id", "acc_date", "district_id"]], on="account_id", how="left")
              .merge(d, on="district_id", how="left"))

    df["age"] = (df["loan_date"].dt.year - df["birth_date"].dt.year).clip(18, 90)
    df["gender"] = (df["gender"].astype(str).str.upper() == "F").astype(int)
    df["account_tenure_yrs"] = ((df["loan_date"] - df["acc_date"]).dt.days / 365.25).clip(0, 40)

    # card tier, only if issued BEFORE the loan (no leakage)
    c = card.copy()
    c["issued"] = _to_dt(c["issued"])
    c["tier"] = c["type"].str.lower().map({"junior": 1, "classic": 2, "gold": 3}).fillna(0)
    oc = owner.merge(c, on="disp_id", how="left").merge(
        loan[["account_id", "loan_date"]], on="account_id", how="left")
    valid = oc["issued"].notna() & (oc["issued"] < oc["loan_date"])
    oc.loc[~valid, "tier"] = 0.0
    tier = oc.groupby("account_id")["tier"].max()
    df["card_tier"] = df["account_id"].map(tier).fillna(0.0)

    df["loan_amount"] = df["amount"].astype(float)
    df["loan_duration"] = df["duration"].astype(float)
    df["loan_payments"] = df["payments"].astype(float)

    keep = ["account_id"] + BASELINE
    out = df[keep].copy()
    for col in BASELINE:
        out[col] = _num(out[col]) if out[col].isna().any() else out[col]
    return out


def preloan_history(loan, trans):
    """Months of pre-loan banking history per account (thin-file proxy)."""
    import pandas as pd
    loan = loan.copy()
    loan["loan_date"] = _to_dt(loan["date"])
    t = trans.copy()
    t["date"] = _to_dt(t["date"])
    t = t.merge(loan[["account_id", "loan_date"]], on="account_id", how="inner")
    t = t[t["date"] < t["loan_date"]]
    t["ym"] = t["date"].dt.to_period("M").astype(str)
    g = t.groupby("account_id").agg(pre_months=("ym", "nunique"),
                                    pre_txns=("date", "size"))
    return g.reset_index()


# ── model + metrics ──────────────────────────────────────────────────────────
def _model():
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    return make_pipeline(StandardScaler(),
                         LogisticRegression(max_iter=2000, class_weight="balanced"))


def _ks(y, p):
    from sklearn.metrics import roc_curve
    fpr, tpr, _ = roc_curve(y, p)
    return float(max(tpr - fpr))


def _roc_pts(y, p, k=40):
    import numpy as np
    from sklearn.metrics import roc_curve
    fpr, tpr, _ = roc_curve(y, p)
    idx = np.linspace(0, len(fpr) - 1, min(k, len(fpr))).astype(int)
    return [[round(float(fpr[i]), 4), round(float(tpr[i]), 4)] for i in idx]


def run():
    import numpy as np
    import pandas as pd
    from sklearn.metrics import brier_score_loss, roc_auc_score
    from sklearn.model_selection import StratifiedKFold, cross_val_predict

    print("Loading Berka tables …")
    loan, order, trans, account, disp, client, card, district = _load()

    print("Building features (cash-flow + bureau baseline) …")
    cash = build_features(loan[["account_id", "date", "status"]], order, trans)  # + 'bad'
    base = build_baseline(loan, account, disp, client, card, district)
    hist = preloan_history(loan, trans)

    df = (cash.merge(base, on="account_id", how="inner")
              .merge(hist, on="account_id", how="left"))
    df = df.dropna(subset=BASELINE + CASHFLOW + ["bad"]).reset_index(drop=True)
    df["pre_months"] = df["pre_months"].fillna(0)

    y = df["bad"].astype(int)
    Xb = df[BASELINE]
    Xf = df[BASELINE + CASHFLOW]          # nested: baseline + wallet layer
    n, n_bad = len(df), int(y.sum())
    print(f"  {n} accounts · {n_bad} defaults ({n_bad / n * 100:.1f}% bad rate)")

    # out-of-sample predictions for EVERY account (same folds → paired comparison)
    skf = StratifiedKFold(5, shuffle=True, random_state=42)
    pb = cross_val_predict(_model(), Xb, y, cv=skf, method="predict_proba")[:, 1]
    pf = cross_val_predict(_model(), Xf, y, cv=skf, method="predict_proba")[:, 1]
    yv = y.values

    auc_b, auc_f = roc_auc_score(yv, pb), roc_auc_score(yv, pf)
    ks_b, ks_f = _ks(yv, pb), _ks(yv, pf)
    lift = auc_f - auc_b

    # bootstrap 95% CI on the PAIRED AUC lift
    rng = np.random.default_rng(42)
    lifts = []
    for _ in range(N_BOOT):
        s = rng.integers(0, n, n)
        ys = yv[s]
        if ys.min() == ys.max():
            continue
        lifts.append(roc_auc_score(ys, pf[s]) - roc_auc_score(ys, pb[s]))
    lifts = np.array(lifts)
    ci_lo, ci_hi = np.percentile(lifts, 2.5), np.percentile(lifts, 97.5)
    p_gt0 = float((lifts > 0).mean())

    # thin-file conditional (bureau's blind spot)
    thr = float(np.quantile(df["pre_months"], THIN_QUANTILE))
    thin = (df["pre_months"] <= thr).values
    thin_b = roc_auc_score(yv[thin], pb[thin]) if len(set(yv[thin])) > 1 else None
    thin_f = roc_auc_score(yv[thin], pf[thin]) if len(set(yv[thin])) > 1 else None

    # swap-set at a fixed approval volume (approve safest APPROVAL_RATE)
    cut_b, cut_f = np.quantile(pb, APPROVAL_RATE), np.quantile(pf, APPROVAL_RATE)
    appr_b, appr_f = pb <= cut_b, pf <= cut_f
    swap_in = appr_f & ~appr_b        # wallet layer RESCUES (bureau declined)
    swap_out = appr_b & ~appr_f       # wallet layer REJECTS (bureau wrongly approved)
    rate = lambda m: float(yv[m].mean()) if m.sum() else None  # noqa: E731

    # calibration (full model) — reliability curve + Brier
    cal = pd.DataFrame({"p": pf, "y": yv})
    cal["bin"] = pd.qcut(cal["p"], 10, duplicates="drop")
    cg = cal.groupby("bin", observed=True).agg(pred=("p", "mean"), obs=("y", "mean"),
                                               n=("y", "size"))
    calibration = [{"pred": round(float(r.pred), 4), "obs": round(float(r.obs), 4),
                    "n": int(r.n)} for _, r in cg.iterrows()]

    # score bands (full model) — monotonicity check
    ptp = pf.max() - pf.min() or 1.0
    score = 1 + 98 * (1 - (pf - pf.min()) / ptp)
    bnd = pd.DataFrame({"score": score, "bad": yv})
    bnd["band"] = pd.qcut(bnd["score"], 5, labels=["1 (worst)", "2", "3", "4", "5 (best)"],
                          duplicates="drop")
    bt = bnd.groupby("band", observed=True).agg(n=("bad", "size"), bad=("bad", "sum"),
                                                rate=("bad", "mean"))
    bands = [{"band": str(i), "n": int(r.n), "defaults": int(r.bad),
              "rate": round(float(r.rate), 4)} for i, r in bt.iterrows()]

    # Information Value per cash-flow feature (feature strength)
    iv = sorted(({"name": f, "iv": round(woe_iv(df[f], y), 3)} for f in CASHFLOW),
                key=lambda r: r["iv"], reverse=True)

    card_json = {
        "dataset": "Berka / PKDD'99 (CTU relational MariaDB — public, no login)",
        "n_accounts": n, "n_defaults": n_bad, "bad_rate": round(n_bad / n, 4),
        "baseline": {
            "label": "Bureau view (demographics + district + tenure + card + loan terms)",
            "features": BASELINE, "auc": round(auc_b, 4), "ks": round(ks_b, 4),
            "brier": round(brier_score_loss(yv, pb), 4), "roc": _roc_pts(yv, pb),
        },
        "full": {
            "label": "+ Wallet layer (7 cash-flow features)",
            "features": BASELINE + CASHFLOW, "auc": round(auc_f, 4), "ks": round(ks_f, 4),
            "brier": round(brier_score_loss(yv, pf), 4), "roc": _roc_pts(yv, pf),
        },
        "lift": {
            "auc": round(lift, 4), "ci_low": round(float(ci_lo), 4),
            "ci_high": round(float(ci_hi), 4), "p_gt_0": round(p_gt0, 4),
            "n_boot": int(len(lifts)),
        },
        "thin_file": {
            "definition": f"shortest-history third (≤ {thr:.0f} months of pre-loan banking)",
            "n": int(thin.sum()), "n_defaults": int(yv[thin].sum()),
            "baseline_auc": round(thin_b, 4) if thin_b else None,
            "full_auc": round(thin_f, 4) if thin_f else None,
            "baseline_roc": _roc_pts(yv[thin], pb[thin]) if thin_b else [],
            "full_roc": _roc_pts(yv[thin], pf[thin]) if thin_f else [],
        },
        "swap_set": {
            "approval_rate": APPROVAL_RATE,
            "note": "at equal approval volume, safest applicants approved by each model",
            "baseline_approved_bad_rate": round(rate(appr_b), 4),
            "full_approved_bad_rate": round(rate(appr_f), 4),
            "swap_in_n": int(swap_in.sum()),
            "swap_in_bad_rate": round(rate(swap_in), 4) if swap_in.sum() else None,
            "swap_out_n": int(swap_out.sum()),
            "swap_out_bad_rate": round(rate(swap_out), 4) if swap_out.sum() else None,
        },
        "calibration": {"bins": calibration,
                        "brier_baseline": round(brier_score_loss(yv, pb), 4),
                        "brier_full": round(brier_score_loss(yv, pf), 4)},
        "score_bands": bands,
        "information_value": iv,
        "method": {
            "validation": "5-fold cross-validated out-of-sample predictions",
            "leakage_control": "cash-flow features computed on strictly pre-loan transactions",
            "ablation": "nested — FULL = BASELINE + wallet layer, same accounts",
            "model": "standardized, class-balanced logistic regression",
        },
        "caveats": [
            "Berka is Czech retail banking (1990s) — the only PUBLIC data pairing real "
            "transactions with real default outcomes; a proxy for the Saudi product.",
            "The 'bureau view' here is a demographics/district/loan-terms proxy for a real "
            "credit-bureau file (Berka has no bureau feed) — stated honestly.",
            "Labels are BOOKED loans only; a production model adds reject inference for the "
            "through-the-door population (selection bias) — out of scope for this benchmark.",
        ],
    }

    blob = json.dumps(card_json, indent=2)
    OUT_APP.write_text(blob)
    OUT_WEB.parent.mkdir(parents=True, exist_ok=True)
    OUT_WEB.write_text(blob)
    OUT_SRC.parent.mkdir(parents=True, exist_ok=True)
    OUT_SRC.write_text(blob)

    # ── console summary ──
    print("\n" + "=" * 64)
    print("WALLET-LAYER ABLATION  (out-of-sample, 5-fold CV)")
    print("=" * 64)
    print(f"  Baseline (bureau view)     AUC {auc_b:.3f}   KS {ks_b:.3f}")
    print(f"  + Wallet layer (cash-flow) AUC {auc_f:.3f}   KS {ks_f:.3f}")
    print(f"  ── LIFT from wallet layer  +{lift:.3f} AUC  "
          f"(95% CI {ci_lo:+.3f}..{ci_hi:+.3f}, P(lift>0)={p_gt0:.1%})")
    print(f"\n  THIN-FILE (≤{thr:.0f}mo history, n={int(thin.sum())}, "
          f"{int(yv[thin].sum())} bad):")
    print(f"     bureau AUC {thin_b if thin_b is None else round(thin_b,3)}   →   "
          f"+wallet AUC {thin_f if thin_f is None else round(thin_f,3)}")
    print(f"\n  SWAP-SET @ {APPROVAL_RATE:.0%} approval:")
    print(f"     bureau-approved pool bad rate  {rate(appr_b):.1%}")
    print(f"     +wallet-approved pool bad rate {rate(appr_f):.1%}")
    print(f"     rescued by wallet: n={int(swap_in.sum())}, "
          f"realized bad {rate(swap_in) if swap_in.sum() else float('nan'):.1%}")
    print(f"     rejected by wallet: n={int(swap_out.sum())}, "
          f"realized bad {rate(swap_out) if swap_out.sum() else float('nan'):.1%}")
    print(f"\n  Brier  bureau {brier_score_loss(yv, pb):.4f}  →  "
          f"+wallet {brier_score_loss(yv, pf):.4f}  (lower = better calibrated)")
    print(f"\nwrote {OUT_APP}\nwrote {OUT_WEB}")


def main():
    try:
        import numpy, pandas, pymysql, sklearn  # noqa: F401
    except ImportError as e:
        print(f"Missing dependency ({e.name}). pip install scikit-learn pandas pymysql numpy",
              file=sys.stderr)
        return
    try:
        run()
    except Exception as e:
        print(f"Could not run ablation: {type(e).__name__}: {e}\n"
              "Check network to relational.fel.cvut.cz:3306, or download the Berka CSVs "
              "(kaggle.com/datasets/marceloventura/the-berka-dataset).", file=sys.stderr)


if __name__ == "__main__":
    main()
