# Saudi statistical priors — verified sources (fetched live 2026-07-04)

Every file in this directory was downloaded from the publishing body (or its Wayback
copy where geo-blocked) during a verified research session. These are the ONLY numbers
allowed to anchor the Saudi demonstration corpus (DATA_DEFENSE.md P1 Build 2).
**Prime directive: no statistic enters the corpus without a citation to one of these.**

| File | Source · what it is | Key verified figures |
|---|---|---|
| `hies23_tables.xlsx` | GASTAT — Household Income & Consumption Expenditure Survey 2023 tables (41 sheets, EN/AR; released Feb 2025, n=122,325 households) | Avg household disposable income SAR 11,839/mo (Saudi 18,056 / non-Saudi 5,428); median 7,362 (13,655 / 3,657) |
| `sel_decile.json` | GASTAT database.stats.gov.sa HIES cube — **income deciles, 2024** | D1 584 · D2 1,179 · D3 1,672 · D4 2,174 · D5 2,835 · D6 3,719 · D7 5,091 · D8 7,198 · D9 10,497 · D10 25,188 SAR/mo |
| `hices_inc.json` / `hices_pct.json` | GASTAT HIES cube extracts (income by group / percentile queries) | see JSON |
| `hices2023.pdf` | GASTAT HICES 2023 publication PDF | Expense shares: food 27.9% · housing/utilities 14.1% · restaurants 11.7% · transport 10.5% · clothing 9.6% |
| `lms_q2_2025.xlsx` | GASTAT Labor Market Statistics Q2 2025 (44 sheets) | Avg wage: Saudi SAR 11,034 (M 11,695 / F 9,108); non-Saudi 3,933 |
| `wages.json` | GASTAT wage cube extract | see JSON |
| `gosi_wage.csv` | GOSI via open.data.gov.sa — **Contributors by Contributory Wage** (Q2 2025, 6 bands) | 400–5,000: 10,714,622 · 5,001–9,999: 1,128,766 · 10,000–19,999: 753,543 · 20,000–29,999: 265,620 · 30,000–39,999: 108,320 · 40,000+: 134,304 |
| `gosi_nat.csv` / `gosi_pub.json` | GOSI — contributors by nationality + dataset metadata | Q4 2025: Saudi 3.08M / non-Saudi 10.59M |
| `sama_bulletin_may2026.xlsx` | SAMA Monthly Statistical Bulletin, May 2026 (102 sheets; table 13a = consumer & credit-card loans by purpose, quarterly since 1998) | Consumer loans SAR 481.1bn Q1 2026; credit-card loans SAR 34.1bn; retail real-estate SAR 730.0bn end-2025 |
| `findex2025.csv` | World Bank Global Findex Database 2025 full aggregates (438 cols; gitignored — 17.6MB, re-download URL below) | KSA: account ownership 74.3% (2021) → 78.8% (2024); borrowed formally 30.5% (2024); mobile-money 36.5% |
| `fsdp2024.pdf` | Financial Sector Development Program annual report 2024 (KPI table p.40) | Non-cash transactions 79% (target 70); SME loans 9.4% of bank loans (2030 ambition 20%); 261 fintechs |
| `cpi_sep2025.pdf` | GASTAT CPI (2023=100) | division weights derive from HICES |
| `readsheet.py` | stdlib XLSX reader used to parse the workbooks (no openpyxl dependency) | — |

## Re-download URLs (some need a real browser User-Agent; www.stats.gov.sa geo-blocks US IPs — use database.stats.gov.sa or Wayback)

- GASTAT HIES tables: https://www.stats.gov.sa/documents/d/guest/publication-tables-of-household-income-and-consumption-expenditure-survey-2023
- GASTAT decile cube (Flexmonster API): POST https://database.stats.gov.sa/flexmonster/select (cubes DPV_HIES_V2_SDBHIES101–118)
- GASTAT LMS Q2 2025: https://www.stats.gov.sa/documents/20117/2435273/Labor+Market+Statistics+Q2+2025+EN.xlsx/580f7dd5-2a9e-dafc-ef10-54eecfd7c477?t=1759134938849
- GOSI wage bands: https://open.data.gov.sa/odp-public/ed1f266a-b956-40f3-b2a9-b0f513eed695/1bb30634-4e99-49fe-b2cd-afc30ecab82e/v5/2025Q2%20%20Contributors%20by%20Contributory%20Wage%20CSV.csv
- SAMA bulletin: https://www.sama.gov.sa/en-US/Statistics/MonthlyStatistics/Monthly_Bulletin_May_2026.xlsx
- Findex 2025 CSV: https://thedocs.worldbank.org/en/doc/be6615202d1f08a25855c8ac2d615122-0050012025/related/GlobalFindexDatabase2025.csv
- Findex Saudi microdata (registration): https://microdata.worldbank.org/index.php/catalog/7970
- FSDP 2024: https://www.vision2030.gov.sa/media/wpsn44ab/fsdp_annual-report-2024_-en.pdf
- KAPSARC mirror (programmatic GASTAT/SAMA, has ≥1 units bug — sanity-check): https://datasource.kapsarc.org

## Known caveats (carry into the pipeline)
- GOSI bands are coarse (82% in the bottom band), contributory basic wage only (excludes allowances), mixed nationality → fit a lognormal/mixture against HICES moments, don't use raw bands as the wage marginal.
- No observed household-DBR distribution exists anywhere (SAMA publishes caps, not distributions) — cite `sama.py` caps as policy, never as an observed prior.
- 2024 HIES database vintage has a per-capita median>mean inconsistency — prefer the 2023 publication for headline anchors.
- SIMAH publishes no downloadable stats; citable secondary: World Bank Doing Business 2020 — credit-bureau coverage 56.7% of adults.

## ../external/ (gitignored — heavy)
- `alfa_train_target.csv.gz` — AlfaBattle 2.0 labels (963,812 applications, `flag` default, 2.76% base rate). Full transactions: https://huggingface.co/datasets/pytorch-lifestream/alfa-scoring-trx (ungated). License: none declared (community-standard benchmark) — DISCLOSE if numbers are published.
- `bondora_loans.xlsx` — Go&Grow (Bondora) public loan book, 737,890 loans, 31 cols incl. `is_default`, refreshed 2026-04-28. Lender-published: https://goandgrow.eu/en/public-statistics/ — cleanest license of the label-rich sets.
- Home Credit / Amex Kaggle data: **do not use in published numbers** — competition rules verified 2026-07-04 restrict both to competition use only (HC supersedes the academic carve-out; Amex has none).
