# Tabaqa enricher evaluation

Two honest, reproducible, **pure-stdlib** evaluations of the transaction
enricher — the part of the pipeline that turns a raw Arabic bank/wallet narration
into `{merchant, category, txn_type}` and reconciles cross-account transfers.
Together they answer one question: *how good is the model, and how do we know?*

```
cd app
python3 eval/eval_enrich.py        # enricher accuracy  → writes eval/REPORT.md   (pure-stdlib)
python3 eval/eval_regression.py    # drift guard        → exits non-zero on drift (pure-stdlib)
python3 eval/berka_train.py        # PD model on REAL defaults → writes eval/DATA_REPORT.md
```

The first two touch no network and need no third-party package — the same offline
pipeline that runs in the demo (`enrich_all` → `reconcile`). The third validates the
**score** on real default data (see §3).

## 1. `eval_enrich.py` — the honest headline number

Runs the real rule tier over **`labeled_transactions.jsonl`**, a hand-curated set
of ~140 labeled transactions, and reports:

| metric | what it means |
|---|---|
| per-`txn_type` P / R / F1 | classification quality across all 7 classes |
| exact txn_type accuracy + macro-F1 | single-glance overall numbers |
| **income-class accuracy** | income (salary∪gig∪p2p) vs not — the metric that drives the reveal |
| merchant coverage + accuracy | how much of the brand long-tail the dictionary catches |
| reconciliation precision / recall | the anti-double-count guarantee on bank↔wallet transfers |

### Why the set is built to be *hard*

A happy-path eval would score ~100% and prove nothing. This set is deliberately
adversarial so the number is defensible:

- **Messy orthography** — Arabic-Indic digits (`٧٢٥٠`), diacritics/tashkeel
  (`رَاتِب`), tatweel (`جـــاهـــز`), hamza variants (`إيداع`), `ة`/`ه` spelling.
- **Transliteration & mixed script** — `SALARY TRANSFER`, `tahweel min ahmad`,
  `JAHEZ دفعة`.
- **Synonyms the rules don't know** — `حوالة` (vs `تحويل`), `مديونية`, `اقساط`,
  credit-card payments — each a known, annotated miss.
- **Long-tail merchants NOT in the dictionary** — Albaik, Kudu, Dominos, Nahdi,
  Ninja, Subway, McDonald's, Apple — these are exactly what the production
  AraBERT/LLM tier exists to absorb.
- **Reconciliation edge cases** — matched transfer pairs (caught) *and* a pair
  whose legs fall outside the 3-day window (an honest recall miss).
- **False-positive traps** — a cashback worded `تحويل من شركة كاش باك` that the
  P2P rule wrongly grabs, so income precision is measured under pressure.

Every row carries `true_txn_type` / `true_category` / optional `true_merchant`,
and disagreements carry a `note` explaining the limitation. `REPORT.md` lists
**every** disagreement — nothing is hidden.

### Dataset row schema (`labeled_transactions.jsonl`)

```json
{"raw_desc": "JAHEZ-RYD دفعة", "source": "wallet:barq", "timestamp": "2026-03-15",
 "amount": 2600, "direction": "inflow",
 "true_txn_type": "gig_income", "true_category": "gig_platform", "true_merchant": "Jahez"}
```

`counterparty_iban`, `true_merchant`, and `note` are optional. `Transaction.from_dict`
keeps only the canonical schema fields, so the `true_*` / `note` labels never leak
into the pipeline being measured.

## 2. `eval_regression.py` — the drift guard

The synthesizer writes statements whose narrations are constructed so the real
pipeline classifies every line correctly. This script re-derives each row's
*intended* label from how the synthesizer wrote it, runs `enrich_all` +
`reconcile`, and asserts they still agree across all four persona archetypes
(`salaried_gig`, `gig_driver`, `sme_owner`, `thin_file`). It must stay at **100%**;
it exits non-zero the moment an `enrich.py` edit breaks a keyword.

This is **not** an accuracy number — it's a self-consistency regression test. The
headline enricher number is `eval_enrich.py` only.

## 3. `berka_train.py` — does the *score* actually predict default?

The enricher evals above measure labelling. This one measures the **PD model** on
**real loan outcomes** — the only way to honestly answer *"does your score work?"*

It derives Tabaqa's **same six cash-flow features** (`pipeline/features.py`) from each
account's **pre-loan** transaction history in the public **Berka / PKDD'99** dataset
(1M+ real bank transactions + loan default labels), labels by loan status (A/C good,
B/D default), fits a logistic scorecard, and reports out-of-sample AUC / KS + a
default-rate-by-score-band table → **`eval/DATA_REPORT.md`**.

```
pip install scikit-learn pandas pymysql      # reads the public CTU MariaDB (no login)
python3 eval/berka_train.py
```

**Latest run:** 682 loans, 76 defaults → **5-fold CV AUC 0.858 · KS 0.562**, default rate
falling **38.7% → 0.0%** across score bands. Fully reproducible; open data, open tools.
Caveats (Berka is a Czech-1990s proxy; `nsf_count` is inert there) are stated in the report.

## What this is (and isn't)

This evaluates the **deterministic rule tier** — the known ~80% the rules own,
offline and dependency-free. It is intentionally honest about the residual
long-tail (listed in `REPORT.md`), which in production routes to AraBERT
embeddings + Claude Opus for cleaning. The gap between the two tiers is exactly
the annotated rows — measurable, not hand-waved.
