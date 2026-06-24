# Tabaqa — data

The split that makes the 3-day build credible (README → *Data strategy*):

| Use | Source | Why |
|---|---|---|
| **Train** the PD model | **Berka (PKDD'99)** — real bank transactions *with loan-default outcomes* | the only realistic cash-flow training set with labels |
| **Demo** the reveal | **synthetic Saudi-format statements** (this folder) | mada / Geidea / Arabic strings + wallet income, run through the *same* pipeline |

> Pitch line: *"Trained on real transaction-level default data, demoed on Saudi-format statements; in production it retrains on the lender's own AIS outcomes."*

---

## `synthetic/`

Canonical fixtures fed straight into `pipeline.run_pipeline`. Each file:

```jsonc
{
  "applicant":  { "id", "name", "connection_id" },
  "accounts":   [ { "source": "bank:alinma" | "wallet:barq", "opening_balance", "currency" } ],
  "masdr":      { "payslip": {employer, monthly_wage, iban}, "establishments": [...], "akeed_ibans": {...} },
  "transactions": [ { "source", "timestamp", "amount", "direction", "raw_desc", "counterparty_iban?" } ]
}
```

- **`fahd.json`** — the flagship demo. Bank-only view = **SAR 4,000** salary; Tabaqa
  surfaces **SAR 10,000** true income (4,000 salary `amount-verified` + 5,200 gig
  `source-verified` + 800 P2P `inferred`), reconciles the Barq transfer as internal
  movement, and scores **82 / APPROVE** (PD 4.1%). Three months of data so the
  regularity / volatility / NSF features are well-defined.

Add more applicants by dropping another `*.json` here with a unique
`connection_id` — the API auto-registers it on startup.

## `berka/` (not included)

Place the Berka `loan.asc` / `trans.asc` / `account.asc` tables here, then run
`python -m scoring.train` to fit and persist the `optbinning` scorecard. Obtain
Berka from the PKDD'99 Discovery Challenge dataset (publicly archived). Not
committed — it's large and externally licensed.
