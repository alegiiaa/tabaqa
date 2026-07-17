"""Tabaqa Sandbox — the simulated upstream-provider environment (/sandbox/v1).

The demo journey needs five consented data sources (PRODUCT_SPEC §5, §16.3):
bank core, open-banking AIS, wallet, employment registry, credit bureau. In
production each is a licensed integration; in the sandbox each is a REAL HTTP
endpoint on this API serving the same raw payloads the frontend engine derives
from (web/src/data/<persona>/*.json) — same schema, same latency profile, keyed
by Luhn-valid *test* national IDs. Only the provider behind the URL is simulated.

HONESTY POSTURE: every response says so. The envelope carries
``environment: "sandbox"`` and ``simulated: true``, the payload metas already
carry ``(محاكاة)`` provider labels, and the directory endpoint states that no
live SIMAH/GOSI/bank connection exists. Swapping a provider for its production
integration is a base-URL change, not a rebuild — that is the point.

Deploy copy: the canonical payloads live in web/src/data (bundled into the web
app so the two can never drift). ``python -m api.sandbox sync`` snapshots them
into data/sandbox/ for slim API deployments that exclude web/.
"""
from __future__ import annotations

import asyncio
import json
import random
import sys
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException

APP_DIR = Path(__file__).resolve().parents[1]
_CANONICAL = APP_DIR / "web" / "src" / "data"   # source of truth (dev + full deploys)
_DEPLOY_COPY = APP_DIR / "data" / "sandbox"     # snapshot for slim API deploys

ENVIRONMENT = "sandbox"

# ── test identities ────────────────────────────────────────────────────────
# NINs are Luhn-valid (real Saudi IDs checksum) and match the masked digits in
# each persona's employment record (e.g. Ahmed's file says 1•••••4821), so the
# sandbox, the consent screen, and the raw payloads all tell one story.
IDENTITIES: dict[str, dict] = {
    "1084634821": {
        "persona": "ahmed",
        "name_ar": "أحمد القحطاني",
        "name_en": "Ahmed Al-Qahtani",
        "scenario": "approved — the consented, fused picture covers the full ask",
    },
    "2047183377": {
        "persona": "sara",
        "name_ar": "سارة الشمري",
        "name_en": "Sara Al-Shammari",
        "scenario": "declined — existing obligations exceed the regulatory cap",
    },
    "1069127734": {
        "persona": "khalid",
        "name_ar": "خالد العتيبي",
        "name_en": "Khalid Al-Otaibi",
        "scenario": "manual review — employment claim conflicts with salary transactions",
    },
}

# provider slug → (payload file, Arabic label, English label, base latency ms).
# Latencies mirror the frontend mock transport (connectors.ts) so the processing
# screen paces identically whichever layer serves the data. These five FEED THE
# DECISION — they map to the production integrations a bank can use today:
# credit-bureau = the SIMAH slot, employment = the GOSI slot, open-banking = AIS.
PROVIDERS: dict[str, tuple[str, str, str, int]] = {
    "bank-core": ("bank", "الأنظمة الأساسية للمصرف (محاكاة)", "Bank core systems (simulated)", 420),
    "open-banking": ("openbanking", "الخدمات المصرفية المفتوحة — AIS (محاكاة)", "Open banking AIS (simulated)", 650),
    "wallet": ("wallet", "مزوّد المحفظة الرقمية (محاكاة)", "Digital wallet provider (simulated)", 380),
    "employment": ("employment", "مصدر التوظيف والرواتب الرسمي (محاكاة)", "Employment & salary registry (simulated)", 300),
    "credit-bureau": ("credit", "مزوّد السجل الائتماني (محاكاة)", "Credit bureau (simulated)", 340),
}

# Roadmap providers — modeled and queryable per user, but they DO NOT feed the
# demo decision: their production integrations need agreements/frameworks that
# do not exist yet (open-finance investments, property registry, civil-registry
# household data). Kept separate so the decision engine's inputs stay exactly
# the regulator-clean five above. Health data has no slot at all — see /sehhaty.
ROADMAP_PROVIDERS: dict[str, tuple[str, str, int]] = {
    "household": ("السجلات المدنية — الحالة الاجتماعية والمعالون (محاكاة)",
                  "Civil registry — household (simulated)", 280),
    "investments": ("محفظة الاستثمار — الأسهم والصناديق (محاكاة)",
                    "Investment portfolio (simulated)", 360),
    "assets": ("سجل الأصول والعقارات (محاكاة)",
               "Asset & property registry (simulated)", 430),
}
ROADMAP_NOTE_AR = "تكامل مستقبلي — لا يدخل في قرار النسخة التجريبية الحالية"
ROADMAP_NOTE_EN = "future integration — not an input to the current demo decision"

DISCLAIMER = (
    "Tabaqa Sandbox: simulated provider responses over real HTTP. Schemas and "
    "latency mirror production integrations; no live bureau, registry, or bank "
    "connection exists and no real personal data is served."
)

# ── the synthetic cohort: 500,000 test identities, generated on demand ────────
# No storage: NIN ↔ cohort index is a reversible permutation (idx·PRIME mod 1e8,
# Luhn check digit appended), and every provider payload is rebuilt from
# random.Random(nin) — deterministic, so the same NIN always returns the same
# person, and any of the 500,000 can be queried instantly. All names/figures are
# synthetic; the three curated personas above remain the demo cast.

COHORT_SIZE = 500_000
_PERM = 15_485_863                      # odd, not div. by 5 → invertible mod 1e8
_PERM_INV = pow(_PERM, -1, 100_000_000)

def _luhn_check_digit(body: str) -> str:
    total = 0
    for i, ch in enumerate(body):
        d = int(ch)
        if i % 2 == 0:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return str((-total) % 10)


_PERM_SALT = 73_912_546  # shifts the sequence so even idx 0 reads like a natural ID

def cohort_nin(idx: int) -> str:
    body = f"1{((idx + _PERM_SALT) * _PERM) % 100_000_000:08d}"
    return body + _luhn_check_digit(body)


def _cohort_idx(nin: str) -> int | None:
    """Reverse of cohort_nin — None when the NIN is not one of the 500k."""
    if len(nin) != 10 or not nin.isdigit() or nin[0] != "1":
        return None
    if _luhn_check_digit(nin[:9]) != nin[9]:
        return None
    idx = ((int(nin[1:9]) * _PERM_INV) - _PERM_SALT) % 100_000_000
    return idx if idx < COHORT_SIZE and cohort_nin(idx) == nin else None


_FIRST = [("محمد", "Mohammed"), ("عبدالله", "Abdullah"), ("فهد", "Fahd"),
          ("سلطان", "Sultan"), ("ناصر", "Nasser"), ("تركي", "Turki"),
          ("سعد", "Saad"), ("ماجد", "Majed"), ("نورة", "Noura"),
          ("ريم", "Reem"), ("هند", "Hind"), ("منيرة", "Munira"),
          ("دانة", "Dana"), ("أمل", "Amal")]
_FAMILY = [("العتيبي", "Al-Otaibi"), ("الدوسري", "Al-Dosari"),
           ("المطيري", "Al-Mutairi"), ("الحربي", "Al-Harbi"),
           ("الزهراني", "Al-Zahrani"), ("الغامدي", "Al-Ghamdi"),
           ("السبيعي", "Al-Subaie"), ("العنزي", "Al-Anazi"),
           ("الشهري", "Al-Shehri"), ("البقمي", "Al-Buqami")]
_EMPLOYERS = [("جهة حكومية — الرياض", "حكومي"), ("جهة حكومية — جدة", "حكومي"),
              ("جهة حكومية — الدمام", "حكومي"), ("شركة اتصالات كبرى", "خاص"),
              ("مستشفى خاص — الرياض", "خاص"), ("شركة تجزئة وطنية", "خاص"),
              ("شركة مقاولات", "خاص"), ("مصرف تجاري", "خاص"),
              ("شركة لوجستية", "خاص"), ("شركة تقنية ناشئة", "خاص")]
_OBLIGATION_TYPES = ["تمويل شخصي", "بطاقة ائتمانية", "تمويل مركبة", "دفعات آجلة (BNPL)"]
_MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]


def _cohort_person(idx: int) -> dict:
    """The stable core facts of cohort member idx — everything derives from these."""
    import random as _random
    rng = _random.Random(f"tabaqa-cohort-{idx}")
    first = rng.choice(_FIRST)
    family = rng.choice(_FAMILY)
    employer, sector = rng.choice(_EMPLOYERS)
    salary = int(rng.triangular(4_000, 42_000, 9_500)) // 500 * 500
    service_years = rng.randint(0, 24)
    side_income = (int(rng.uniform(500, 4_000)) // 100 * 100) if rng.random() < 0.4 else 0
    n_obl = rng.choices([0, 1, 2, 3], weights=[25, 35, 28, 12])[0]
    obligations = []
    for _ in range(n_obl):
        pay = max(150, int(salary * rng.uniform(0.03, 0.14)) // 50 * 50)
        obligations.append({
            "type": rng.choice(_OBLIGATION_TYPES),
            "lender": "جهة تمويل أخرى",
            "monthly_payment": pay,
            "outstanding": pay * rng.randint(4, 40),
            "remaining_months": rng.randint(4, 48),
        })
    total_obl = sum(o["monthly_payment"] for o in obligations)
    delinquent = rng.random() < 0.04
    load = total_obl / salary
    grade = ("E" if delinquent else
             "A" if load < 0.05 and service_years >= 3 else
             "B" if load < 0.15 else
             "C" if load < 0.30 else "D")
    return {
        "idx": idx, "rng_seed": f"tabaqa-cohort-{idx}",
        "name_ar": f"{first[0]} {family[0]}", "name_en": f"{first[1]} {family[1]}",
        "employer": employer, "sector": sector, "salary": salary,
        "service_years": service_years, "side_income": side_income,
        "obligations": obligations, "total_obl": total_obl,
        "delinquent": delinquent, "grade": grade,
    }


def _cohort_identity(nin: str, p: dict) -> dict:
    return {"persona": f"cohort_{p['idx']}", "name_ar": p["name_ar"], "name_en": p["name_en"],
            "scenario": "synthetic cohort member — payloads generated deterministically from the NIN"}


def _txn(date: str, desc: str, amount: int, kind: str, cat: str) -> dict:
    return {"date": date, "description": desc, "amount": amount, "type": kind, "category": cat}


# ── roadmap payloads — keyed by NIN so curated cast and cohort work identically ──

_MARITAL = [("أعزب", 0.34), ("متزوج", 0.58), ("مطلّق", 0.06), ("أرمل", 0.02)]
_SYMBOLS = ["أرامكو السعودية", "مصرف الراجحي", "سابك", "الاتصالات السعودية",
            "البنك الأهلي السعودي", "أسمنت اليمامة", "المراعي", "معادن"]
_PROPERTY_TYPES = [("شقة سكنية", 350_000, 900_000), ("فيلا", 900_000, 2_800_000),
                   ("أرض", 250_000, 1_500_000), ("محل تجاري", 400_000, 1_800_000)]


def roadmap_facts(nin: str) -> dict:
    """Deterministic household/investments/assets facts for any test NIN."""
    import random as _random
    rng = _random.Random(f"tabaqa-roadmap-{nin}")
    marital = rng.choices([m for m, _w in _MARITAL], weights=[w for _m, w in _MARITAL])[0]
    dependents = rng.randint(0, 6) if marital == "متزوج" else (rng.randint(0, 2) if marital in ("مطلّق", "أرمل") else 0)
    holdings = []
    if rng.random() < 0.30:
        for sym in rng.sample(_SYMBOLS, rng.randint(1, 4)):
            shares = rng.randint(20, 1_500)
            price = round(rng.uniform(18, 95), 2)
            holdings.append({"security": sym, "shares": shares,
                             "market_value": round(shares * price, 2)})
    properties = []
    if rng.random() < 0.22:
        for _ in range(rng.choices([1, 2], weights=[85, 15])[0]):
            kind, lo, hi = rng.choice(_PROPERTY_TYPES)
            properties.append({"type": kind, "city": rng.choice(["الرياض", "جدة", "الدمام", "مكة", "بريدة"]),
                               "estimated_value": int(rng.uniform(lo, hi)) // 10_000 * 10_000})
    return {
        "marital_status": marital, "dependents": dependents,
        "holdings": holdings, "portfolio_value": round(sum(h["market_value"] for h in holdings), 2),
        "properties": properties, "property_value": sum(p["estimated_value"] for p in properties),
        "age": rng.randint(23, 58),
    }


def _age_for(nin: str, ident: dict) -> int:
    """Age consistent with career length — you can't have 22 service years at 29."""
    service = 0
    if ident["persona"].startswith("cohort_"):
        service = _cohort_person(int(ident["persona"][7:]))["service_years"]
    else:
        rec = PAYLOADS.get(ident["persona"], {}).get("employment", {}).get("record", {})
        service = int(rec.get("service_years", 0))
    return max(roadmap_facts(nin)["age"], 21 + service)


def _roadmap_payload(provider_slug: str, nin: str, persona: str) -> dict:
    f = roadmap_facts(nin)
    meta = {"source": provider_slug, "provider": ROADMAP_PROVIDERS[provider_slug][0],
            "persona": persona, "simulated": True, "integration": "roadmap"}
    if provider_slug == "household":
        # Affordability input ONLY (household size → expense benchmark under the
        # responsible-lending rules) — never a risk-score feature.
        return {"meta": meta,
                "record": {"marital_status": f["marital_status"],
                           "dependents_count": f["dependents"],
                           "usage": "تقدير المصروفات الأساسية وفق حجم الأسرة — ليس مدخلًا في درجة المخاطر"}}
    if provider_slug == "investments":
        return {"meta": meta,
                "portfolio": {"holdings": f["holdings"],
                              "total_market_value": f["portfolio_value"],
                              "note": "قوة أصول — تدعم الملاءة، ولا تُحتسب دخلًا"}}
    return {"meta": meta,
            "registry": {"properties": f["properties"],
                         "total_estimated_value": f["property_value"],
                         "note": "التكامل الرسمي مع سجل الأصول غير متاح بعد — بيانات محاكاة للنموذج فقط"}}


def _cohort_payload(provider_slug: str, nin: str, p: dict) -> dict:
    """Provider payloads for a cohort member — same shapes as the curated files."""
    import random as _random
    rng = _random.Random(f"{p['rng_seed']}-{provider_slug}")
    masked = f"{nin[0]}•••••{nin[6:]}"
    if provider_slug == "employment":
        return {"meta": {"source": "employment_registry",
                         "provider": "مصدر التوظيف والرواتب الرسمي (محاكاة)",
                         "persona": f"cohort_{p['idx']}", "simulated": True},
                "record": {"full_name": p["name_ar"], "national_id_masked": masked,
                           "employer_name": p["employer"], "employment_sector": p["sector"],
                           "employment_type": "دوام كامل — عقد دائم",
                           "service_years": p["service_years"],
                           "verified_monthly_salary": p["salary"],
                           "salary_frequency": "شهري", "verification_status": "موثّق"}}
    if provider_slug == "credit-bureau":
        return {"meta": {"source": "credit_bureau",
                         "provider": "مزوّد السجل الائتماني (محاكاة)",
                         "persona": f"cohort_{p['idx']}", "simulated": True},
                "report": {"credit_grade": p["grade"],
                           "serious_delinquency": p["delinquent"],
                           "payment_history": ("تعثّر مسجَّل خلال آخر 12 شهرًا" if p["delinquent"]
                                               else "منتظم — لا تأخير في آخر 24 شهرًا"),
                           "recent_inquiries": rng.randint(0, 3),
                           "obligations": p["obligations"],
                           "total_monthly_obligations": p["total_obl"],
                           "total_outstanding": sum(o["outstanding"] for o in p["obligations"])}}
    if provider_slug == "bank-core":
        rent = int(p["salary"] * rng.uniform(0.22, 0.34)) // 100 * 100
        tx: list[dict] = []
        for m in _MONTHS:
            tx.append(_txn(f"{m}-01", "إيجار سكن — عقد إيجار موثّق", rent, "debit", "سكن"))
            tx.append(_txn(f"{m}-03", "الشركة السعودية للكهرباء — فاتورة",
                           int(rng.uniform(150, 600)), "debit", "خدمات"))
            tx.append(_txn(f"{m}-08", "STC — فاتورة الجوال والإنترنت",
                           int(rng.uniform(200, 420)), "debit", "اتصالات"))
            for o in p["obligations"]:
                tx.append(_txn(f"{m}-05", f"قسط {o['type']}", o["monthly_payment"],
                               "debit", "التزام تمويلي"))
            for _ in range(3):
                tx.append(_txn(f"{m}-{rng.randint(6, 26):02d}", "مدى — تموينات وتسوق",
                               int(rng.uniform(80, 600)), "debit", "غذاء"))
            tx.append(_txn(f"{m}-27", f"راتب — {p['employer']} (إيداع رواتب)",
                           p["salary"], "credit", "راتب"))
        return {"meta": {"source": "bank_core", "institution": "مصرف الواحة",
                         "account_type": "حساب جاري", "iban_masked": f"SA•• 05•• •••• •••• {nin[6:]}",
                         "currency": "SAR", "period": "2026-01-01 → 2026-06-30",
                         "persona": f"cohort_{p['idx']}", "simulated": True},
                "transactions": tx}
    if provider_slug == "open-banking":
        tx = [_txn(f"{m}-{rng.randint(2, 27):02d}", rng.choice(
                  ["مدى — صيدلية", "أبل باي — مقهى", "تحويل صادر", "مدى — محطة وقود"]),
                  int(rng.uniform(40, 500)), "debit", "متفرقات")
              for m in _MONTHS for _ in range(rng.randint(1, 3))]
        return {"meta": {"source": "open_banking", "institution": "مصرف الإنماء",
                         "account_type": "حساب جاري", "iban_masked": f"SA•• 05•• •••• •••• {nin[1:5]}",
                         "currency": "SAR", "access": "قراءة فقط (AIS)",
                         "period": "2026-01-01 → 2026-06-30",
                         "persona": f"cohort_{p['idx']}", "simulated": True},
                "transactions": tx}
    # wallet
    tx = []
    for m in _MONTHS:
        if p["side_income"]:
            tx.append(_txn(f"{m}-{rng.randint(8, 14):02d}", "منصة عمل حر — دفعة مشروع",
                           p["side_income"], "credit", "دخل جانبي"))
        for _ in range(rng.randint(1, 3)):
            tx.append(_txn(f"{m}-{rng.randint(2, 27):02d}",
                           rng.choice(["هنقرستيشن", "سلة — متجر إلكتروني", "شحن رصيد"]),
                           int(rng.uniform(30, 250)), "debit", "مصروفات محفظة"))
    return {"meta": {"source": "wallet", "institution": "urpay",
                     "wallet_id_masked": f"05•• ••• {nin[6:]}", "currency": "SAR",
                     "access": "قراءة فقط — بموافقة العميل",
                     "period": "2026-01-01 → 2026-06-30",
                     "persona": f"cohort_{p['idx']}", "simulated": True},
            "transactions": tx}


def _load_payloads() -> dict[str, dict[str, dict]]:
    """{persona: {file_key: payload}} from the canonical dir, else the deploy copy."""
    out: dict[str, dict[str, dict]] = {}
    for ident in IDENTITIES.values():
        persona = ident["persona"]
        payloads: dict[str, dict] = {}
        for slug, (key, *_rest) in PROVIDERS.items():
            for base in (_CANONICAL, _DEPLOY_COPY):
                path = base / persona / f"{key}.json"
                if path.exists():
                    payloads[slug] = json.loads(path.read_text(encoding="utf-8"))
                    break
        out[persona] = payloads
    return out


PAYLOADS = _load_payloads()


def summary() -> dict:
    """One-line ops view for /health: is the sandbox stocked?"""
    stocked = sum(1 for p in PAYLOADS.values() if len(p) == len(PROVIDERS))
    return {"identities": len(IDENTITIES), "stocked": stocked,
            "cohort": COHORT_SIZE, "providers": list(PROVIDERS),
            "roadmap": list(ROADMAP_PROVIDERS)}


def _identity(nin: str) -> dict:
    """Curated cast first; otherwise one of the 500k cohort members."""
    ident = IDENTITIES.get(nin)
    if ident is not None:
        return ident
    idx = _cohort_idx(nin)
    if idx is not None:
        return _cohort_identity(nin, _cohort_person(idx))
    raise HTTPException(
        status_code=404,
        detail=f"Unknown test national ID '{nin}'. Curated identities: {sorted(IDENTITIES)}; "
               f"plus a {COHORT_SIZE:,}-member synthetic cohort — browse /sandbox/v1/cohort.",
    )


async def _provider_latency(base_ms: int) -> int:
    """Sleep like a real integration would — base profile plus network jitter."""
    ms = max(60, int(random.gauss(base_ms, base_ms * 0.12)))
    await asyncio.sleep(ms / 1000)
    return ms


def _envelope(provider_slug: str, nin: str, persona: str, latency_ms: int, data: dict) -> dict:
    if provider_slug in PROVIDERS:
        _key, label_ar, label_en, _ms = PROVIDERS[provider_slug]
        integration = None
    else:
        label_ar, label_en, _ms = ROADMAP_PROVIDERS[provider_slug]
        integration = {"status": "roadmap", "note_ar": ROADMAP_NOTE_AR, "note_en": ROADMAP_NOTE_EN}
    return {
        "environment": ENVIRONMENT,
        "simulated": True,
        "provider": {"id": provider_slug, "name_ar": label_ar, "name_en": label_en},
        **({"integration": integration} if integration else {}),
        "request_id": f"sbx_{uuid.uuid4().hex[:12]}",
        "subject": {"national_id": nin, "persona": persona},
        "consent": {"scope": "read-only", "status": "active",
                    "purpose": "financing eligibility assessment only"},
        "latency_ms": latency_ms,
        "data": data,
    }


router = APIRouter(prefix="/sandbox/v1", tags=["sandbox"])


@router.get("")
def sandbox_home() -> dict:
    """The sandbox front door — what it is, who lives in it, what it serves."""
    return {
        "environment": ENVIRONMENT,
        "simulated": True,
        "disclaimer": DISCLAIMER,
        "identities": [{"national_id": nin, **ident} for nin, ident in IDENTITIES.items()],
        "cohort": {
            "population": COHORT_SIZE,
            "browse": "/sandbox/v1/cohort?offset=0&limit=25",
            "sample": "/sandbox/v1/cohort/sample",
            "note": "synthetic test population generated deterministically per NIN — "
                    "every member's five provider payloads are queryable",
        },
        "providers": [
            {"id": slug, "name_ar": ar, "name_en": en,
             "endpoint": f"/sandbox/v1/{slug}/{{national_id}}", "typical_latency_ms": ms}
            for slug, (_k, ar, en, ms) in PROVIDERS.items()
        ],
        "roadmap_providers": [
            {"id": slug, "name_ar": ar, "name_en": en,
             "endpoint": f"/sandbox/v1/{slug}/{{national_id}}",
             "status": "roadmap", "note_ar": ROADMAP_NOTE_AR, "note_en": ROADMAP_NOTE_EN}
            for slug, (ar, en, _ms) in ROADMAP_PROVIDERS.items()
        ],
        "excluded_by_design": {
            "endpoint": "/sandbox/v1/sehhaty/{national_id}",
            "returns": "HTTP 451 Unavailable For Legal Reasons",
            "note_ar": "البيانات الصحية مستبعدة من المحرك عمدًا — بيانات حساسة بموجب نظام حماية البيانات الشخصية",
        },
    }


@router.get("/identities")
def identities() -> list[dict]:
    return [{"national_id": nin, **ident} for nin, ident in IDENTITIES.items()]


@router.get("/cohort")
def cohort(offset: int = 0, limit: int = 25) -> dict:
    """Page through the 500,000-member synthetic cohort (generated, not stored)."""
    offset = max(0, offset)
    limit = max(1, min(limit, 100))
    page = []
    for idx in range(offset, min(offset + limit, COHORT_SIZE)):
        p = _cohort_person(idx)
        page.append({"national_id": cohort_nin(idx), "name_ar": p["name_ar"],
                     "name_en": p["name_en"], "sector": p["sector"],
                     "credit_grade": p["grade"]})
    return {"environment": ENVIRONMENT, "simulated": True, "population": COHORT_SIZE,
            "offset": offset, "limit": limit, "identities": page}


@router.get("/cohort/sample")
def cohort_sample() -> dict:
    """One random cohort member with their provider endpoints — the judge moment."""
    idx = random.randrange(COHORT_SIZE)
    nin = cohort_nin(idx)
    p = _cohort_person(idx)
    return {"environment": ENVIRONMENT, "simulated": True,
            "national_id": nin, "name_ar": p["name_ar"], "name_en": p["name_en"],
            "employer": p["employer"], "sector": p["sector"], "credit_grade": p["grade"],
            "endpoints": [f"/sandbox/v1/{slug}/{nin}" for slug in PROVIDERS]}


@router.get("/identities/{nin}")
async def identity(nin: str) -> dict:
    """Identity verification — the journey's first real call (KYC-shaped, not underwriting)."""
    ident = _identity(nin)
    ms = await _provider_latency(240)
    return {
        "environment": ENVIRONMENT,
        "simulated": True,
        "request_id": f"sbx_{uuid.uuid4().hex[:12]}",
        "latency_ms": ms,
        "national_id": nin,
        "name_ar": ident["name_ar"],
        "name_en": ident["name_en"],
        # Age comes from IDENTITY, deliberately — never from health records.
        "age": _age_for(nin, ident),
        "verified": True,
        "sources_available": list(PROVIDERS),
        "roadmap_sources": list(ROADMAP_PROVIDERS),
    }


@router.get("/sehhaty/{nin}")
@router.get("/health-records/{nin}")
async def sehhaty(nin: str) -> dict:
    """Deliberately refused — with the reason, not a bare 404.

    HTTP 451: Unavailable For Legal Reasons. Health data is sensitive personal
    data under PDPL; using it to price credit invites discrimination and has no
    place in this engine. This is a design decision, not a missing feature.
    """
    raise HTTPException(status_code=451, detail={
        "refused": True,
        "reason_ar": "البيانات الصحية بيانات حساسة بموجب نظام حماية البيانات الشخصية، "
                     "واستخدامها في قرارات التمويل باب للتمييز — استُبعدت من المحرك عمدًا، "
                     "في النسخة التجريبية وفي الإنتاج على حد سواء.",
        "reason_en": "Health data is sensitive under Saudi PDPL and using it to price "
                     "credit invites discrimination. Excluded from this engine by design — "
                     "in the sandbox and in production alike.",
    })


@router.get("/{provider_slug}/{nin}")
async def provider_payload(provider_slug: str, nin: str) -> dict:
    if provider_slug not in PROVIDERS and provider_slug not in ROADMAP_PROVIDERS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown provider '{provider_slug}'. Decision inputs: {sorted(PROVIDERS)}; "
                   f"roadmap (modeled, not decision inputs): {sorted(ROADMAP_PROVIDERS)}",
        )
    ident = _identity(nin)
    if provider_slug in ROADMAP_PROVIDERS:
        ms = await _provider_latency(ROADMAP_PROVIDERS[provider_slug][2])
        return _envelope(provider_slug, nin, ident["persona"], ms,
                         _roadmap_payload(provider_slug, nin, ident["persona"]))
    if ident["persona"].startswith("cohort_"):
        data = _cohort_payload(provider_slug, nin, _cohort_person(int(ident["persona"][7:])))
    else:
        data = PAYLOADS.get(ident["persona"], {}).get(provider_slug)
        if data is None:
            raise HTTPException(
                status_code=503,
                detail=f"Sandbox payload for '{ident['persona']}/{provider_slug}' is not stocked "
                       "on this deployment — run `python -m api.sandbox sync` and redeploy.",
            )
    ms = await _provider_latency(PROVIDERS[provider_slug][3])
    return _envelope(provider_slug, nin, ident["persona"], ms, data)


def _sync() -> None:
    """Snapshot the canonical payloads into data/sandbox/ for slim deployments."""
    copied = 0
    for ident in IDENTITIES.values():
        persona = ident["persona"]
        for _slug, (key, *_rest) in PROVIDERS.items():
            src = _CANONICAL / persona / f"{key}.json"
            if not src.exists():
                print(f"  !! missing canonical file: {src}")
                continue
            dst = _DEPLOY_COPY / persona / f"{key}.json"
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
            copied += 1
    print(f"synced {copied} payload files → {_DEPLOY_COPY}")


def _export(path: Path) -> None:
    """Materialize the whole cohort into one CSV — 500k rows, one per identity.

    The file is a VIEW of the deterministic generator (regenerable any time, so
    it stays gitignored); the API remains the source of truth. Transactions are
    not expanded here — that would be ~40M rows; pull any member's statements
    from /sandbox/v1/bank-core/{nin} instead.
    """
    import csv

    grades: dict[str, int] = {}
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:  # BOM so Excel reads Arabic
        w = csv.writer(f)
        w.writerow(["idx", "national_id", "name_ar", "name_en", "age", "sector", "employer",
                    "monthly_salary_sar", "service_years", "side_income_sar",
                    "obligations_count", "obligations_monthly_sar",
                    "credit_grade", "serious_delinquency",
                    "marital_status", "dependents",
                    "portfolio_value_sar", "properties_count", "property_value_sar"])
        for idx in range(COHORT_SIZE):
            p = _cohort_person(idx)
            nin = cohort_nin(idx)
            rf = roadmap_facts(nin)
            grades[p["grade"]] = grades.get(p["grade"], 0) + 1
            w.writerow([idx, nin, p["name_ar"], p["name_en"],
                        max(rf["age"], 21 + p["service_years"]), p["sector"],
                        p["employer"], p["salary"], p["service_years"], p["side_income"],
                        len(p["obligations"]), p["total_obl"], p["grade"],
                        int(p["delinquent"]),
                        rf["marital_status"], rf["dependents"],
                        rf["portfolio_value"], len(rf["properties"]), rf["property_value"]])
            if (idx + 1) % 100_000 == 0:
                print(f"  {idx + 1:,} rows…")
    size_mb = path.stat().st_size / 1e6
    dist = " ".join(f"{g}:{grades[g]:,}" for g in sorted(grades))
    print(f"wrote {COHORT_SIZE:,} rows → {path} ({size_mb:.1f} MB)\ngrades: {dist}")


if __name__ == "__main__":
    if "sync" in sys.argv[1:]:
        _sync()
    if "export" in sys.argv[1:]:
        args = [a for a in sys.argv[1:] if a not in ("sync", "export")]
        _export(Path(args[0]) if args else APP_DIR / "data" / "synthetic" / "cohort_500k.csv")
    for nin, ident in IDENTITIES.items():
        stocked = len(PAYLOADS.get(ident["persona"], {}))
        print(f"{nin}  {ident['persona']:7} {stocked}/{len(PROVIDERS)} sources  — {ident['scenario']}")
