"""Tabaqa API — FastAPI service exposing the score, profile, and access form.

Run from the app/ directory so the sibling ``pipeline`` and ``scoring`` packages
import cleanly:

    cd app && uvicorn api.main:app --reload

The demo loads the synthetic "Fahd" statement (data/synthetic/fahd.json), runs it
through the full pipeline, and scores it — so /v1/score returns the exact reveal
(4,000 → 10,000) and score (82) shown on the landing page.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Make the sibling packages importable regardless of launch cwd.
APP_DIR = Path(__file__).resolve().parents[1]
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from pipeline import run_pipeline, ProfileResult, synthesize_fixture  # noqa: E402
from pipeline.ingest_csv import build_fixture_from_statement  # noqa: E402
from scoring import score_profile  # noqa: E402
from affordability import affordability  # noqa: E402

from .models import (  # noqa: E402
    AccessRequest,
    AffordabilityRequest,
    AffordabilityResponse,
    FeaturesModel,
    IncomeComponentModel,
    IncomeModel,
    PersonaModel,
    ProfileResponse,
    ReasonCodeModel,
    ScoreRequest,
    ScoreResponse,
    TransactionModel,
)
from .personas import list_personas, persona_fixtures  # noqa: E402

DATA_DIR = APP_DIR / "data" / "synthetic"

app = FastAPI(
    title="Tabaqa API",
    version="1.0.0",
    description="The credit-intelligence layer for Saudi open banking — verified 1–99 score + risk flag.",
)

def _cors_origins() -> list[str]:
    """Allowed origins from CORS_ORIGINS (comma-separated, or '*'); dev default otherwise."""
    env = os.environ.get("CORS_ORIGINS", "").strip()
    if not env:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]
    return [o.strip() for o in env.split(",") if o.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── fixture registry: connection_id → fixture file ────────────────────────
def _load_fixtures() -> dict[str, dict]:
    registry: dict[str, dict] = {}
    for path in DATA_DIR.glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        conn = data.get("applicant", {}).get("connection_id")
        if conn:
            registry[conn] = data
    return registry


FIXTURES = _load_fixtures()
# Register synthesized persona fixtures so /v1/score {connection_id} works for them too.
for _conn, _fx in persona_fixtures().items():
    FIXTURES.setdefault(_conn, _fx)
PERSONAS = list_personas()  # headline gallery summaries, computed once at startup

_ACCESS_REQUESTS: list[dict] = []  # demo store; swap for Supabase in production


def _income_model(result: ProfileResult) -> IncomeModel:
    inc = result.income
    return IncomeModel(
        true_monthly_income=inc.total_income,
        bank_only_income=inc.bank_only_income,
        verified_income=inc.verified_income,
        verified_share=inc.verified_share,
        reveal_delta=round(inc.reveal_delta, 2),
        components=[IncomeComponentModel(**c.__dict__) for c in inc.components],
    )


def _transaction_models(result: ProfileResult) -> list[TransactionModel]:
    return [
        TransactionModel(
            source=t.source,
            timestamp=t.timestamp,
            amount=t.amount,
            direction=t.direction,
            raw_desc=t.raw_desc,
            merchant=t.merchant,
            category=t.category,
            txn_type=t.txn_type,
            verification=t.verification,
            verified_via=t.verified_via,
        )
        for t in result.transactions
    ]


def _profile_for(connection_id: str) -> ProfileResult:
    fixture = FIXTURES.get(connection_id)
    if fixture is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown connection_id '{connection_id}'. Known: {sorted(FIXTURES)}",
        )
    return run_pipeline(fixture)


def _result_from_request(req: ScoreRequest) -> ProfileResult:
    """Resolve any of {connection_id, form, statement, fixture} → a scored profile.

    Reuses the same engine for every path: a preset fixture, a synthesized form,
    an uploaded CSV statement, or a full inline fixture.
    """
    if req.connection_id is not None:
        return _profile_for(req.connection_id)
    if req.form is not None:
        # by_alias so P2PForm.from_ serializes back to "from" for synthesize.py
        return run_pipeline(synthesize_fixture(req.form.model_dump(by_alias=True)))
    if req.statement is not None:
        fixture = build_fixture_from_statement({
            "name": req.statement.name,
            "rows": [r.model_dump() for r in req.statement.rows],
            "context": req.statement.context.model_dump(),
        })
        return run_pipeline(fixture)
    return run_pipeline(req.fixture)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "connections": sorted(FIXTURES)}


@app.post("/v1/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    try:
        result = _result_from_request(req)
    except HTTPException:
        raise
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=422, detail=f"Could not process the input: {e}")
    sr = score_profile(result.features, result.income)
    return ScoreResponse(
        tabaqa_score=sr.tabaqa_score,
        pd=sr.pd,
        risk_flag=sr.risk_flag,
        verified_income=result.income.total_income,
        reasons=sr.reasons,
        income=_income_model(result),
        reason_codes=[ReasonCodeModel(**rc.__dict__) for rc in sr.reason_codes],
        applicant=result.applicant,
        features=FeaturesModel(**result.features.to_dict()),
        transactions=_transaction_models(result),
    )


@app.get("/v1/profile", response_model=ProfileResponse)
def profile(connection_id: str = "con_8842") -> ProfileResponse:
    result = _profile_for(connection_id)
    return ProfileResponse(
        applicant=result.applicant,
        income=_income_model(result),
        features=FeaturesModel(**result.features.to_dict()),
        transactions=_transaction_models(result),
    )


@app.post("/v1/affordability", response_model=AffordabilityResponse)
def affordability_route(req: AffordabilityRequest) -> AffordabilityResponse:
    """Service ② — installment, DBR before/after, max financing, decision.

    Income source is either a scored connection_id (reuse Service ①'s verified
    income + risk) or a directly-supplied verified_income.
    """
    bank_only = req.bank_only_income
    if req.connection_id is not None:
        result = _profile_for(req.connection_id)
        inc, feats = result.income, result.features
        verified_income = inc.total_income
        bank_only = inc.bank_only_income
        existing = (req.existing_obligations if req.existing_obligations is not None
                    else round(feats.recurring_obligation_load * inc.total_income, 2))
        sr = score_profile(feats, inc)
        risk_flag, pd = sr.risk_flag, sr.pd
    else:
        verified_income = req.verified_income or 0.0
        existing = req.existing_obligations or 0.0
        risk_flag, pd = req.risk_flag, None

    if verified_income <= 0:
        raise HTTPException(status_code=422, detail="verified_income must be greater than 0")

    res = affordability(req.amount, req.tenor_months, req.annual_rate,
                        verified_income, existing, req.dbr_cap, risk_flag, pd)

    # The reveal headline: what bank-only income alone would unlock (often a DECLINE).
    bank_block = None
    if bank_only is not None and bank_only > 0:
        b = affordability(req.amount, req.tenor_months, req.annual_rate,
                          bank_only, existing, req.dbr_cap, risk_flag, pd)
        bank_block = {"verified_income": bank_only, "dbr_after": b.dbr_after,
                      "max_financing": b.max_financing, "decision": b.decision}

    return AffordabilityResponse(
        installment=res.installment, dbr_before=res.dbr_before, dbr_after=res.dbr_after,
        dbr_cap=res.dbr_cap, max_installment=res.max_installment, max_financing=res.max_financing,
        decision=res.decision, annuity_factor=res.annuity_factor, pd=res.pd, reasons=res.reasons,
        verified_income=verified_income, bank_only_income=bank_only, bank_only=bank_block,
    )


@app.get("/v1/personas", response_model=list[PersonaModel])
def personas() -> list[dict]:
    """Sample applicants for the gallery — headline numbers from the real pipeline."""
    return PERSONAS


@app.post("/v1/access-request")
def access_request(req: AccessRequest) -> dict:
    """Capture a 'Request access' submission (demo: in-memory)."""
    _ACCESS_REQUESTS.append(req.model_dump())
    return {"ok": True, "message": "Request received — we'll reach out within one business day."}
