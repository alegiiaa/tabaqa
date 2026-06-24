"""End-to-end smoke test for the Tabaqa demo (no external deps).

    python smoke_test.py        # run from the app/ directory

Runs the synthetic Fahd statement through the full pipeline + scorer and asserts
the reveal and score that the landing page advertises.
"""
from __future__ import annotations

import json
from pathlib import Path

from pipeline import run_pipeline
from scoring import score_profile

FIXTURE = Path(__file__).resolve().parent / "data" / "synthetic" / "fahd.json"


def main() -> None:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    result = run_pipeline(fixture)
    inc = result.income
    feats = result.features
    sr = score_profile(feats, inc)

    print("── Income reveal ──")
    print(f"  bank-only income : SAR {inc.bank_only_income:,.0f}")
    print(f"  true income      : SAR {inc.total_income:,.0f}  (+{inc.reveal_delta:,.0f})")
    for c in inc.components:
        print(f"    - {c.label:<32} {c.monthly_amount:>7,.0f}  [{c.verification}]")
    print(f"  verified share   : {inc.verified_share:.0%}")

    print("\n── Cash-flow features ──")
    for k, v in feats.to_dict().items():
        print(f"  {k:<28} {v}")

    print("\n── Score ──")
    print(f"  Tabaqa Score : {sr.tabaqa_score}")
    print(f"  PD           : {sr.pd}")
    print(f"  Risk flag    : {sr.risk_flag}")
    print(f"  Reasons      : {sr.reasons}")

    # ── assertions: the demo must reproduce the landing-page numbers ──
    assert inc.bank_only_income == 4000, inc.bank_only_income
    assert inc.total_income == 10000, inc.total_income
    assert feats.nsf_count == 0, feats.nsf_count
    assert sr.tabaqa_score == 82, sr.tabaqa_score
    assert sr.pd == 0.041, sr.pd
    assert sr.risk_flag == "low", sr.risk_flag
    assert sr.reasons == ["regular_income", "wallet_income_verified", "zero_nsf"], sr.reasons
    print("\n✓ all assertions passed — demo reproduces 4,000 → 10,000 and score 82")


if __name__ == "__main__":
    main()
