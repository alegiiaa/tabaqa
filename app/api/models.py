"""Pydantic request/response models for the Tabaqa API."""
from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


# ── applicant-form inputs (synthesized → fixture) ──────────────────────────
class GigForm(BaseModel):
    platform: str
    monthly: float


class P2PForm(BaseModel):
    from_: str = Field(..., alias="from")  # 'from' is a reserved word
    monthly: float
    model_config = {"populate_by_name": True}


class ObligationForm(BaseModel):
    label: str
    monthly: float


class ApplicantForm(BaseModel):
    """High-level financial picture → synthesize_fixture → the real pipeline."""
    name: str = "Applicant"
    months: int = 3
    as_of: str | None = None
    bank: dict | None = None
    wallet: dict | None = None
    salary: dict | None = None
    gigs: list[GigForm] = Field(default_factory=list)
    p2p: list[P2PForm] = Field(default_factory=list)
    obligations: list[ObligationForm] = Field(default_factory=list)
    monthly_spending: float = 0.0
    connection_id: str | None = None


# ── uploaded-statement inputs (CSV rows → fixture) ─────────────────────────
class StatementRow(BaseModel):
    date: str
    description: str
    amount: float | None = None       # signed convention: +inflow / -outflow
    debit: float | None = None        # debit_credit convention
    credit: float | None = None
    source: str                       # "bank" | "wallet" | "bank:<name>" | "wallet:<name>"
    counterparty_iban: str | None = None
    balance: float | None = None
    currency: str = "SAR"


class VerificationContext(BaseModel):
    bank_name: str = "alinma"
    wallet_name: str = "barq"
    opening_balances: dict[str, float] = Field(default_factory=dict)
    amount_convention: str = "signed"  # "signed" | "debit_credit"
    employer: str | None = None
    salary_iban: str | None = None
    monthly_wage: float | None = None
    gig_platforms: list[str] = Field(default_factory=list)


class StatementInput(BaseModel):
    name: str = "Applicant"
    rows: list[StatementRow]
    context: VerificationContext = Field(default_factory=VerificationContext)


# ── requests ──────────────────────────────────────────────────────────────
class ScoreRequest(BaseModel):
    """Provide exactly one of: connection_id, form, statement, fixture."""
    connection_id: str | None = Field(default=None, examples=["con_8842"])
    form: ApplicantForm | None = None
    statement: StatementInput | None = None
    fixture: dict | None = None       # full inline {applicant,accounts,masdr,transactions}

    @model_validator(mode="after")
    def _exactly_one(self) -> "ScoreRequest":
        provided = [x for x in (self.connection_id, self.form, self.statement, self.fixture)
                    if x is not None]
        if len(provided) != 1:
            raise ValueError(
                "Provide exactly one of: connection_id, form, statement, fixture"
            )
        return self


class AffordabilityRequest(BaseModel):
    """Income source: pass connection_id (reuse Service ①) OR verified_income directly."""
    connection_id: str | None = None
    verified_income: float | None = None
    amount: float = Field(..., examples=[60000])
    tenor_months: int = Field(..., examples=[48])
    annual_rate: float = Field(..., examples=[0.10])
    existing_obligations: float | None = None
    dbr_cap: float = Field(default=0.3333, examples=[0.3333])
    bank_only_income: float | None = None
    risk_flag: str | None = None
    # SAMA responsible-lending profile (drives the regulator-grounded cap)
    customer_type: str | None = None       # "employee" | "retiree"; None → use dbr_cap
    redf_beneficiary: bool = False

    @model_validator(mode="after")
    def _income_source(self) -> "AffordabilityRequest":
        if self.connection_id is None and self.verified_income is None:
            raise ValueError("Provide connection_id or verified_income")
        return self


class AccessRequest(BaseModel):
    name: str
    email: str  # plain str — frontend does HTML5 email validation; avoids the
    # optional email-validator dependency for the demo.
    company: str
    usecase: str = "Other"


# ── API keys (the self-serve dev on-ramp) ──────────────────────────────────
class KeyRequest(BaseModel):
    """Self-serve issuance. Only sandbox keys are mintable here; live keys are
    granted through the lender access-request flow after review."""
    label: str | None = None
    email: str | None = None


class KeyResponse(BaseModel):
    api_key: str        # the plaintext — shown ONCE, never retrievable again
    key_prefix: str
    scope: str
    daily_limit: int
    docs_url: str
    note: str


# ── in-app assistant ───────────────────────────────────────────────────────
class AssistantMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AssistantRequest(BaseModel):
    messages: list[AssistantMessage]
    context: dict | None = None   # {section?, connected?} — guides the assistant


class AssistantResponse(BaseModel):
    reply: str
    suggestions: list[str] = Field(default_factory=list)
    source: str                   # "claude:<model>" | "rules"
    action: dict | None = None    # {type: navigate|open|none, section?, target?}


# ── shared sub-models ─────────────────────────────────────────────────────
class ReasonCodeModel(BaseModel):
    code: str
    label: str
    points: int
    polarity: str
    feature: str = ""                 # the cash-flow feature this bin reads
    iv: float | None = None           # validated Information Value (Berka fit), if known


class ValidationModel(BaseModel):
    """Provenance stamped onto every score: the real-data fit backing the card.

    The demo scorecard's weights are direction-locked to a logistic model fit on
    Berka default outcomes (see scoring/model_params.json); this reports its
    out-of-sample metrics so the credibility travels with the score.
    """
    validated: bool = True
    auc: float | None = Field(None, examples=[0.89])
    ks: float | None = Field(None, examples=[0.683])
    cv_auc: float | None = Field(None, examples=[0.858])
    dataset: str | None = Field(None, examples=["Berka / PKDD'99"])
    accounts: int | None = Field(None, examples=[682])
    bad_rate: float | None = Field(None, examples=[0.1114])
    note: str | None = None


class IncomeComponentModel(BaseModel):
    label: str
    monthly_amount: float
    txn_type: str
    verification: str  # amount_verified | source_verified | inferred
    verified_via: str


class IncomeModel(BaseModel):
    true_monthly_income: float   # the reveal — all sources
    bank_only_income: float      # what a bank-only view sees
    verified_income: float       # amount- or source-verified portion
    verified_share: float
    reveal_delta: float
    components: list[IncomeComponentModel]


class FeaturesModel(BaseModel):
    income_regularity: float
    income_expense_ratio: float
    avg_balance: float
    min_balance: float
    nsf_count: int
    recurring_obligation_load: float
    balance_volatility: float
    months_observed: int
    verified_income_share: float


class TransactionModel(BaseModel):
    source: str
    timestamp: str
    amount: float
    direction: str
    raw_desc: str
    merchant: str | None = None
    category: str | None = None
    txn_type: str
    verification: str
    verified_via: str
    pfc_primary: str | None = None      # Plaid PFC primary (industry-standard)
    pfc_detailed: str | None = None


class AccountModel(BaseModel):
    """One connected account — powers the designed bank/wallet cards."""
    source: str                  # "bank:alinma" | "wallet:barq"
    kind: str                    # "bank" | "wallet"
    provider: str                # "alinma" | "barq" | …
    opening_balance: float
    current_balance: float
    inflow: float
    outflow: float
    txn_count: int
    currency: str = "SAR"


class InsightsModel(BaseModel):
    """Financial-intelligence layer — the 'deep meaning' of the history.

    Deterministic signals (always present) + a narrative that is Claude-generated
    when an API key is set (``generated_by`` says which), else a templated fallback.
    Nested signal blocks are passed through as dicts (their shape is documented in
    ``pipeline/insights.py``) to avoid over-constraining a fast-moving surface.
    """
    summary_line: str
    narrative: str
    highlights: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    generated_by: str            # "claude:<model>" | "rules"
    income_trend: dict           # {direction, pct_change, monthly:[...]}
    diversification: dict        # {label, concentration, sources:[...]}
    spending: dict               # {monthly_total, by_category:[...], top_merchants:[...]}
    savings_rate: float
    runway_months: float | None = None
    recurring: dict              # {obligation_load, items:[...]}
    health: dict                 # {stability, resilience, diversification}
    flags: list[str] = Field(default_factory=list)


class RecourseStepModel(BaseModel):
    feature: str
    from_points: int
    to_points: int
    gain: int
    comparator: str                      # ">=" | "<="
    target_value: float
    current_value: float | None = None


class RecourseModel(BaseModel):
    """Actionable path from this score into the next risk band (D2)."""
    current_score: int
    current_band: str                    # low | medium | high
    target_band: str
    target_score: int
    target_decision: str                 # REVIEW | APPROVE
    gap: int
    reachable: bool
    projected_score: int
    already_prime: bool
    steps: list[RecourseStepModel] = Field(default_factory=list)
    note: str = ""                       # anti-overclaim disclaimer (P7 guardrail)


class ScoreConfidenceModel(BaseModel):
    """D3 — a data-sufficiency band on the score (not a statistical CI)."""
    level: str                           # high | medium | low
    band: int
    low: int
    high: int
    sufficiency: float
    months_observed: int
    verified_income_share: float


class FeaturePercentileModel(BaseModel):
    feature: str
    value: float
    percentile: int
    better_than: int


class BenchmarkModel(BaseModel):
    """D5 — where the applicant sits in the 1M-account corpus."""
    available: bool
    n: int = 0
    features: list[FeaturePercentileModel] = Field(default_factory=list)


# ── responses ─────────────────────────────────────────────────────────────
class ScoreResponse(BaseModel):
    tabaqa_score: int = Field(..., examples=[82])
    # the additive scorecard's starting points — score = base_points + Σ reason_codes.points
    # (then clamped to 1..99). Exposed so a client can render the exact decomposition.
    base_points: int = Field(20, examples=[20])
    pd: float = Field(..., examples=[0.041])
    risk_flag: str = Field(..., examples=["low"])
    verified_income: float = Field(
        ..., examples=[10000], description="Surfaced true monthly income (the reveal)."
    )
    reasons: list[str] = Field(..., examples=[["regular_income", "wallet_income_verified", "zero_nsf"]])
    income: IncomeModel
    reason_codes: list[ReasonCodeModel]
    # actionable recourse — the fewest changes that lift the score into the next band
    recourse: RecourseModel | None = None
    # D3 data-sufficiency confidence band + D5 percentile vs the 1M-account corpus
    confidence: ScoreConfidenceModel | None = None
    benchmark: BenchmarkModel | None = None
    # real-data provenance: the Berka fit (AUC 0.890) the weights are locked to
    validation: ValidationModel | None = None
    applicant: dict
    # full picture so one /v1/score call powers all four dashboard screens
    features: FeaturesModel | None = None
    transactions: list[TransactionModel] = Field(default_factory=list)
    accounts: list[AccountModel] = Field(default_factory=list)
    # deterministic insights (fast); /v1/insights returns the Claude-narrated version
    insights: InsightsModel | None = None


class ProfileResponse(BaseModel):
    applicant: dict
    income: IncomeModel
    features: FeaturesModel
    transactions: list[TransactionModel]
    accounts: list[AccountModel] = Field(default_factory=list)
    insights: InsightsModel | None = None


class AffordabilityResponse(BaseModel):
    installment: float
    dbr_before: float
    dbr_after: float
    dbr_cap: float
    max_installment: float
    max_financing: float
    decision: str                       # APPROVE | REVIEW | DECLINE
    annuity_factor: float
    pd: float | None = None
    reasons: list[str]
    verified_income: float
    bank_only_income: float | None = None
    # optional bank-only contrast (the reveal headline: what bank-only income alone unlocks)
    bank_only: dict | None = None
    # SAMA responsible-lending policy applied (cap + citation + total-DBR ceiling)
    dbr_policy: dict | None = None


class PersonaModel(BaseModel):
    id: str
    connection_id: str
    name: str
    role: str
    true_monthly_income: float
    bank_only_income: float
    reveal_delta: float
    tabaqa_score: int
    risk_flag: str
