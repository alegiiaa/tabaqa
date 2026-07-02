"""Tabaqa — assemble the FULL model card (real validity + synthetic scale + cross-check).

Non-invasive orchestrator: it reads the flagship Berka card that ``ablation.py``
already wrote (never re-computes or mutates it), then merges three additive,
optional top-level keys and writes the result to the same three paths the app
consumes. Each augment is None-safe, so the base card degrades gracefully if the
synthetic corpus or the Home-Credit CSVs aren't present.

  base   ← eval/model_card.json          (real Berka ablation — the validity tier)
  +corpus       (synthetic scale + TSTR bridge — corpus_train.build_corpus_block)
  +cross_check  (real Home Credit generalization — homecredit.build_cross_check, if CSVs present)
  +lineage      (the 3-tier evidence badge)

Run:  python3 eval/ablation.py && python3 eval/build_model_card.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ablation import OUT_APP, OUT_WEB, OUT_SRC  # noqa: E402  (the three write paths)


def _lineage(card, corpus, cross_check):
    tiers = [{
        "tier": "Validity", "source": f"Real Berka defaults (n={card.get('n_accounts', '?')})",
        "claim": f"+{card.get('lift', {}).get('auc', 0):.2f} AUC wallet-layer lift on real outcomes",
    }]
    if corpus:
        tiers.append({
            "tier": "Scale", "source": f"{corpus['n_synthetic_accounts']:,}-account synthetic corpus",
            "claim": f"Train-on-Synthetic/Test-on-Real retains {int((corpus.get('retention') or 0)*100)}% of real AUC",
        })
    if cross_check:
        tiers.append({
            "tier": "Generalization", "source": cross_check.get("dataset", "Home Credit"),
            "claim": f"+{cross_check.get('lift', {}).get('auc', 0):.2f} AUC replicates on a second real dataset",
        })
    return {
        "tiers": tiers,
        "live_scorer": ("Live score = transparent expert scorecard (glass-box; every point → a "
                        "reason code). The fitted optbinning scorecard — Berka AUC "
                        f"{card.get('full', {}).get('auc', 0):.2f}, TSTR-validated on the corpus — "
                        "is the drop-in production swap (identical I/O contract)."),
    }


def build(n_synth_metrics=200_000, seed=42, with_corpus=True, with_cross_check=True):
    if not OUT_APP.exists():
        print(f"Base card missing at {OUT_APP}. Run: python3 eval/ablation.py", file=sys.stderr)
        return None
    card = json.loads(OUT_APP.read_text())

    corpus = None
    if with_corpus:
        try:
            import corpus_train
            print("Building the synthetic-corpus block (scale + TSTR bridge) …")
            corpus = corpus_train.build_corpus_block(n_synth_metrics=n_synth_metrics, seed=seed)
        except Exception as e:  # noqa: BLE001
            print(f"  corpus block skipped: {type(e).__name__}: {e}", file=sys.stderr)

    cross_check = None
    if with_cross_check:
        try:
            import homecredit  # optional module; gated on local Kaggle CSVs
            print("Building the Home-Credit cross-check block …")
            cross_check = homecredit.build_cross_check()
        except Exception as e:  # noqa: BLE001
            print(f"  cross-check skipped ({type(e).__name__}: {e}); "
                  "drop the Kaggle CSVs in data/homecredit/ to enable.", file=sys.stderr)

    # additive merge — overwrite only our own keys (idempotent), never the base tiers
    card["corpus"] = corpus
    card["cross_check"] = cross_check
    card["lineage"] = _lineage(card, corpus, cross_check)

    blob = json.dumps(card, indent=2)
    for out in (OUT_APP, OUT_WEB, OUT_SRC):
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(blob)

    print("\n" + "=" * 60)
    print("MODEL CARD ASSEMBLED")
    print("=" * 60)
    print(f"  validity     Berka  AUC {card['baseline']['auc']:.3f} → {card['full']['auc']:.3f} "
          f"(+{card['lift']['auc']:.3f})")
    if corpus:
        print(f"  scale        {corpus['n_synthetic_accounts']:,} synth accounts · "
              f"≈{corpus['n_transactions_extrapolated']:,} txns · "
              f"TSTR {corpus['tstr']['auc']:.3f} vs real {corpus['trtr']['auc']:.3f}")
    else:
        print("  scale        (skipped)")
    print(f"  cross-check  {'Home Credit — ' + str(cross_check['dataset']) if cross_check else '(skipped — no CSVs)'}")
    for out in (OUT_APP, OUT_WEB, OUT_SRC):
        print(f"  wrote {out}")


def main():
    build()


if __name__ == "__main__":
    main()
