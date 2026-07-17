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
# screen paces identically whichever layer serves the data.
PROVIDERS: dict[str, tuple[str, str, str, int]] = {
    "bank-core": ("bank", "الأنظمة الأساسية للمصرف (محاكاة)", "Bank core systems (simulated)", 420),
    "open-banking": ("openbanking", "الخدمات المصرفية المفتوحة — AIS (محاكاة)", "Open banking AIS (simulated)", 650),
    "wallet": ("wallet", "مزوّد المحفظة الرقمية (محاكاة)", "Digital wallet provider (simulated)", 380),
    "employment": ("employment", "مصدر التوظيف والرواتب الرسمي (محاكاة)", "Employment & salary registry (simulated)", 300),
    "credit-bureau": ("credit", "مزوّد السجل الائتماني (محاكاة)", "Credit bureau (simulated)", 340),
}

DISCLAIMER = (
    "Tabaqa Sandbox: simulated provider responses over real HTTP. Schemas and "
    "latency mirror production integrations; no live bureau, registry, or bank "
    "connection exists and no real personal data is served."
)


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
    return {"identities": len(IDENTITIES), "stocked": stocked, "providers": list(PROVIDERS)}


def _identity(nin: str) -> dict:
    ident = IDENTITIES.get(nin)
    if ident is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown test national ID '{nin}'. Sandbox identities: {sorted(IDENTITIES)}",
        )
    return ident


async def _provider_latency(base_ms: int) -> int:
    """Sleep like a real integration would — base profile plus network jitter."""
    ms = max(60, int(random.gauss(base_ms, base_ms * 0.12)))
    await asyncio.sleep(ms / 1000)
    return ms


def _envelope(provider_slug: str, nin: str, latency_ms: int, data: dict) -> dict:
    _key, label_ar, label_en, _ms = PROVIDERS[provider_slug]
    return {
        "environment": ENVIRONMENT,
        "simulated": True,
        "provider": {"id": provider_slug, "name_ar": label_ar, "name_en": label_en},
        "request_id": f"sbx_{uuid.uuid4().hex[:12]}",
        "subject": {"national_id": nin, "persona": IDENTITIES[nin]["persona"]},
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
        "providers": [
            {"id": slug, "name_ar": ar, "name_en": en,
             "endpoint": f"/sandbox/v1/{slug}/{{national_id}}", "typical_latency_ms": ms}
            for slug, (_k, ar, en, ms) in PROVIDERS.items()
        ],
    }


@router.get("/identities")
def identities() -> list[dict]:
    return [{"national_id": nin, **ident} for nin, ident in IDENTITIES.items()]


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
        "verified": True,
        "sources_available": list(PROVIDERS),
    }


@router.get("/{provider_slug}/{nin}")
async def provider_payload(provider_slug: str, nin: str) -> dict:
    if provider_slug not in PROVIDERS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown provider '{provider_slug}'. Sandbox providers: {sorted(PROVIDERS)}",
        )
    ident = _identity(nin)
    data = PAYLOADS.get(ident["persona"], {}).get(provider_slug)
    if data is None:
        raise HTTPException(
            status_code=503,
            detail=f"Sandbox payload for '{ident['persona']}/{provider_slug}' is not stocked "
                   "on this deployment — run `python -m api.sandbox sync` and redeploy.",
        )
    ms = await _provider_latency(PROVIDERS[provider_slug][3])
    return _envelope(provider_slug, nin, ms, data)


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


if __name__ == "__main__":
    if "sync" in sys.argv[1:]:
        _sync()
    for nin, ident in IDENTITIES.items():
        stocked = len(PAYLOADS.get(ident["persona"], {}))
        print(f"{nin}  {ident['persona']:7} {stocked}/{len(PROVIDERS)} sources  — {ident['scenario']}")
