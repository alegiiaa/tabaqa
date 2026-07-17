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
import hashlib
import json
import random
import re
import sys
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, Response

from . import cohortdb, riskmodel

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
# the regulator-clean five above. Health data has no slot at all, anywhere.
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
            "cohort": COHORT_SIZE, "cohort_db": cohortdb.backing(),
            "providers": list(PROVIDERS), "roadmap": list(ROADMAP_PROVIDERS)}


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


# ── the analytics facts layer — everything riskmodel needs, per person ───────
# New behavioral facts (region, file age, delinquency depth, utilization) come
# from a SEPARATE additive seed ("-adv-") so every already-shipped cohort field
# — names, salaries, grades, whole statements — stays byte-identical. Facts the
# statements already imply (rent, inquiries) are REPLAYED from the same RNG
# streams the payload builders use, so the columns and the raw payloads can
# never disagree.

_REGIONS = [("الرياض", 29), ("جدة", 17), ("الدمام", 13), ("مكة", 6), ("المدينة", 5),
            ("بريدة", 5), ("أبها", 5), ("تبوك", 4), ("حائل", 3), ("جازان", 4),
            ("الطائف", 4), ("الأحساء", 5)]

_EMPLOYER_CATEGORY = {
    "شركة اتصالات كبرى": "خاص — مدرجة كبرى",
    "مصرف تجاري": "خاص — مدرجة كبرى",
    "مستشفى خاص — الرياض": "خاص — كبيرة",
    "شركة تجزئة وطنية": "خاص — كبيرة",
    "شركة لوجستية": "خاص — كبيرة",
    "شركة مقاولات": "خاص — متوسطة",
    "شركة تقنية ناشئة": "خاص — ناشئة",
}


def _employer_category(employer: str, sector: str) -> str:
    """The tier Saudi banks price on — salary-transfer listed vs SME vs gov."""
    return "حكومي" if sector == "حكومي" else _EMPLOYER_CATEGORY.get(employer, "خاص — أخرى")


def _replayed_rent(p: dict) -> int:
    """The rent the bank-core statement carries — same stream, first draw."""
    import random as _random
    rng = _random.Random(f"{p['rng_seed']}-bank-core")
    return int(p["salary"] * rng.uniform(0.22, 0.34)) // 100 * 100


def _replayed_inquiries(p: dict) -> int:
    """The inquiry count the credit-bureau payload reports — same stream."""
    import random as _random
    return _random.Random(f"{p['rng_seed']}-credit-bureau").randint(0, 3)


def _extended_facts(idx: int, p: dict, age: int) -> dict:
    import random as _random
    rng = _random.Random(f"tabaqa-cohort-adv-{idx}")
    region = rng.choices([r for r, _w in _REGIONS], weights=[w for _r, w in _REGIONS])[0]
    history = min(rng.randint(8, 220), max(6, (age - 20) * 12))
    worst = 90 if p["delinquent"] else rng.choices([0, 30, 60], weights=[86, 10, 4])[0]
    has_card = any("بطاقة" in o["type"] for o in p["obligations"])
    util = round(rng.uniform(0.12, 0.93), 2) if has_card else None
    return {"region": region, "credit_history_months": history,
            "worst_delinquency": worst, "card_utilization": util}


def cohort_facts(idx: int) -> dict:
    """One cohort member's full fact sheet — the riskmodel input contract."""
    p = _cohort_person(idx)
    nin = cohort_nin(idx)
    rf = roadmap_facts(nin)
    age = max(rf["age"], 21 + p["service_years"])
    return {
        "national_id": nin, "idx": idx,
        "name_ar": p["name_ar"], "name_en": p["name_en"],
        "salary": p["salary"], "side_income": p["side_income"],
        "service_years": p["service_years"], "sector": p["sector"],
        "employer": p["employer"],
        "employer_category": _employer_category(p["employer"], p["sector"]),
        "obligations": p["obligations"], "total_obl": p["total_obl"],
        "delinquent": p["delinquent"], "grade": p["grade"],
        "age": age, "marital": rf["marital_status"], "dependents": rf["dependents"],
        "portfolio_value": rf["portfolio_value"],
        "properties_count": len(rf["properties"]), "property_value": rf["property_value"],
        "rent_monthly": _replayed_rent(p),
        "recent_inquiries": _replayed_inquiries(p),
        **_extended_facts(idx, p, age),
    }


def _cast_facts(nin: str, ident: dict) -> dict:
    """The same fact sheet for a curated persona, read from its payload files."""
    import random as _random
    pay = PAYLOADS.get(ident["persona"], {})
    emp = pay.get("employment", {}).get("record", {})
    rep = pay.get("credit-bureau", {}).get("report", {})
    wallet_tx = pay.get("wallet", {}).get("transactions", [])
    bank_tx = pay.get("bank-core", {}).get("transactions", [])
    salary = float(emp.get("verified_monthly_salary", 0) or 0)
    side = int(sum(t.get("amount", 0) for t in wallet_tx if t.get("type") == "credit") / 6) // 100 * 100
    rent_rows = [t.get("amount", 0) for t in bank_tx
                 if t.get("type") == "debit" and t.get("category") == "سكن"]
    obligations = [{
        "type": str(o.get("type", "")),
        "monthly_payment": float(o.get("monthly_payment", 0) or 0),
        "outstanding": float(o.get("outstanding", 0) or 0),
        "remaining_months": int(o.get("remaining_months", 0) or 0),
    } for o in rep.get("obligations", [])]
    sector = "حكومي" if "حكوم" in str(emp.get("employment_sector", "")) else "خاص"
    employer = str(emp.get("employer_name", ""))
    delinquent = bool(rep.get("serious_delinquency", False))
    rf = roadmap_facts(nin)
    rng = _random.Random(f"tabaqa-adv-cast-{nin}")
    history = rng.randint(36, 160)
    worst = 90 if delinquent else rng.choices([0, 30], weights=[85, 15])[0]
    has_card = any("بطاقة" in o["type"] for o in obligations)
    util = round(rng.uniform(0.2, 0.85), 2) if has_card else None
    return {
        "national_id": nin, "idx": None,
        "name_ar": ident["name_ar"], "name_en": ident["name_en"],
        "salary": salary, "side_income": side,
        "service_years": float(emp.get("service_years", 0) or 0),
        "sector": sector, "employer": employer,
        "employer_category": _employer_category(employer, sector),
        "obligations": obligations,
        "total_obl": float(rep.get("total_monthly_obligations",
                                   sum(o["monthly_payment"] for o in obligations)) or 0),
        "delinquent": delinquent, "grade": str(rep.get("credit_grade", "C")),
        "age": _age_for(nin, ident), "marital": rf["marital_status"], "dependents": rf["dependents"],
        "portfolio_value": rf["portfolio_value"],
        "properties_count": len(rf["properties"]), "property_value": rf["property_value"],
        "rent_monthly": int(sum(rent_rows) / 6) if rent_rows else int(salary * 0.28),
        "recent_inquiries": int(rep.get("recent_inquiries", 1) or 0),
        "region": "الرياض", "credit_history_months": history,
        "worst_delinquency": worst, "card_utilization": util,
    }


def person_facts(nin: str) -> dict:
    """Fact sheet for any test identity — cohort or curated cast."""
    ident = _identity(nin)
    if ident["persona"].startswith("cohort_"):
        return cohort_facts(int(ident["persona"][7:]))
    return _cast_facts(nin, ident)


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
            "storage": cohortdb.backing() or "generated on demand",
            "browse": "/sandbox/v1/cohort?offset=0&limit=25",
            "filters": "region · sector · grade · stage · delinquent · "
                       "min_salary · max_salary · sort=salary|pd|dbr|score|el&desc=1",
            "record": "/sandbox/v1/cohort/{national_id}",
            "stats": "/sandbox/v1/cohort/stats",
            "sample": "/sandbox/v1/cohort/sample",
            "suggest": "/sandbox/v1/cohort/suggest?prefix=108&limit=6",
            "note": "synthetic test population — every member's provider payloads and "
                    "full risk record are queryable; the SQLite store is built from "
                    "the same deterministic generator, so the two can never disagree",
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
        "identity_login": {
            "id": "nafath",
            "name_ar": "النفاذ الوطني الموحد (محاكاة)",
            "name_en": "Nafath national SSO (simulated)",
            "init": "/sandbox/v1/nafath/init/{national_id}",
            "verify": "/sandbox/v1/nafath/verify/{national_id}?request_id=&chosen=",
            "note_ar": "محاكاة لتجربة نفاذ (رقم التحقق المزدوج) — التكامل الفعلي يتطلب اتفاقية مركز المعلومات الوطني",
        },
        "analytics": {
            "endpoint": "/sandbox/v1/analytics/{national_id}",
            "derived": True,
            "note_ar": "طبقة تحليلية محسوبة (ليست مصدر بيانات): مؤشرات أهلية ومخاطر على مستوى الفرد — "
                       "نسب الاستقطاع النظامية، درجة سلوكية، PD/LGD/EAD وخسارة متوقعة، تصنيف داخلي، واختبار ضغط",
            "note_en": "Computed analytics layer (not a data source): per-person underwriting "
                       "and risk metrics — SAMA DBR ratios, behavioral score, PD/LGD/EAD, "
                       "expected loss, internal rating, stress test. Formulas: app/DATA_DICTIONARY.md",
        },
    }


@router.get("/identities")
def identities() -> list[dict]:
    return [{"national_id": nin, **ident} for nin, ident in IDENTITIES.items()]


@router.get("/cohort")
def cohort(offset: int = 0, limit: int = 25,
           region: str | None = None, sector: str | None = None,
           grade: str | None = None, stage: int | None = None,
           delinquent: int | None = None,
           min_salary: float | None = None, max_salary: float | None = None,
           sort: str | None = None, desc: bool = False) -> dict:
    """Page through the 500,000-member cohort — real WHERE/ORDER BY queries when
    the SQLite store is built (`python -m api.cohortdb build`), thin generator
    rows otherwise (slim serverless deploys can't ship the ~250MB file)."""
    offset = max(0, offset)
    limit = max(1, min(limit, 100))
    if cohortdb.available():
        total, page = cohortdb.browse(
            offset, limit, region=region, sector=sector, grade=grade,
            stage=stage, delinquent=delinquent,
            min_salary=min_salary, max_salary=max_salary, sort=sort, desc=desc)
        return {"environment": ENVIRONMENT, "simulated": True,
                "backing": cohortdb.backing(),
                "population": COHORT_SIZE, "matching": total,
                "offset": offset, "limit": limit,
                "record_endpoint": "/sandbox/v1/cohort/{national_id}",
                "identities": page}
    page = []
    for idx in range(offset, min(offset + limit, COHORT_SIZE)):
        p = _cohort_person(idx)
        page.append({"national_id": cohort_nin(idx), "name_ar": p["name_ar"],
                     "name_en": p["name_en"], "sector": p["sector"],
                     "credit_grade": p["grade"]})
    return {"environment": ENVIRONMENT, "simulated": True, "backing": "generated",
            "population": COHORT_SIZE, "offset": offset, "limit": limit,
            "identities": page}


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


# Short Arabic hints for the curated cast in suggestion rows — mirrors the app's
# quick-pick copy so both surfaces tell the same one-line story per persona.
_CAST_HINT_AR = {
    "1084634821": "موافقة — الصورة الكاملة تغطي المبلغ",
    "2047183377": "لا عروض متوافقة — الالتزامات فوق الحد",
    "1069127734": "مراجعة — الراتب المعلن لا يطابق الحركات",
}

_SUGGEST_SCAN_BUDGET = 60_000  # ≫ expected ~200 candidates/hit at 0.5% density


@router.get("/cohort/suggest")
def cohort_suggest(prefix: str = "", limit: int = 6) -> dict:
    """Type-ahead over the test population (curated cast + 500k cohort) by NIN prefix.

    SANDBOX-ONLY convenience for the app's Nafath-style login: every identity
    here is synthetic, so autocompleting IDs is a feature — a real identity
    system must never do this. No index is stored: cohort NINs come from an
    invertible permutation of 0..499,999, so we walk the numeric range the
    prefix implies and keep the values whose inverse lands inside the cohort.
    """
    q = "".join(ch for ch in prefix if ch.isdigit())[:10]
    limit = max(1, min(limit, 12))
    matches: list[dict] = [
        {"national_id": nin, "kind": "cast", "name_ar": ident["name_ar"],
         "name_en": ident["name_en"], "hint_ar": _CAST_HINT_AR.get(nin, "")}
        for nin, ident in IDENTITIES.items() if nin.startswith(q)
    ][:limit]
    seen = {m["national_id"] for m in matches}
    scanned = 0
    if len(matches) < limit and (not q or q[0] == "1"):
        body_prefix = q[1:9]
        want_check = q[9] if len(q) == 10 else None
        span = 10 ** (8 - len(body_prefix))
        lo = int(body_prefix) * span if body_prefix else 0
        v = lo
        while v < lo + span and scanned < _SUGGEST_SCAN_BUDGET and len(matches) < limit:
            idx = ((v * _PERM_INV) - _PERM_SALT) % 100_000_000
            if idx < COHORT_SIZE:
                nin = cohort_nin(idx)
                if (want_check is None or nin[9] == want_check) and nin not in seen:
                    p = _cohort_person(idx)
                    matches.append({
                        "national_id": nin, "kind": "cohort",
                        "name_ar": p["name_ar"], "name_en": p["name_en"],
                        "hint_ar": f"{p['employer']} · درجة {p['grade']}",
                        "member_no": idx + 1,
                    })
            v += 1
            scanned += 1
    return {
        "environment": ENVIRONMENT, "simulated": True,
        "prefix": q, "population": COHORT_SIZE, "matches": matches,
        "note_ar": "إكمال الهويات خاصية بيئة تجريبية لاستكشاف العينة الاصطناعية — "
                   "أنظمة الهوية الفعلية لا تُكمل أرقام الهويات ولا تكشف الأسماء قبل التوثيق",
        "note_en": "Sandbox-only convenience for browsing the synthetic population — "
                   "a real identity system never autocompletes national IDs.",
    }


@router.get("/cohort/stats")
def cohort_stats() -> dict:
    """Portfolio-level aggregates over the whole 500k store — the warehouse view.

    Live GROUP BY / AVG / SUM queries against the SQLite database (cached after
    the first call): grade and IFRS 9 distributions, regional counts, salary
    percentiles, portfolio expected loss. Proof the population actually exists
    as queryable records, not a spreadsheet.
    """
    if not cohortdb.available():
        raise HTTPException(
            status_code=503,
            detail="Cohort database not available on this deployment — run "
                   "`python -m api.sandbox export`, then `python -m api.cohortdb loadpg` "
                   "(PostgreSQL) or `python -m api.cohortdb build` (SQLite).")
    return {"environment": ENVIRONMENT, "simulated": True,
            "backing": cohortdb.backing(),
            "derived": True, "model_version": riskmodel.MODEL_VERSION,
            **cohortdb.stats()}


@router.get("/cohort/{nin}")
async def cohort_record(nin: str) -> dict:
    """The full analytical record for one identity — all ~58 columns: person
    facts plus the derived risk block (SAMA ratios, PD/LGD/EAD/EL, IFRS 9
    stage, masterscale rating, stress test). Served from the SQLite store when
    built; recomputed live from the deterministic generator otherwise — the
    two are byte-equal by construction."""
    ident = _identity(nin)  # unknown test NINs 404 like everywhere else
    ms = await _provider_latency(310)
    rec = cohortdb.record(nin) if cohortdb.available() else None
    backing = cohortdb.backing()
    if rec is None:
        facts = person_facts(nin)
        rec = dict(zip(_BASE_COLS, _base_row(facts)))
        rec.update(riskmodel.advanced_metrics(facts))
        backing = "computed"
    return {"environment": ENVIRONMENT, "simulated": True, "backing": backing,
            "request_id": f"sbx_{uuid.uuid4().hex[:12]}",
            "subject": {"national_id": nin, "persona": ident["persona"],
                        "name_ar": ident["name_ar"]},
            "latency_ms": ms,
            "record": rec,
            "raw_payloads": [f"/sandbox/v1/{slug}/{nin}" for slug in PROVIDERS]}


@router.get("/identities/{nin}")
async def identity(nin: str) -> dict:
    """Identity verification — the journey's first real call (KYC-shaped, not underwriting)."""
    ident = _identity(nin)
    ms = await _provider_latency(240)
    persona = ident["persona"]
    return {
        "environment": ENVIRONMENT,
        "simulated": True,
        "request_id": f"sbx_{uuid.uuid4().hex[:12]}",
        "latency_ms": ms,
        "national_id": nin,
        "persona": persona,
        # which of the 500,000 this NIN resolves to — the login's "who am I" line
        **({"cohort_member_no": int(persona[7:]) + 1, "cohort_population": COHORT_SIZE}
           if persona.startswith("cohort_") else {}),
        "name_ar": ident["name_ar"],
        "name_en": ident["name_en"],
        # Age comes from IDENTITY, deliberately — never from health records.
        "age": _age_for(nin, ident),
        "verified": True,
        "sources_available": list(PROVIDERS),
        "roadmap_sources": list(ROADMAP_PROVIDERS),
    }


# ── the analytics layer — computed, not collected ────────────────────────────


@router.get("/analytics/{nin}")
async def analytics(nin: str) -> dict:
    """Underwriting/risk metrics for one identity — a DERIVED view, not a source.

    Everything here is computed from the five consented decision sources plus
    the roadmap facts: SAMA affordability ratios, a SIMAH-style behavioral
    score, PD/LGD/EAD and the Basel expected-loss identity, IFRS 9 staging, a
    10-notch internal masterscale, and a +200bps stress test. Column-by-column
    formulas: app/DATA_DICTIONARY.md.
    """
    ident = _identity(nin)
    ms = await _provider_latency(360)
    facts = person_facts(nin)
    return {
        "environment": ENVIRONMENT,
        "simulated": True,
        "derived": True,
        "request_id": f"sbx_{uuid.uuid4().hex[:12]}",
        "subject": {"national_id": nin, "persona": ident["persona"], "name_ar": ident["name_ar"]},
        "basis_ar": "طبقة تحليلية محسوبة من المصادر المعتمدة — ليست مصدر بيانات مستقلًا ولا استعلامًا جديدًا",
        "profile": {"age": facts["age"], "region": facts["region"], "sector": facts["sector"],
                    "employer_category": facts["employer_category"], "marital": facts["marital"],
                    "dependents": facts["dependents"]},
        "metrics": riskmodel.advanced_metrics(facts),
        "model": {
            "version": riskmodel.MODEL_VERSION,
            "documentation": "app/DATA_DICTIONARY.md",
            "grounding": [
                "SAMA Responsible Lending Principles, Circular 46538/99, Ch. IV (DBR caps)",
                "Basel expected-loss identity EL = PD × LGD × EAD; 50% CCF on undrawn revolving",
                "IFRS 9 impairment staging (1/2/3)",
                "Saudi Labor Law Art. 84 — end-of-service benefit",
                "GASTAT HICES 2023 — essential-expense anchor",
            ],
        },
        "latency_ms": ms,
    }


# ── Nafath (محاكاة) — the identity-login moment before consent ───────────────
# Real Nafath has no public API: private-sector access runs through an NIC/TCC
# agreement. The sandbox mirrors the UX contract instead — init issues a request
# with a two-digit confirmation number; the applicant taps the matching number in
# the (simulated) Nafath app; verify checks the tap. Stateless on purpose: the
# number is re-derived from the request id, so serverless instances need no store.


def _nafath_number(request_id: str) -> int:
    """The two-digit confirmation number — recomputable from the request id alone."""
    return int(hashlib.sha256(request_id.encode()).hexdigest(), 16) % 90 + 10


@router.get("/nafath/init/{nin}")
async def nafath_init(nin: str) -> dict:
    """Open a simulated Nafath verification — returns the number the app must show."""
    ident = _identity(nin)
    ms = await _provider_latency(320)
    rid = f"nfz_{uuid.uuid4().hex[:12]}"
    return {
        "environment": ENVIRONMENT,
        "simulated": True,
        "provider": {"id": "nafath", "name_ar": "النفاذ الوطني الموحد (محاكاة)",
                     "name_en": "Nafath national SSO (simulated)"},
        "request_id": rid,
        "national_id": nin,
        "name_ar": ident["name_ar"],
        "number": _nafath_number(rid),
        "expires_in_s": 90,
        "latency_ms": ms,
        "note_ar": "محاكاة كاملة — لا اتصال بمنصة نفاذ؛ في الإنتاج يتم التكامل عبر اتفاقية مركز المعلومات الوطني",
        "note_en": "Fully simulated — no connection to the real Nafath platform; "
                   "production integrates via the NIC/TCC agreement.",
    }


@router.get("/nafath/verify/{nin}")
async def nafath_verify(nin: str, request_id: str, chosen: int) -> dict:
    """The applicant tapped a number in the simulated Nafath app — check the tap."""
    _identity(nin)  # unknown test NINs 404 exactly like every other endpoint
    ms = await _provider_latency(520)
    ok = chosen == _nafath_number(request_id)
    return {
        "environment": ENVIRONMENT,
        "simulated": True,
        "provider": {"id": "nafath", "name_ar": "النفاذ الوطني الموحد (محاكاة)",
                     "name_en": "Nafath national SSO (simulated)"},
        "request_id": request_id,
        "national_id": nin,
        "verified": ok,
        "status": "COMPLETED" if ok else "REJECTED",
        "latency_ms": ms,
    }


# ── incoming orders — the app → dashboard handoff (TEAM SPEC stages 8–10) ────
# The consumer app submits the chosen offer as an ORDER; the Tabaqa dashboard
# polls the list, announces "طلب جديد — اقبله خلال 24 ساعة" and shows the same
# applicant's report (the order carries the encoded fused statement). In-memory
# by design: the venue demo runs a single local uvicorn. On serverless each
# instance keeps its own list — best-effort there, and the demo doesn't rely on it.

ORDERS: list[dict] = []
ORDER_TTL_S = 24 * 3600
_ORDERS_MAX = 50
_ORDER_ID_RE = re.compile(r"^ord_[0-9a-f]{6,32}$")


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _annuity_installment(amount: float, apr: float, months: int) -> float:
    """Mirror of lib/lenders.ts installmentFor — same murabaha annuity."""
    if months <= 0:
        return 0.0
    i = apr / 12.0
    if i <= 0:
        return amount / months
    af = ((1 + i) ** months - 1) / (i * (1 + i) ** months)
    return amount / af


def _order_view(o: dict) -> dict:
    remaining = max(0, int(o["received_at"] + ORDER_TTL_S - time.time()))
    status = o["status"]
    if status == "pending" and remaining == 0:
        status = "expired"
    return {**o, "status": status, "remaining_s": remaining}


@router.post("/orders")
async def create_order(payload: dict) -> dict:
    """The app sends the chosen offer to the lender — through Tabaqa's desk."""
    nin = str(payload.get("national_id", ""))
    ident = _identity(nin)  # unknown test NINs 404 like everywhere else
    ms = await _provider_latency(260)
    num = lambda k: int(float(payload.get(k) or 0))  # noqa: E731
    # The app generates the id so the shared Supabase desk and this mirror agree
    # on it; anything malformed (or a replay) gets a fresh server id as before.
    raw_id = str(payload.get("order_id") or "")
    client_id_ok = bool(_ORDER_ID_RE.fullmatch(raw_id)) and all(
        x["order_id"] != raw_id for x in ORDERS
    )
    order = {
        "order_id": raw_id if client_id_ok else f"ord_{uuid.uuid4().hex[:10]}",
        "environment": ENVIRONMENT,
        "simulated": True,
        "received_at": time.time(),
        "status": "pending",
        "national_id": nin,
        "applicant_ar": str(payload.get("applicant_ar") or ident["name_ar"])[:80],
        "lender_id": str(payload.get("lender_id", ""))[:40],
        "lender_ar": str(payload.get("lender_ar", ""))[:80],
        "product_ar": str(payload.get("product_ar", ""))[:80],
        "amount": num("amount"),
        "tenor_months": num("tenor_months"),
        "installment": num("installment"),
        "apr": float(payload.get("apr") or 0),
        "total": num("total"),
        "score": num("score"),
        "risk": str(payload.get("risk", ""))[:12],
        "eligible_income": num("eligible_income"),
        "obligations": num("obligations"),
        # the applicant's fused statement, encoded — the dashboard renders the
        # SAME report the app derived, re-scored live at /report?d=
        "report_d": str(payload.get("report_d", ""))[:300_000],
        "original_tenor_months": None,
        "events": [{"at": _now_iso(), "type": "submitted"}],
    }
    ORDERS.insert(0, order)
    del ORDERS[_ORDERS_MAX:]
    return {
        "environment": ENVIRONMENT,
        "simulated": True,
        "order_id": order["order_id"],
        "status": "pending",
        "accept_within_s": ORDER_TTL_S,
        "latency_ms": ms,
    }


def _no_store(response: Response) -> None:
    """Live desk state must NEVER be cached — a stale edge/CDN copy of an empty
    list is exactly why the dashboard poll can miss an order (Vercel edge caches
    a `public` response). Force origin on every poll."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["CDN-Cache-Control"] = "no-store"
    response.headers["Vercel-CDN-Cache-Control"] = "no-store"


@router.get("/orders")
def list_orders(response: Response) -> dict:
    """The dashboard's poll — newest first, each with its acceptance countdown."""
    _no_store(response)
    return {
        "environment": ENVIRONMENT,
        "simulated": True,
        "accept_within_s": ORDER_TTL_S,
        "orders": [_order_view(o) for o in ORDERS],
    }


@router.delete("/orders")
def clear_orders() -> dict:
    """Reset the desk between demo runs — clears every order (demo convenience)."""
    n = len(ORDERS)
    ORDERS.clear()
    return {"environment": ENVIRONMENT, "simulated": True, "cleared": n}


@router.get("/orders/{order_id}")
def get_order(order_id: str, response: Response) -> dict:
    """One order, with its bundled report_d — /report?o= fetches this instead of
    carrying the encoded statement in the URL (a ~25KB query string trips Node's
    16KB header cap with HTTP 431, and serverless URL limits besides)."""
    _no_store(response)
    for o in ORDERS:
        if o["order_id"] == order_id:
            return {"environment": ENVIRONMENT, "simulated": True, **_order_view(o)}
    raise HTTPException(status_code=404, detail=f"Unknown order '{order_id}'")


@router.post("/orders/{order_id}/accept")
@router.post("/orders/{order_id}/decline")
async def decide_order(order_id: str, request: Request) -> dict:
    for o in ORDERS:
        if o["order_id"] == order_id:
            o["status"] = "accepted" if request.url.path.endswith("/accept") else "declined"
            o["decided_at"] = time.time()
            o.setdefault("events", []).append({"at": _now_iso(), "type": o["status"]})
            return {"environment": ENVIRONMENT, "simulated": True, **_order_view(o)}
    raise HTTPException(status_code=404, detail=f"Unknown order '{order_id}'")


@router.post("/orders/{order_id}/extend")
async def extend_order(order_id: str, add: int = 6) -> dict:
    """The bank worker's extension: more months on the same murabaha pricing —
    installment recomputed with the offer's annuity, the admin fee carried over.
    Mirrors the Supabase-desk update the dashboard performs (lib/ordersDesk.ts)."""
    add = max(1, min(36, int(add)))
    for o in ORDERS:
        if o["order_id"] == order_id:
            if o["status"] == "declined":
                raise HTTPException(status_code=409, detail="Declined orders cannot be extended")
            old_tenor = int(o.get("tenor_months") or 0)
            new_tenor = min(96, old_tenor + add)
            if new_tenor == old_tenor:
                return {"environment": ENVIRONMENT, "simulated": True, **_order_view(o)}
            fee = max(0.0, float(o.get("total") or 0) - float(o.get("installment") or 0) * old_tenor)
            inst = _annuity_installment(float(o.get("amount") or 0), float(o.get("apr") or 0), new_tenor)
            if o.get("original_tenor_months") is None:
                o["original_tenor_months"] = old_tenor
            o["tenor_months"] = new_tenor
            o["installment"] = int(round(inst))
            o["total"] = int(round(inst * new_tenor + fee))
            o["extended_at"] = time.time()
            o.setdefault("events", []).append({
                "at": _now_iso(), "type": "extended",
                "tenor_months": new_tenor, "installment": o["installment"],
            })
            return {"environment": ENVIRONMENT, "simulated": True, **_order_view(o)}
    raise HTTPException(status_code=404, detail=f"Unknown order '{order_id}'")


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


_BASE_COLS = ["idx", "national_id", "name_ar", "name_en", "age", "region",
              "sector", "employer", "employer_category",
              "monthly_salary_sar", "service_years", "side_income_sar",
              "rent_monthly_sar",
              "obligations_count", "obligations_monthly_sar",
              "credit_grade", "serious_delinquency",
              "marital_status", "dependents",
              "portfolio_value_sar", "properties_count", "property_value_sar"]


def _base_row(f: dict) -> list:
    return [f["idx"], f["national_id"], f["name_ar"], f["name_en"], f["age"], f["region"],
            f["sector"], f["employer"], f["employer_category"],
            f["salary"], f["service_years"], f["side_income"],
            f["rent_monthly"],
            len(f["obligations"]), f["total_obl"],
            f["grade"], int(f["delinquent"]),
            f["marital"], f["dependents"],
            f["portfolio_value"], f["properties_count"], f["property_value"]]


def _export(path: Path) -> None:
    """Materialize the whole cohort into one wide analytical CSV — 500k rows.

    One row per identity: the person facts PLUS the full derived risk block
    (riskmodel.advanced_metrics — SAMA ratios, bureau behavior, PD/LGD/EAD/EL,
    IFRS 9 stage, masterscale rating, stress test). The file is a VIEW of the
    deterministic generator (regenerable any time, so it stays gitignored); the
    API remains the source of truth. Transactions are not expanded here — that
    would be ~40M rows; pull statements from /sandbox/v1/bank-core/{nin}.
    """
    import csv

    grades: dict[str, int] = {}
    stages: dict[int, int] = {}
    metric_keys: list[str] = []
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:  # BOM so Excel reads Arabic
        w = csv.writer(f)
        for idx in range(COHORT_SIZE):
            facts = cohort_facts(idx)
            m = riskmodel.advanced_metrics(facts)
            if not metric_keys:
                metric_keys = list(m)
                w.writerow(_BASE_COLS + metric_keys)
            grades[facts["grade"]] = grades.get(facts["grade"], 0) + 1
            stages[m["ifrs9_stage"]] = stages.get(m["ifrs9_stage"], 0) + 1
            w.writerow(_base_row(facts) + [m[k] for k in metric_keys])
            if (idx + 1) % 100_000 == 0:
                print(f"  {idx + 1:,} rows…")
    size_mb = path.stat().st_size / 1e6
    dist = " ".join(f"{g}:{grades[g]:,}" for g in sorted(grades))
    sdist = " ".join(f"S{s}:{stages[s]:,}" for s in sorted(stages))
    print(f"wrote {COHORT_SIZE:,} rows × {len(_BASE_COLS) + len(metric_keys)} cols → {path} ({size_mb:.1f} MB)")
    print(f"grades: {dist}\nifrs9 stages: {sdist}")


def full_person(nin: str) -> dict:
    """Every data object for one identity — the nine payloads, separated."""
    ident = _identity(nin)
    out: dict = {"identity": {"national_id": nin, **ident, "age": _age_for(nin, ident)}}
    for slug in PROVIDERS:
        if ident["persona"].startswith("cohort_"):
            out[slug] = _cohort_payload(slug, nin, _cohort_person(int(ident["persona"][7:])))
        else:
            out[slug] = PAYLOADS.get(ident["persona"], {}).get(slug)
    for slug in ROADMAP_PROVIDERS:
        out[slug] = _roadmap_payload(slug, nin, ident["persona"])
    out["analytics"] = {"derived": True, "model_version": riskmodel.MODEL_VERSION,
                        "metrics": riskmodel.advanced_metrics(person_facts(nin))}
    return out


_TX_SAMPLE = 2_000  # identities whose full transactions go into the sample file


def _export_full(outdir: Path) -> None:
    """Relational export — one CSV per data TYPE, joined by national_id.

    persons (1 row/person) · obligations · holdings · properties (1 row/item)
    · risk_metrics (1 row/person — the FULL derived block: SAMA ratios, bureau
    behavior, PD/LGD/EAD/EL, IFRS 9 stage, masterscale, stress test)
    · transactions_sample (every transaction for the first 2,000 identities —
    the full expansion would be ~40M rows; any person's statements are one API
    call away). All regenerable byte-for-byte; gitignored.
    """
    import csv

    outdir.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    metric_keys: list[str] = []
    with (outdir / "persons.csv").open("w", newline="", encoding="utf-8-sig") as fp, \
         (outdir / "obligations.csv").open("w", newline="", encoding="utf-8-sig") as fo, \
         (outdir / "holdings.csv").open("w", newline="", encoding="utf-8-sig") as fh, \
         (outdir / "properties.csv").open("w", newline="", encoding="utf-8-sig") as fr, \
         (outdir / "risk_metrics.csv").open("w", newline="", encoding="utf-8-sig") as fm:
        wp, wo = csv.writer(fp), csv.writer(fo)
        wh, wr = csv.writer(fh), csv.writer(fr)
        wm = csv.writer(fm)
        wp.writerow(["national_id", "name_ar", "name_en", "age", "region",
                     "marital_status", "dependents",
                     "sector", "employer", "employer_category",
                     "monthly_salary_sar", "service_years",
                     "side_income_sar", "rent_monthly_sar",
                     "credit_grade", "serious_delinquency"])
        wo.writerow(["national_id", "obligation_type", "lender", "monthly_payment_sar",
                     "outstanding_sar", "remaining_months"])
        wh.writerow(["national_id", "security", "shares", "market_value_sar"])
        wr.writerow(["national_id", "property_type", "city", "estimated_value_sar"])
        for idx in range(COHORT_SIZE):
            facts = cohort_facts(idx)
            m = riskmodel.advanced_metrics(facts)
            if not metric_keys:
                metric_keys = list(m)
                wm.writerow(["national_id"] + metric_keys)
            nin = facts["national_id"]
            rf = roadmap_facts(nin)
            wp.writerow([nin, facts["name_ar"], facts["name_en"], facts["age"], facts["region"],
                         facts["marital"], facts["dependents"],
                         facts["sector"], facts["employer"], facts["employer_category"],
                         facts["salary"], facts["service_years"],
                         facts["side_income"], facts["rent_monthly"],
                         facts["grade"], int(facts["delinquent"])])
            for o in facts["obligations"]:
                wo.writerow([nin, o["type"], o["lender"], o["monthly_payment"],
                             o["outstanding"], o["remaining_months"]])
            for h in rf["holdings"]:
                wh.writerow([nin, h["security"], h["shares"], h["market_value"]])
            for pr in rf["properties"]:
                wr.writerow([nin, pr["type"], pr["city"], pr["estimated_value"]])
            wm.writerow([nin] + [m[k] for k in metric_keys])
            counts["persons"] = counts.get("persons", 0) + 1
            counts["obligations"] = counts.get("obligations", 0) + len(facts["obligations"])
            counts["holdings"] = counts.get("holdings", 0) + len(rf["holdings"])
            counts["properties"] = counts.get("properties", 0) + len(rf["properties"])
            counts["risk_metrics"] = counts.get("risk_metrics", 0) + 1
            if (idx + 1) % 100_000 == 0:
                print(f"  {idx + 1:,} persons…")
    with (outdir / "transactions_sample.csv").open("w", newline="", encoding="utf-8-sig") as ft:
        wt = csv.writer(ft)
        wt.writerow(["national_id", "source", "date", "description", "amount_sar", "type", "category"])
        for idx in range(_TX_SAMPLE):
            p = _cohort_person(idx)
            nin = cohort_nin(idx)
            for slug in ("bank-core", "open-banking", "wallet"):
                for t in _cohort_payload(slug, nin, p)["transactions"]:
                    wt.writerow([nin, slug, t["date"], t["description"], t["amount"],
                                 t["type"], t["category"]])
                    counts["transactions_sample"] = counts.get("transactions_sample", 0) + 1
    for name, n in counts.items():
        print(f"  {name}.csv — {n:,} rows")
    print(f"relational export → {outdir}")


if __name__ == "__main__":
    if "sync" in sys.argv[1:]:
        _sync()
    if "person" in sys.argv[1:]:
        nin_arg = sys.argv[sys.argv.index("person") + 1]
        out = APP_DIR / "data" / "synthetic" / f"person_{nin_arg}.json"
        out.write_text(json.dumps(full_person(nin_arg), ensure_ascii=False, indent=2),
                       encoding="utf-8")
        print(f"wrote every data object for {nin_arg} → {out}")
    if "export-full" in sys.argv[1:]:
        _export_full(APP_DIR / "data" / "synthetic" / "cohort_export")
    if "export" in sys.argv[1:]:
        args = [a for a in sys.argv[1:] if a not in ("sync", "export")]
        _export(Path(args[0]) if args else APP_DIR / "data" / "synthetic" / "cohort_500k.csv")
    for nin, ident in IDENTITIES.items():
        stocked = len(PAYLOADS.get(ident["persona"], {}))
        print(f"{nin}  {ident['persona']:7} {stocked}/{len(PROVIDERS)} sources  — {ident['scenario']}")
