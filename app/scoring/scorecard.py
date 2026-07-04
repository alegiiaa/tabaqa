"""[5] Score → 1–99 PD + reason codes.

A transparent, additive points model — the same shape ``optbinning.Scorecard``
produces (binned features → points → score), kept dependency-free so the demo
runs anywhere. Every point of the score is attributable to a feature bin, which
is exactly what a SAMA-minded reviewer wants: no black box.

Direction-locked, not magnitude-locked
--------------------------------------
This is an **expert policy card pinned to a real-data fit at the level the fit
actually supports: direction.** ``scoring/train.py`` fits the same six cash-flow
features on Berka default outcomes (6-feature fit: 30% holdout AUC 0.890 /
5-fold CV 0.858 — a sub-metric; the headline is the full-model CV AUC 0.864 in
``eval/model_card.json`` → ``performance_ledger``) and writes
``scoring/model_params.json``. At import ``_verify_lineage`` machine-checks that
**every weight here points the same way the fit found** — a feature the model
says lowers risk must earn points here, and vice versa. The one exception
(``income_expense_ratio``) is a documented monotonic override, mirroring
``optbinning``'s ``monotonic_trend`` (see model_params.json). Each score then
carries its provenance: the validation metrics plus each reason code's
Information Value. Offline (no artifact) the card still scores — it simply
omits the provenance.

What we do NOT claim: that these point *magnitudes* equal the fitted
coefficients (they are policy weights; the fit's |coef| ranking differs — a
fact disclosed in the model card, not hidden), nor that a Czech-1990s fit
transfers numerically to Saudi wallets. At deployment the same pipeline
re-fits magnitudes on the licensee's own book (``train.py`` is the path); the
direction lock keeps the served card from ever *contradicting* the validated
fit in the meantime.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path

from pipeline.features import CashFlowFeatures
from pipeline.verify import IncomeProfile

BASE_POINTS = 20

# ── validated parameters (Berka fit) ──────────────────────────────────────────
_PARAMS_PATH = Path(__file__).resolve().parent / "model_params.json"


def _load_params() -> dict | None:
    try:
        return json.loads(_PARAMS_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return None  # offline / no artifact → card still scores, without provenance


MODEL_PARAMS = _load_params()

# Direction each served feature rewards: "higher" = more points as the feature rises
# (feature is protective), "lower" = fewer points as it rises (feature is risky).
# verified_income_share is the wallet-reveal signal — no Berka analogue, so it is
# expert-set and excluded from the lineage check.
_SERVED_SAFER_WHEN = {
    "income_regularity": "higher",
    "nsf_count": "lower",
    "income_expense_ratio": "higher",   # documented override vs the fit's flipped sign
    "min_balance": "higher",
    "balance_volatility": "lower",
    "recurring_obligation_load": "lower",
}


def _verify_lineage(params: dict) -> None:
    """Fail loudly if any served weight contradicts the validated fit's direction.

    This is the safeguard that keeps the demo card from silently drifting away from
    the model it claims to be validated by. Passes for the committed state (five
    features agree with the fit, one is a documented monotonic override).
    """
    fit = params.get("features", {})
    overrides = params.get("direction_overrides", {})
    for feat, served in _SERVED_SAFER_WHEN.items():
        info = fit.get(feat)
        if info is None:
            continue  # fit doesn't cover this feature (nothing to contradict)
        if info["safer_when"] != served and feat not in overrides:
            raise AssertionError(
                f"scorecard direction for '{feat}' (safer_when={served}) contradicts the "
                f"validated fit (safer_when={info['safer_when']}) with no documented override. "
                f"Re-check scoring/scorecard.py against scoring/model_params.json."
            )


if MODEL_PARAMS is not None:
    _verify_lineage(MODEL_PARAMS)


def _feature_iv(feature: str) -> float | None:
    if MODEL_PARAMS is None:
        return None
    info = MODEL_PARAMS.get("features", {}).get(feature)
    return info["iv"] if info else None


def _validation_block() -> dict | None:
    """The provenance stamped onto every score: what real-data fit backs this card."""
    if MODEL_PARAMS is None:
        return None
    m = MODEL_PARAMS.get("metrics", {})
    s = MODEL_PARAMS.get("sample", {})
    src = MODEL_PARAMS.get("source", {})
    return {
        "validated": True,
        "auc": m.get("holdout_auc"),
        "ks": m.get("holdout_ks"),
        "cv_auc": m.get("cv_auc"),
        "dataset": src.get("dataset"),
        "accounts": s.get("accounts"),
        "bad_rate": s.get("bad_rate"),
        "basis": "6 cash-flow features · logistic · 30% holdout (direction-lock fit)",
        "note": ("Expert policy card direction-locked to this fit (sign, not magnitude); "
                 "magnitudes re-fit on the licensee's book at deployment. "
                 "See model_card.json performance_ledger."),
    }


@dataclass
class ReasonCode:
    code: str       # machine-readable, e.g. "regular_income"
    label: str      # plain-language explanation
    points: int     # signed contribution to the score
    polarity: str   # "positive" | "negative"
    feature: str = ""            # the cash-flow feature this bin reads
    iv: float | None = None      # validated Information Value (Berka fit), if known


@dataclass
class ScoreResult:
    tabaqa_score: int                       # 1–99 (higher = lower risk)
    pd: float                               # probability of default
    risk_flag: str                          # low | medium | high
    reasons: list[str]                      # top machine codes (API headline)
    reason_codes: list[ReasonCode] = field(default_factory=list)
    base_points: int = BASE_POINTS
    validation: dict | None = None          # real-data provenance (Berka fit) or None offline

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


def _bin(value, bins):
    """Return (points, code, label) for the first matching (threshold, ...) bin.

    ``bins`` is a list of (predicate, points, code, label); first match wins.
    """
    for predicate, points, code, label in bins:
        if predicate(value):
            return points, code, label
    return 0, "", ""


def score_profile(features: CashFlowFeatures, income: IncomeProfile | None = None) -> ScoreResult:
    """Map the six cash-flow features to a 1–99 score + reason codes."""
    f = features
    ratio = f.income_expense_ratio
    if ratio == float("inf"):
        ratio = 99.0  # no expenses observed → treat as very healthy

    contributions: list[ReasonCode] = []

    def add(points, code, label, feature):
        if points != 0:
            contributions.append(
                ReasonCode(code, label, points, "positive" if points > 0 else "negative",
                           feature=feature, iv=_feature_iv(feature))
            )

    # 1 — income regularity
    p, c, l = _bin(f.income_regularity, [
        (lambda v: v >= 0.8, 18, "regular_income", "Income arrives on a regular monthly schedule"),
        (lambda v: v >= 0.6, 12, "regular_income", "Income is mostly regular"),
        (lambda v: v >= 0.4, 6, "irregular_income", "Income is somewhat irregular"),
        (lambda v: True, -6, "irregular_income", "Income is irregular / sporadic"),
    ])
    add(p, c, l, "income_regularity")

    # 2 — verified income share (the wallet reveal, Masdr-backed)
    p, c, l = _bin(f.verified_income_share, [
        (lambda v: v >= 0.7, 14, "wallet_income_verified", "Most income is Masdr-verified (amount or source)"),
        (lambda v: v >= 0.4, 8, "wallet_income_verified", "A meaningful share of income is verified"),
        (lambda v: True, 0, "", ""),
    ])
    add(p, c, l, "verified_income_share")

    # 3 — NSF / overdraft events
    p, c, l = _bin(f.nsf_count, [
        (lambda v: v == 0, 12, "zero_nsf", "No NSF or overdraft events observed"),
        (lambda v: v <= 2, 3, "some_nsf", "Few NSF / overdraft events"),
        (lambda v: True, -12, "frequent_nsf", "Frequent NSF / overdraft events"),
    ])
    add(p, c, l, "nsf_count")

    # 4 — income / expense ratio
    p, c, l = _bin(ratio, [
        (lambda v: v >= 1.4, 8, "healthy_cashflow", "Spends well under income"),
        (lambda v: v >= 1.15, 5, "healthy_cashflow", "Spends under income"),
        (lambda v: v >= 1.0, 1, "tight_cashflow", "Income roughly equals spend"),
        (lambda v: True, -8, "negative_cashflow", "Spends more than income"),
    ])
    add(p, c, l, "income_expense_ratio")

    # 5 — minimum balance buffer
    p, c, l = _bin(f.min_balance, [
        (lambda v: v >= 1000, 6, "positive_buffer", "Maintains a healthy minimum balance"),
        (lambda v: v >= 0, 2, "thin_buffer", "Thin minimum-balance buffer"),
        (lambda v: True, -8, "negative_buffer", "Balance goes negative"),
    ])
    add(p, c, l, "min_balance")

    # 6 — balance volatility (coefficient of variation)
    p, c, l = _bin(f.balance_volatility, [
        (lambda v: v <= 0.4, 4, "stable_balance", "Stable account balance"),
        (lambda v: v <= 0.8, 1, "moderate_volatility", "Moderately volatile balance"),
        (lambda v: True, -4, "volatile_balance", "Highly volatile balance"),
    ])
    add(p, c, l, "balance_volatility")

    # recurring-obligation load (modifier — already one of the six signals)
    p, c, l = _bin(f.recurring_obligation_load, [
        (lambda v: v <= 0.3, 0, "low_debt_load", "Light recurring-debt load"),
        (lambda v: v <= 0.5, -5, "elevated_debt_load", "Elevated recurring-debt load"),
        (lambda v: True, -12, "high_debt_load", "High recurring-debt load"),
    ])
    add(p, c, l, "recurring_obligation_load")

    raw = BASE_POINTS + sum(rc.points for rc in contributions)
    score = max(1, min(99, round(raw)))

    pd = max(0.002, min(0.99, round(1.39 * (1 - score / 99) ** 2, 3)))
    risk_flag = "low" if pd < 0.06 else "medium" if pd < 0.15 else "high"

    # headline reasons = strongest contributors (by absolute points)
    ranked = sorted(contributions, key=lambda rc: abs(rc.points), reverse=True)
    reasons = [rc.code for rc in ranked if rc.code][:3]

    return ScoreResult(
        tabaqa_score=score,
        pd=pd,
        risk_flag=risk_flag,
        reasons=reasons,
        reason_codes=ranked,
        validation=_validation_block(),
    )


# ── D2 · actionable recourse: the smallest change that moves the decision ──────
# The score maps to a risk band → a decision: high(≤66)=DECLINE, medium(67–78)=REVIEW,
# low(≥79)=APPROVE (bands derived from the PD curve, so they can't drift from risk_flag).
# For a not-yet-approved profile we compute the fewest feature improvements that lift
# the score into the next band — a counterfactual / recourse, not a black-box "no".
#
# We only need each feature's TOP-bin points + threshold (not the whole ladder). These
# mirror score_profile's bins and are asserted against it at import (_verify_recourse_max),
# so they can't silently drift. verified_income_share leads: it's the wallet-reveal lever
# and the most actionable — "verify more of your income" is Tabaqa's whole point.
FEATURE_MAX_POINTS = {
    "income_regularity": 18,
    "verified_income_share": 14,
    "nsf_count": 12,
    "income_expense_ratio": 8,
    "min_balance": 6,
    "balance_volatility": 4,
    "recurring_obligation_load": 0,
}

# (comparator, target value) — the threshold of each feature's best bin, for display.
FEATURE_TARGET = {
    "income_regularity": (">=", 0.8),
    "verified_income_share": (">=", 0.7),
    "nsf_count": ("<=", 0),
    "income_expense_ratio": (">=", 1.4),
    "min_balance": (">=", 1000),
    "balance_volatility": ("<=", 0.4),
    "recurring_obligation_load": ("<=", 0.3),
}

# lower = suggested earlier (more actionable / more on-brand). Tie-breaker only.
_ACTIONABILITY = {
    "verified_income_share": 0, "nsf_count": 1, "min_balance": 2,
    "recurring_obligation_load": 3, "income_expense_ratio": 4,
    "balance_volatility": 5, "income_regularity": 6,
}

# Anti-gaming guardrail: recourse only coaches levers that lower TRUE risk — behaviours
# that require real money movement (reveal income via Masdr, avoid overdrafts, hold a
# real buffer, pay down obligations, spend under income). income_regularity and
# balance_volatility are deliberately EXCLUDED from coaching: both can be spoofed with
# self-transfer patterns without changing underlying risk, so recommending them would
# invite gaming (they still score — we just never *advise* optimizing them).
RECOURSE_ELIGIBLE = frozenset({
    "verified_income_share", "nsf_count", "min_balance",
    "recurring_obligation_load", "income_expense_ratio",
})

RECOURSE_NOTE = ("Indicative path, not a promise: point gains are the policy card's "
                 "weights (direction-validated against the fit), and the decision is "
                 "always re-scored on verified data.")

MAX_SCORE = BASE_POINTS + sum(FEATURE_MAX_POINTS.values())  # the reachable ceiling (82)


def _band_from_score(score: int) -> str:
    pd = max(0.002, min(0.99, round(1.39 * (1 - score / 99) ** 2, 3)))
    return "low" if pd < 0.06 else "medium" if pd < 0.15 else "high"


def _min_score_for_band(band: str) -> int:
    for s in range(1, 100):
        if _band_from_score(s) == band:
            return s
    return 99


@dataclass
class RecourseStep:
    feature: str
    from_points: int
    to_points: int
    gain: int
    comparator: str          # ">=" | "<="
    target_value: float      # the level to reach for the top bin
    current_value: float | None = None


@dataclass
class Recourse:
    current_score: int
    current_band: str        # low | medium | high
    target_band: str         # the next band up
    target_score: int        # minimum score for that band
    target_decision: str     # REVIEW | APPROVE — what the band unlocks
    gap: int                 # points needed
    reachable: bool          # can incremental improvement close it?
    projected_score: int     # score after applying the steps
    already_prime: bool
    steps: list = field(default_factory=list)  # list[RecourseStep]
    note: str = RECOURSE_NOTE                  # anti-overclaim disclaimer, always served

    def to_dict(self) -> dict:
        return asdict(self)


def recommend_recourse(result: ScoreResult, features: CashFlowFeatures) -> Recourse:
    """The minimal set of feature improvements that lifts the score into the next band."""
    score = result.tabaqa_score
    band = _band_from_score(score)
    cur_pts = {rc.feature: rc.points for rc in result.reason_codes if rc.feature}

    if band == "low":  # already approvable — no recourse needed
        return Recourse(score, band, "low", score, "APPROVE", 0, True, score, True, [])

    target_band = "medium" if band == "high" else "low"
    target_decision = "REVIEW" if target_band == "medium" else "APPROVE"
    target_score = _min_score_for_band(target_band)
    gap = max(0, target_score - score)

    fvals = features.to_dict()
    candidates: list[RecourseStep] = []
    for feat, maxp in FEATURE_MAX_POINTS.items():
        if feat not in RECOURSE_ELIGIBLE:
            continue  # never coach a spoofable lever (see RECOURSE_ELIGIBLE)
        cur = cur_pts.get(feat, 0)
        gain = maxp - cur
        if gain <= 0:
            continue
        comp, tval = FEATURE_TARGET[feat]
        candidates.append(RecourseStep(
            feature=feat, from_points=cur, to_points=maxp, gain=gain,
            comparator=comp, target_value=tval, current_value=fvals.get(feat),
        ))
    # fewest steps → biggest gains first; ties broken toward the more actionable lever
    candidates.sort(key=lambda s: (-s.gain, _ACTIONABILITY.get(s.feature, 9)))

    total_available = sum(c.gain for c in candidates)
    reachable = total_available >= gap
    if reachable:
        chosen, acc = [], 0
        for s in candidates:
            if acc >= gap:
                break
            chosen.append(s)
            acc += s.gain
        projected = min(MAX_SCORE, score + acc)
    else:
        chosen = candidates  # best effort — everything, still short of the target
        projected = min(MAX_SCORE, score + total_available)

    return Recourse(score, band, target_band, target_score, target_decision,
                    gap, reachable, projected, False, chosen)


# ── D3 · score confidence (data-sufficiency band) ─────────────────────────────
# The point score is only as trustworthy as the data behind it. A score built on
# 6 months of mostly-verified income is far more reliable than one built on 30 days
# of mostly-inferred income. We surface that honestly as a ± band whose width grows
# as history shortens and verification drops. This is a DATA-SUFFICIENCY signal —
# not a statistical confidence interval — and is labelled as such in the UI.
_CONF_FULL_MONTHS = 6.0     # ≥ 6 months earns full history credit
_CONF_BAND_MIN = 2          # ± at full sufficiency
_CONF_BAND_SPAN = 10        # extra ± at zero sufficiency (→ max ±12)


@dataclass
class ScoreConfidence:
    level: str               # high | medium | low
    band: int                # ± half-width on the 1–99 scale
    low: int                 # score − band (clamped to 1..99)
    high: int                # score + band (clamped to 1..99)
    sufficiency: float       # 0..1 — how much data backs the score
    months_observed: int
    verified_income_share: float

    def to_dict(self) -> dict:
        return asdict(self)


# ── D5 · percentile vs the 1M-account corpus (turns the corpus into a live ruler) ─
_QUANTILES_PATH = Path(__file__).resolve().parent / "corpus_quantiles.json"


def _load_quantiles() -> dict | None:
    try:
        return json.loads(_QUANTILES_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return None


CORPUS_QUANTILES = _load_quantiles()


@dataclass
class FeaturePercentile:
    feature: str
    value: float
    percentile: int          # position in the corpus (0..100)
    better_than: int         # % of the book this applicant beats (direction-aware)


@dataclass
class Benchmark:
    available: bool
    n: int = 0               # corpus size the percentiles are drawn from
    features: list = field(default_factory=list)  # list[FeaturePercentile]

    def to_dict(self) -> dict:
        return asdict(self)


def _percentile(value: float, grid: list) -> int:
    # grid is 101 ascending quantile points (0th..100th pct); find where value lands
    lo, hi = 0, len(grid) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if grid[mid] < value:
            lo = mid + 1
        else:
            hi = mid
    return max(0, min(100, lo))


def benchmark_features(features: CashFlowFeatures) -> Benchmark:
    q = CORPUS_QUANTILES
    if not q:
        return Benchmark(available=False)
    fvals = features.to_dict()
    hib = q.get("higher_is_better", {})
    rows: list[FeaturePercentile] = []
    for feat, grid in q.get("features", {}).items():
        v = fvals.get(feat)
        if v is None:
            continue
        p = _percentile(float(v), grid)
        better = p if hib.get(feat, True) else 100 - p
        rows.append(FeaturePercentile(feature=feat, value=round(float(v), 3),
                                      percentile=p, better_than=better))
    return Benchmark(available=True, n=int(q.get("n", 0)), features=rows)


def score_confidence(features: CashFlowFeatures, score: int) -> ScoreConfidence:
    m = min(max(features.months_observed, 0) / _CONF_FULL_MONTHS, 1.0)
    v = min(max(features.verified_income_share, 0.0), 1.0)
    sufficiency = round(0.55 * m + 0.45 * v, 3)           # history weighs slightly more
    band = round(_CONF_BAND_MIN + (1 - sufficiency) * _CONF_BAND_SPAN)
    level = "high" if sufficiency >= 0.75 else "medium" if sufficiency >= 0.45 else "low"
    return ScoreConfidence(
        level=level, band=band,
        low=max(1, score - band), high=min(99, score + band),
        sufficiency=sufficiency,
        months_observed=int(features.months_observed),
        verified_income_share=round(v, 3),
    )


def _verify_recourse_max() -> None:
    """Guard: the recourse top-bin table must match what score_profile actually awards."""
    ideal = CashFlowFeatures(
        income_regularity=1.0, income_expense_ratio=2.0, avg_balance=5000.0,
        min_balance=5000.0, nsf_count=0, recurring_obligation_load=0.0,
        balance_volatility=0.1, months_observed=6, verified_income_share=1.0,
    )
    sr = score_profile(ideal)
    got = {rc.feature: rc.points for rc in sr.reason_codes if rc.feature}
    for feat, maxp in FEATURE_MAX_POINTS.items():
        if maxp != 0 and got.get(feat, 0) != maxp:
            raise AssertionError(
                f"recourse FEATURE_MAX_POINTS[{feat}]={maxp} contradicts score_profile "
                f"(awards {got.get(feat, 0)} at best). Re-sync with the bins above."
            )
    if sr.tabaqa_score != min(99, MAX_SCORE):
        raise AssertionError(f"recourse ceiling {MAX_SCORE} != score_profile max {sr.tabaqa_score}")


_verify_recourse_max()
