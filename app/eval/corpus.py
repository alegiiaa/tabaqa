"""Tabaqa — the millions-scale, wallet-aware SYNTHETIC corpus generator.

Open banking = a lot of data. Berka gives us ~1M real transactions but only ~682
loan accounts with real default labels. To demonstrate the engine at open-banking
SCALE (and to model Saudi segments the public data lacks), we learn the *joint*
distribution of the real Berka feature table — the 12 bureau-baseline features, the
7 cash-flow features, ``pre_months``, AND the ``bad`` label — and SAMPLE millions of
statistically-faithful accounts from it.

    HONESTY (this is the whole design): the default label is SAMPLED from a joint
    distribution LEARNED on real Berka outcomes, never hand-injected. So "feature X
    predicts default" is NOT a tautology we wrote in. The validity claim stays on the
    real ablation (eval/ablation.py) and the Home-Credit cross-check; the synthetic
    corpus earns only the SCALE/CAPACITY claim, and ``corpus_train.py`` proves the
    sample kept the real signal via Train-on-Synthetic / Test-on-Real (TSTR).

Generator: a dependency-free numpy **Gaussian copula** (preserves each marginal via
its inverse empirical CDF + the full rank-correlation structure). If ``sdv`` is
installed, ``--generator sdv`` uses ``GaussianCopulaSynthesizer`` instead. Nothing
here touches the live scoring path.

Run:  python3 eval/corpus.py --n 1000000
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ablation import BASELINE, CASHFLOW, _load, build_baseline, preloan_history  # noqa: E402
from berka_train import build_features  # noqa: E402

JOINT = list(BASELINE) + list(CASHFLOW) + ["pre_months", "bad"]

APP = HERE.parent
CORPUS_DIR = APP / "data" / "synthetic" / "corpus"          # large parquet — gitignored
SEGMENTS_JSON = APP / "data" / "synthetic" / "corpus_segments.json"  # tiny — committed

METHODOLOGY = (
    "Default labels are SAMPLED from a joint distribution learned on real Berka "
    "outcomes (never hand-injected), so no feature→default relationship is "
    "tautological. Validity is measured only on real data (ablation + Home-Credit "
    "cross-check); the synthetic corpus proves scale/capacity, and Train-on-Synthetic/"
    "Test-on-Real (see corpus_train.py) confirms the sample carries the real signal."
)

# descriptive, feature-derived cohorts (NOT label drivers) — one per account
SEGMENTS = [
    ("thin_file", "Thin-file (shortest banking history)"),
    ("high_obligation", "Heavily obligated (SME / leveraged)"),
    ("irregular_income", "Irregular income (gig-like)"),
    ("stable_salaried", "Stable salaried (prime)"),
]


# ── real source table (reused by corpus_train.py) ────────────────────────────
def berka_joint_table():
    """Assemble the real Berka joint table exactly as ``ablation.run()`` does.

    Returns ``(df, aux)`` where df has BASELINE + CASHFLOW + pre_months + bad, and
    aux carries the real transaction accounting for honest scale reporting.
    """
    loan, order, trans, account, disp, client, card, district = _load()
    cash = build_features(loan[["account_id", "date", "status"]], order, trans)
    base = build_baseline(loan, account, disp, client, card, district)
    hist = preloan_history(loan, trans)
    df = (cash.merge(base, on="account_id", how="inner")
              .merge(hist, on="account_id", how="left"))
    df = df.dropna(subset=list(BASELINE) + list(CASHFLOW) + ["bad"]).reset_index(drop=True)
    df["pre_months"] = df["pre_months"].fillna(0)
    aux = {
        "n_real_transactions": int(len(trans)),
        "mean_txns_per_account": float(len(trans) / max(1, trans["account_id"].nunique())),
    }
    return df, aux


# ── numpy Gaussian copula (zero third-party deps) ─────────────────────────────
def _nearest_psd(C, eps=1e-8):
    import numpy as np
    C = 0.5 * (C + C.T)
    w, V = np.linalg.eigh(C)
    w = np.clip(w, eps, None)
    C2 = (V * w) @ V.T
    d = np.sqrt(np.clip(np.diag(C2), eps, None))
    return C2 / np.outer(d, d)  # renormalize to unit-diagonal correlation


def fit_gaussian_copula(R, cols=JOINT):
    """Learn a Gaussian copula: per-column empirical marginal + normal-score corr."""
    import numpy as np
    from scipy.stats import norm

    R = R[cols].astype(float)
    n = len(R)
    ranks = R.rank(method="average").values
    Z = norm.ppf(ranks / (n + 1.0))
    C = _nearest_psd(np.corrcoef(Z, rowvar=False))
    colmeta = {}
    for c in cols:
        v = R[c].values
        uniq = np.unique(v)
        is_binary = uniq.size <= 2 and set(np.round(uniq)).issubset({0.0, 1.0})
        is_integer = bool(np.allclose(v, np.round(v)))
        colmeta[c] = {
            "sorted": np.sort(v), "is_binary": bool(is_binary),
            "is_integer": is_integer, "base_rate": float(np.mean(v)),
            "lo": float(np.min(v)), "hi": float(np.max(v)),
        }
    return {"cols": list(cols), "C": C, "colmeta": colmeta, "n_source": n}


def sample_copula(model, m, seed=42):
    """Sample ``m`` synthetic rows: MVN(0,C) → uniforms → inverse empirical CDF."""
    import numpy as np
    import pandas as pd
    from scipy.stats import norm

    rng = np.random.default_rng(seed)
    cols = model["cols"]
    G = rng.multivariate_normal(np.zeros(len(cols)), model["C"], size=int(m), method="cholesky")
    U = norm.cdf(G)
    out = {}
    for j, c in enumerate(cols):
        meta = model["colmeta"][c]
        u = U[:, j]
        if meta["is_binary"]:
            v = (u > 1.0 - meta["base_rate"]).astype(int)
        else:
            v = np.quantile(meta["sorted"], u, method="linear")
            if meta["is_integer"]:
                v = np.rint(v)
            v = np.clip(v, meta["lo"], meta["hi"])
        out[c] = v
    return pd.DataFrame(out)


def _sample_sdv(R, m, cols=JOINT, seed=42):
    """Optional high-fidelity path — SDV GaussianCopulaSynthesizer (no torch)."""
    from sdv.metadata import SingleTableMetadata
    from sdv.single_table import GaussianCopulaSynthesizer

    real = R[cols].astype(float)
    meta = SingleTableMetadata()
    meta.detect_from_dataframe(real)
    for c in cols:  # keep bad/binary as boolean-ish integers
        pass
    synth = GaussianCopulaSynthesizer(meta)
    synth.fit(real)
    df = synth.sample(num_rows=int(m))
    # SDV may emit floats for the label; snap bad to {0,1}
    if "bad" in df:
        df["bad"] = (df["bad"] > 0.5).astype(int)
    return df


# ── segmentation (descriptive cohorts, never label drivers) ───────────────────
def segment_thresholds(real_df):
    import numpy as np
    return {
        "p33_pre": float(np.quantile(real_df["pre_months"], 0.33)),
        "p75_obl": float(np.quantile(real_df["recurring_obligation_load"], 0.75)),
        "p33_reg": float(np.quantile(real_df["income_regularity"], 0.33)),
        "p66_vol": float(np.quantile(real_df["balance_volatility"], 0.66)),
    }


def tag_segments(df, thr):
    import numpy as np
    seg = np.full(len(df), "stable_salaried", dtype=object)
    irregular = (df["income_regularity"].values <= thr["p33_reg"]) | \
                (df["balance_volatility"].values >= thr["p66_vol"])
    seg = np.where(irregular, "irregular_income", seg)
    seg = np.where(df["recurring_obligation_load"].values >= thr["p75_obl"], "high_obligation", seg)
    seg = np.where(df["pre_months"].values <= thr["p33_pre"], "thin_file", seg)  # highest priority
    return seg


# ── generate ──────────────────────────────────────────────────────────────────
CASHFLOW_KEYS = list(CASHFLOW)


def _segment_summaries(synth, seg, real_df):
    """Per-segment count, synthetic bad-rate, and a representative (median) profile."""
    import numpy as np
    labels = dict(SEGMENTS)
    out = []
    for key, label in SEGMENTS:
        mask = seg == key
        n = int(mask.sum())
        if not n:
            continue
        sub = synth[mask]
        profile = {f: round(float(np.median(sub[f])), 4) for f in CASHFLOW_KEYS}
        profile["age"] = round(float(np.median(sub["age"])), 1)
        profile["loan_amount"] = round(float(np.median(sub["loan_amount"])), 1)
        out.append({
            "key": key, "label": label, "n": n,
            "share": round(n / len(synth), 4),
            "bad_rate": round(float(sub["bad"].mean()), 4),
            "median_profile": profile,
        })
    return out


def generate(n=1_000_000, generator="numpy", seed=42):
    """Return ``(synth_df, meta)`` — millions of faithful accounts + scale/segment meta."""
    real_df, aux = berka_joint_table()
    if generator == "sdv":
        try:
            synth = _sample_sdv(real_df, n, seed=seed)
        except Exception as e:  # noqa: BLE001
            print(f"  SDV unavailable ({type(e).__name__}: {e}); using numpy copula.",
                  file=sys.stderr)
            synth = sample_copula(fit_gaussian_copula(real_df), n, seed=seed)
            generator = "numpy (sdv fallback)"
    else:
        synth = sample_copula(fit_gaussian_copula(real_df), n, seed=seed)

    thr = segment_thresholds(real_df)
    seg = tag_segments(synth, thr)
    segments = _segment_summaries(synth, seg, real_df)

    meta = {
        "generator": ("SDV GaussianCopula" if generator == "sdv"
                      else "numpy Gaussian copula (zero-dependency)"),
        "source": "learned from the real Berka joint feature+label table",
        "n_source_accounts": int(len(real_df)),
        "n_synthetic_accounts": int(n),
        "n_real_transactions": aux["n_real_transactions"],
        "mean_txns_per_account": round(aux["mean_txns_per_account"], 1),
        "n_transactions_extrapolated": int(round(n * aux["mean_txns_per_account"])),
        "n_segments": len(segments),
        "segments": segments,
        "methodology": METHODOLOGY,
    }
    synth = synth.copy()
    synth["segment"] = seg
    return synth, meta


def write_segments_json(meta, path=SEGMENTS_JSON):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(meta, indent=2))
    return path


def main():
    ap = argparse.ArgumentParser(description="Generate the Tabaqa synthetic corpus.")
    ap.add_argument("--n", type=int, default=1_000_000, help="synthetic accounts to sample")
    ap.add_argument("--generator", choices=["numpy", "sdv"], default="numpy")
    ap.add_argument("--no-parquet", action="store_true", help="skip materializing the parquet")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    try:
        import pandas, numpy, scipy  # noqa: F401
    except ImportError as e:
        print(f"Missing dependency ({e.name}). pip install pandas numpy scipy", file=sys.stderr)
        return

    try:
        print(f"Learning the real Berka joint distribution and sampling {args.n:,} accounts …")
        synth, meta = generate(args.n, generator=args.generator, seed=args.seed)
    except Exception as e:  # noqa: BLE001
        print(f"Could not generate corpus: {type(e).__name__}: {e}\n"
              "Check network to relational.fel.cvut.cz:3306 (Berka source).", file=sys.stderr)
        return

    write_segments_json(meta)
    if not args.no_parquet:
        CORPUS_DIR.mkdir(parents=True, exist_ok=True)
        out = CORPUS_DIR / "corpus.parquet"
        synth.to_parquet(out, index=False)
        print(f"  materialized {len(synth):,} accounts → {out}")

    print("\n" + "=" * 60)
    print("SYNTHETIC CORPUS  (faithful sample of real Berka behavior)")
    print("=" * 60)
    print(f"  generator            {meta['generator']}")
    print(f"  source accounts      {meta['n_source_accounts']:,} (real, labeled)")
    print(f"  synthetic accounts   {meta['n_synthetic_accounts']:,}")
    print(f"  ≈ transactions       {meta['n_transactions_extrapolated']:,} "
          f"(extrapolated @ {meta['mean_txns_per_account']:.0f}/acct)")
    print(f"  segments             {meta['n_segments']}")
    for s in meta["segments"]:
        print(f"     {s['key']:<18} n={s['n']:>9,}  ({s['share']*100:4.1f}%)  "
              f"synth bad-rate {s['bad_rate']*100:4.1f}%")
    print(f"\n  wrote {SEGMENTS_JSON}")


if __name__ == "__main__":
    main()
