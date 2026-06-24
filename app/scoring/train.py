"""Train the PD scorecard on real default labels (Berka, PKDD'99).

The data strategy (README): you can't get real Saudi default labels in 3 days,
so TRAIN on Berka — real bank transactions *with loan-default outcomes* — and
DEMO on synthetic Saudi-format statements run through the same pipeline.

This is a runnable skeleton: it expects optbinning + the Berka feature table and
persists a Scorecard. Without those installed it prints guidance and exits, so
the repo stays runnable offline. Fill in `load_berka_features()` once the Berka
loan/transaction tables are in app/data/berka/.
"""
from __future__ import annotations

import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "berka"
MODEL_OUT = Path(__file__).resolve().parent / "scorecard.pkl"

# The six cash-flow features the scorecard bins (must match pipeline.features).
FEATURE_COLUMNS = [
    "income_regularity",
    "income_expense_ratio",
    "avg_balance",
    "min_balance",
    "nsf_count",
    "recurring_obligation_load",
    "balance_volatility",
]
TARGET = "default"  # 1 = defaulted, 0 = repaid


def load_berka_features():
    """Return (X: DataFrame[FEATURE_COLUMNS], y: Series[TARGET]).

    TODO: build from the Berka `loan` + `trans` tables — derive the same six
    cash-flow features per account over the pre-loan window, label by loan
    status (A/B/C/D → default flag). Until then this raises so train() can give
    a clear message.
    """
    raise FileNotFoundError(
        f"Berka feature table not found under {DATA_DIR}. "
        "See app/data/README.md for how to obtain and prepare it."
    )


def train() -> None:
    try:
        from optbinning import Scorecard, BinningProcess  # noqa: F401
        from sklearn.linear_model import LogisticRegression  # noqa: F401
    except ImportError:
        print(
            "optbinning / scikit-learn not installed.\n"
            "  pip install optbinning scikit-learn pandas\n"
            "Then place the Berka tables under app/data/berka/ and re-run.",
            file=sys.stderr,
        )
        return

    try:
        X, y = load_berka_features()
    except FileNotFoundError as e:
        print(str(e), file=sys.stderr)
        return

    from optbinning import Scorecard, BinningProcess
    from sklearn.linear_model import LogisticRegression

    binning = BinningProcess(variable_names=FEATURE_COLUMNS)
    scorecard = Scorecard(
        binning_process=binning,
        estimator=LogisticRegression(),
        scaling_method="min_max",
        scaling_method_params={"min": 1, "max": 99},
    )
    scorecard.fit(X, y)
    scorecard.save(str(MODEL_OUT))
    print(f"Saved trained scorecard → {MODEL_OUT}")


if __name__ == "__main__":
    train()
