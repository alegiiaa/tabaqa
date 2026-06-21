# طبقة · Tabaqa — Build Resources (verified OSS repos)

Grouped by the job they do for Tabaqa. Slugs verified via search (2026-06-21). None are Saudi/Arabic-wallet specific — that's *our* wedge. They give us parsing, a categorization baseline, merchant cleaning, and Arabic primitives; the **wallet attribution + Masdr verification + Arabic** layer is what we build on top.

## 🔧 Ingestion + canonical schema + parsing (Day-1 head start)
- **[`sebastienrousseau/bankstatementparser`](https://github.com/sebastienrousseau/bankstatementparser)** ⭐ — parses CAMT / PAIN.001 / CSV / OFX / MT940 / PDF into **unified Transaction models**; deterministic ISO 20022 parsers, **LLM fallback**, categorization (Plaid 13-cat), balance verification. ≈ our ingestion + canonical schema, pre-built.
- **[`firefly-iii/data-importer`](https://github.com/firefly-iii/data-importer)** — how to wire **real open-banking connections** (GoCardless/Nordigen, Salt Edge). Reference for the AIS adapter.

## 🧠 Cleaner / categorizer (engine baseline)
- **[`eli-goodfriend/banking-class`](https://github.com/eli-goodfriend/banking-class)** ⭐ — *exactly our pattern*: clean merchant → ~35% via top-merchant lookup, rest via probabilistic model (merchant + amount). The "rules for the 80% + LLM for the tail", prototyped.
- **[`j-convey/BankTextCategorizer`](https://github.com/j-convey/BankTextCategorizer)** — BERT description→category/subcategory + a reusable `DataPreprocessor`.
- **[`MaxinAI/merchant_name_extraction_cnn`](https://github.com/MaxinAI/merchant_name_extraction_cnn)** — extracts the **merchant-name span** from a messy transaction string.
- **[`GlenCrawford/bank_transaction_unsupervised_clustering`](https://github.com/GlenCrawford/bank_transaction_unsupervised_clustering)** — merchant normalization via clustering (strips dates/card-nums).

## 🇸🇦 Arabic NLP (the differentiator — what nobody else has)
- **CAMeL Tools** — [`CAMeL-Lab/camel_tools`](https://github.com/CAMeL-Lab/camel_tools) ⭐ — standard Arabic toolkit: normalization, de-diacritization, NER, dialect ID. Core of the Arabic Cleaner.
- **PyArabic** — [`linuxscout/pyarabic`](https://github.com/linuxscout/pyarabic) — Arabic text normalization primitives.
- **[`OmarSalah26/Awesome-Arabic-AI`](https://github.com/OmarSalah26/Awesome-Arabic-AI)** — hub to find Arabic models (AraBERT etc.) + datasets.

## 📊 Datasets (demo realism + eval)
- **[`utribedi/Bank_transaction_category_predictor`](https://github.com/utribedi/Bank_transaction_category_predictor)** — 40k labeled train + 10k test transactions. Eval + seed realistic demo data.

## 🏗️ Reference architecture / data model (and UI inspiration)
- **[`firefly-iii/firefly-iii`](https://github.com/firefly-iii/firefly-iii)** ⭐ — full OSS personal-finance manager: categories, tags, **rule-based transaction handling**, double-entry, full REST API. Best reference for our data model + rules engine.
- **Actual Budget** — [`actualbudget/actual`](https://github.com/actualbudget/actual) — React-based; clean UI patterns for transaction lists/categorization.
