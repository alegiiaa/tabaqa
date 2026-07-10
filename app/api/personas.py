"""Sample applicants for the persona gallery (one-click testing).

Four contrasting profiles, each scored by the *real* pipeline so the gallery
shows honest headline numbers (true vs bank-only income, score, risk):

  • salaried_gig — the canonical Fahd reveal (salary + gig + P2P)   → loaded from disk
  • gig_driver   — gig-only, all income in the wallet (big reveal)  → synthesized
  • sme_owner    — small-business P2P inflows (inferred, low verified share)
  • thin_file    — short history, salary only (no hidden income → no reveal)

The synthesized fixtures are registered into the API's fixture registry so
``POST /v1/score {connection_id}`` works for personas too.
"""
from __future__ import annotations

import json
from pathlib import Path

from pipeline import synthesize_fixture, run_pipeline
from scoring import score_profile

_DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "synthetic"

# persona_id → (role label, form). connection_id is forced to "con_<id>" so it's
# stable and registrable.
_PERSONA_FORMS: dict[str, tuple[str, dict]] = {
    "gig_driver": ("Gig-only delivery driver", {
        "name": "Mansour — gig driver",
        "months": 3,
        "bank": {"name": "alrajhi", "opening_balance": 9000},
        "gigs": [{"platform": "Jahez", "monthly": 3800},
                 {"platform": "Careem", "monthly": 2400}],
        "monthly_spending": 1600,
    }),
    "sme_owner": ("Small-business owner", {
        "name": "Noura — small business",
        "months": 3,
        "bank": {"name": "snb", "opening_balance": 30000},
        "p2p": [{"from": "عملاء المتجر", "monthly": 12000}],
        "obligations": [{"label": "تمويل تشغيلي", "monthly": 2500}],
        "monthly_spending": 4000,
    }),
    "thin_file": ("Thin file — short history", {
        "name": "Khalid — thin file",
        "months": 2,
        "bank": {"name": "alinma", "opening_balance": 3500},
        "salary": {"monthly": 3200, "employer": "متجر التجزئة"},
        "monthly_spending": 1800,
    }),
}

# corpus-derived segment personas — representative archetypes drawn from the
# millions-scale synthetic corpus (data/synthetic/corpus_segments.json), each
# standing for a cohort of N accounts. Scored by the SAME real pipeline. Optional
# and guarded: if the corpus hasn't been generated, the gallery is unchanged.
try:
    from .corpus_personas import corpus_persona_forms

    _PERSONA_FORMS.update(corpus_persona_forms())
except Exception:
    pass


def _load_fahd() -> dict | None:
    path = _DATA_DIR / "fahd.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def _synth(persona_id: str, form: dict) -> dict:
    return synthesize_fixture({**form, "connection_id": f"con_{persona_id}"})


def persona_fixtures() -> dict[str, dict]:
    """{connection_id: fixture} for every persona — register these into FIXTURES."""
    out: dict[str, dict] = {}
    fahd = _load_fahd()
    if fahd:
        out[fahd["applicant"]["connection_id"]] = fahd
    for pid, (_role, form) in _PERSONA_FORMS.items():
        fx = _synth(pid, form)
        out[fx["applicant"]["connection_id"]] = fx
    return out


def _summarize(fixture: dict, persona_id: str, role: str) -> dict:
    r = run_pipeline(fixture)
    sr = score_profile(r.features, r.income)
    return {
        "id": persona_id,
        "connection_id": fixture["applicant"]["connection_id"],
        "name": fixture["applicant"]["name"],
        "role": role,
        "true_monthly_income": r.income.total_income,
        "bank_only_income": r.income.bank_only_income,
        "reveal_delta": round(r.income.reveal_delta, 2),
        "tabaqa_score": sr.tabaqa_score,
        "risk_flag": sr.risk_flag,
    }


# The committee show's cast leads the gallery: Omar (the obvious yes), Mansour
# (the trap — bank sees ~0), Yousef (the honest decline with a recourse path).
_STAGE_ORDER = ["seg_stable_salaried", "gig_driver", "seg_irregular_income"]


def list_personas() -> list[dict]:
    """Headline summaries for the gallery, computed once via the real pipeline."""
    out: list[dict] = []
    fahd = _load_fahd()
    if fahd:
        out.append(_summarize(fahd, "salaried_gig", "Salaried + gig (the reveal)"))
    for pid, (role, form) in _PERSONA_FORMS.items():
        out.append(_summarize(_synth(pid, form), pid, role))
    rank = {pid: i for i, pid in enumerate(_STAGE_ORDER)}
    out.sort(key=lambda p: rank.get(p["id"], len(_STAGE_ORDER)))
    return out


if __name__ == "__main__":
    for p in list_personas():
        print(f"{p['id']:14} score={p['tabaqa_score']:2} risk={p['risk_flag']:6} "
              f"bank_only={p['bank_only_income']:8.0f} true={p['true_monthly_income']:8.0f} "
              f"Δ={p['reveal_delta']:8.0f}  {p['name']}")
