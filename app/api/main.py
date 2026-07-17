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

from fastapi import Depends, FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from pipeline import run_pipeline, ProfileResult, synthesize_fixture  # noqa: E402
from pipeline.ingest_csv import build_fixture_from_statement  # noqa: E402
from pipeline.insights import build_insights  # noqa: E402
from scoring import (  # noqa: E402
    score_profile, recommend_recourse, score_confidence, benchmark_features,
)
from affordability import affordability  # noqa: E402
import lenders as lender_layer  # noqa: E402
import sama  # noqa: E402

from .models import (  # noqa: E402
    AccessRequest,
    AccountModel,
    AffordabilityRequest,
    AffordabilityResponse,
    FeaturesModel,
    IncomeComponentModel,
    IncomeModel,
    InsightsModel,
    KeyRequest,
    KeyResponse,
    LenderPolicyModel,
    OffersRequest,
    OffersResponse,
    PersonaModel,
    ProfileResponse,
    ReasonCodeModel,
    RecourseModel,
    ScoreConfidenceModel,
    BenchmarkModel,
    ScoreRequest,
    ScoreResponse,
    TransactionModel,
)
from .auth import KeyCtx, api_key  # noqa: E402
from . import keystore  # noqa: E402
from . import sandbox  # noqa: E402
from .personas import list_personas, persona_fixtures  # noqa: E402

DATA_DIR = APP_DIR / "data" / "synthetic"

app = FastAPI(
    title="Tabaqa API",
    version="1.0.0",
    description="The credit-intelligence layer for Saudi open banking — verified 1–99 score + risk flag.",
)

def _cors_origins() -> list[str]:
    """Allowed origins from CORS_ORIGINS (comma-separated, or '*'); dev default otherwise.

    capacitor://localhost is the iOS shell's WebView origin (HYBRID_PLAN §5a) — without
    it every fetch from the phone app is CORS-blocked and the journey silently degrades
    to the bundled-data fallback. Production must include it in CORS_ORIGINS too.
    """
    env = os.environ.get("CORS_ORIGINS", "").strip()
    if not env:
        return ["http://localhost:5173", "http://127.0.0.1:5173",
                "capacitor://localhost"]
    return [o.strip() for o in env.split(",") if o.strip()]


app.include_router(sandbox.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
    # Expose the rate-limit headers so the browser playground can read them.
    expose_headers=["X-RateLimit-Scope", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
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


def _account_models(result: ProfileResult) -> list[AccountModel]:
    """Per-account opening + current balance, derived from the unified ledger.

    Drives the designed bank/wallet cards. Current balance = opening + inflows −
    outflows for that source (the same convention the feature engine uses).
    """
    sources: list[str] = []
    for t in result.transactions:
        if t.source not in sources:
            sources.append(t.source)
    for src in result.opening_balances:  # accounts with no transactions still show
        if src not in sources:
            sources.append(src)

    accounts: list[AccountModel] = []
    for src in sources:
        txns = [t for t in result.transactions if t.source == src]
        inflow = sum(t.amount for t in txns if t.direction == "inflow")
        outflow = sum(t.amount for t in txns if t.direction != "inflow")
        opening = float(result.opening_balances.get(src, 0.0))
        kind, _, provider = src.partition(":")
        accounts.append(AccountModel(
            source=src,
            kind="wallet" if kind == "wallet" else "bank",
            provider=provider or kind,
            opening_balance=round(opening, 2),
            current_balance=round(opening + inflow - outflow, 2),
            inflow=round(inflow, 2),
            outflow=round(outflow, 2),
            txn_count=len(txns),
            currency=(txns[0].currency if txns else "SAR"),
        ))
    # banks first, then wallets — matches the visual order of the cards
    accounts.sort(key=lambda a: (a.kind != "bank", a.provider))
    return accounts


def _insights_model(result: ProfileResult, *, use_llm: bool) -> InsightsModel:
    """Build the financial-intelligence payload. ``use_llm=False`` is fast + offline
    (deterministic signals + templated narrative); ``True`` adds the Claude narrative."""
    return InsightsModel(**build_insights(result, use_llm=use_llm).to_dict())


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
            pfc_primary=t.pfc_primary,
            pfc_detailed=t.pfc_detailed,
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
def health(llm_check: int = 0) -> dict:
    # `keyed` tells the frontend whether real key issuance/metering is live (a
    # service_role key is configured) or the API is running in open demo mode.
    out = {"status": "ok", "connections": sorted(FIXTURES),
           "keyed": keystore.configured(), "sandbox": sandbox.summary()}
    if llm_check:  # opt-in ops probe: is the narrative LLM reachable from THIS runtime?
        from pipeline import llm as _llm
        provider = _llm._active()
        reply = None
        if provider == "groq":
            reply = _llm._groq_raw(_llm.INSIGHTS_MODEL, [{"role": "user", "content": "hi"}],
                                   max_tokens=8, temperature=0, json_mode=False)
        out["llm"] = {"provider": provider, "model": _llm.INSIGHTS_MODEL,
                      "reachable": bool(reply)}
    return out


@app.post("/v1/keys", response_model=KeyResponse)
def create_key(req: KeyRequest) -> KeyResponse:
    """Self-serve a **sandbox** key (surface ② — the developer on-ramp).

    Instant, no approval. Scoped to presets + uploaded statements, rate-limited
    per key. Live keys are granted separately through /v1/access-request after
    review. The plaintext key is returned exactly once — it is never stored.
    """
    if not keystore.configured():
        raise HTTPException(
            status_code=503,
            detail="Key issuance is offline (no keystore configured). The public "
                   "demo endpoints work without a key.",
        )
    minted = keystore.mint_key(scope="sandbox", label=req.label, owner_email=req.email)
    if minted is None:
        raise HTTPException(status_code=502, detail="Could not issue a key — try again.")
    return KeyResponse(
        api_key=minted["plaintext"],
        key_prefix=minted["prefix"],
        scope=minted["scope"],
        daily_limit=minted["daily_limit"],
        docs_url="https://tabaqa-api.vercel.app/docs",
        note="Store this key now — it is shown only once. Send it as "
             "'Authorization: Bearer <key>' on /v1/score, /v1/insights, /v1/affordability.",
    )


@app.post("/v1/score", response_model=ScoreResponse)
def score(req: ScoreRequest, ctx: KeyCtx = Depends(api_key)) -> ScoreResponse:
    try:
        result = _result_from_request(req)
    except HTTPException:
        raise
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=422, detail=f"Could not process the input: {e}")
    sr = score_profile(result.features, result.income)
    rec = recommend_recourse(sr, result.features)
    conf = score_confidence(result.features, sr.tabaqa_score)
    bench = benchmark_features(result.features)
    return ScoreResponse(
        tabaqa_score=sr.tabaqa_score,
        base_points=sr.base_points,
        pd=sr.pd,
        risk_flag=sr.risk_flag,
        verified_income=result.income.total_income,
        reasons=sr.reasons,
        income=_income_model(result),
        reason_codes=[ReasonCodeModel(**rc.__dict__) for rc in sr.reason_codes],
        recourse=RecourseModel(**rec.to_dict()),
        confidence=ScoreConfidenceModel(**conf.to_dict()),
        benchmark=BenchmarkModel(**bench.to_dict()),
        validation=sr.validation,
        applicant=result.applicant,
        features=FeaturesModel(**result.features.to_dict()),
        transactions=_transaction_models(result),
        accounts=_account_models(result),
        insights=_insights_model(result, use_llm=False),
    )


@app.get("/v1/profile", response_model=ProfileResponse)
def profile(connection_id: str = "con_8842") -> ProfileResponse:
    result = _profile_for(connection_id)
    return ProfileResponse(
        applicant=result.applicant,
        income=_income_model(result),
        features=FeaturesModel(**result.features.to_dict()),
        transactions=_transaction_models(result),
        accounts=_account_models(result),
        insights=_insights_model(result, use_llm=False),
    )


@app.post("/v1/insights", response_model=InsightsModel)
def insights(req: ScoreRequest, ctx: KeyCtx = Depends(api_key)) -> InsightsModel:
    """Service ③ — the deep financial-intelligence read of a money history.

    Same input shapes as /v1/score (connection_id | form | statement | fixture).
    Uses Claude for the narrative when ``ANTHROPIC_API_KEY`` is set, else a faithful
    deterministic template — the structured signals are identical either way.
    """
    try:
        result = _result_from_request(req)
    except HTTPException:
        raise
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=422, detail=f"Could not process the input: {e}")
    return _insights_model(result, use_llm=True)


@app.post("/v1/affordability", response_model=AffordabilityResponse)
def affordability_route(req: AffordabilityRequest,
                        ctx: KeyCtx = Depends(api_key)) -> AffordabilityResponse:
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

    # SAMA responsible-lending cap. When a customer_type is given the regulator cap
    # binds (employee 33.33% / retiree 25%); otherwise honour the caller's dbr_cap.
    # Either way we report the cited policy + the segment's total-DBR ceiling.
    policy = sama.resolve_policy(
        customer_type=req.customer_type or "employee",
        monthly_income=verified_income,
        redf_beneficiary=req.redf_beneficiary,
    )
    cap = policy.cap if req.customer_type is not None else req.dbr_cap

    res = affordability(req.amount, req.tenor_months, req.annual_rate,
                        verified_income, existing, cap, risk_flag, pd)

    # The reveal headline: what bank-only income alone would unlock (often a DECLINE).
    bank_block = None
    if bank_only is not None and bank_only > 0:
        b = affordability(req.amount, req.tenor_months, req.annual_rate,
                          bank_only, existing, cap, risk_flag, pd)
        bank_block = {"verified_income": bank_only, "dbr_after": b.dbr_after,
                      "max_financing": b.max_financing, "decision": b.decision}

    return AffordabilityResponse(
        installment=res.installment, dbr_before=res.dbr_before, dbr_after=res.dbr_after,
        dbr_cap=res.dbr_cap, max_installment=res.max_installment, max_financing=res.max_financing,
        decision=res.decision, annuity_factor=res.annuity_factor, pd=res.pd, reasons=res.reasons,
        verified_income=verified_income, bank_only_income=bank_only, bank_only=bank_block,
        dbr_policy=policy.to_dict(),
    )


@app.get("/v1/lenders", response_model=list[LenderPolicyModel])
def lenders_route() -> list[dict]:
    """The lender layer — every demo lender's **published product policy**.

    Score floor, DBR cap, amount/tenor range, rate tiers. This is what a marketplace
    runs on: real lenders never hand over their underwriting model, but they do publish
    product criteria. All lenders here are fictional and illustrative.
    """
    return [l.to_dict() for l in lender_layer.LENDERS]


@app.post("/v1/offers", response_model=OffersResponse)
def offers_route(req: OffersRequest, ctx: KeyCtx = Depends(api_key)) -> OffersResponse:
    """Service ④ — **the pricing engine**: one money picture in, real offers out.

    Every lender's published policy is run against the applicant's verified income and
    SAMA installment room, returning priced offers (amount · installment · rate · fee ·
    total cost), counter-offers where the request didn't fit, and the locked lenders
    with the exact reason — the path to the rest.

    Not a lead. Not a callback. A price.

    ``ceiling`` carries the whole derivation (income × SAMA cap − obligations = the
    installment room; × the annuity factor = the most any lender will extend), so no
    number here is ever granted without its arithmetic.

    With a ``connection_id`` the response also carries ``bank_only``: the same search
    run on the income a bank can see alone. For the demo applicant that is **0 full
    offers** against 4 — same person, same day, same lender policies.
    """
    if req.product not in lender_layer.PRODUCTS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown product '{req.product}'. Known: {list(lender_layer.PRODUCTS)}",
        )

    bank_only_block: dict | None = None

    if req.connection_id is not None:
        result = _profile_for(req.connection_id)
        inc, feats = result.income, result.features
        sr = score_profile(feats, inc)
        rec = recommend_recourse(sr, feats)

        obligations = (req.existing_obligations if req.existing_obligations is not None
                       else round(feats.recurring_obligation_load * inc.total_income, 2))
        inp = lender_layer.OfferInputs(
            income=req.verified_income or inc.total_income,
            obligations=obligations,
            score=req.tabaqa_score or sr.tabaqa_score,
            risk_flag=req.risk_flag or sr.risk_flag,
            recourse_projected=(None if rec.already_prime else rec.projected_score),
        )

        # The reveal, spoken in offers: the same engine on bank-visible income alone.
        if inc.bank_only_income and inc.bank_only_income > 0 and inc.reveal_delta > 0:
            bank_inp = lender_layer.OfferInputs(
                income=inc.bank_only_income, obligations=obligations,
                score=inp.score, risk_flag=inp.risk_flag,
            )
            b = lender_layer.compute_offers(bank_inp, req.product, req.amount, req.tenor_months)
            bank_only_block = {
                "income": inc.bank_only_income,
                "full_offer_count": b.full_offer_count,
                "offer_count": len(b.offers),
                "max_financing": b.ceiling.max_financing,
            }
    else:
        inp = lender_layer.OfferInputs(
            income=req.verified_income or 0.0,
            obligations=req.existing_obligations or 0.0,
            score=req.tabaqa_score or 0,
            risk_flag=req.risk_flag or "medium",
        )

    if inp.income <= 0:
        raise HTTPException(status_code=422, detail="verified_income must be greater than 0")

    try:
        res = lender_layer.compute_offers(inp, req.product, req.amount, req.tenor_months)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return OffersResponse(
        **res.to_dict(),
        bank_only=bank_only_block,
        disclaimer=lender_layer.DISCLAIMER,
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
