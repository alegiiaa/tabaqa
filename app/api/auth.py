"""The auth core's request layer — a FastAPI dependency that resolves a request
to a :class:`KeyCtx` and meters it.

Three tiers, designed so the public demo stays frictionless:

    anonymous  — no key.   Allowed, unmetered, presets/statements only.
    sandbox    — tbq_sk_*. Attributed + per-key daily limit (self-serve).
    live       — tbq_lk_*. Higher limit; unlocks persistence + webhooks.

Metering fails open: if Supabase is unconfigured or errors, the request is
treated as anonymous demo traffic rather than rejected. A presented-but-unknown
key IS rejected (401) — only when the keystore is *reachable*.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, Request, Response

from . import keystore


@dataclass
class KeyCtx:
    scope: str                      # 'anonymous' | 'sandbox' | 'live'
    key_id: Optional[str] = None
    label: Optional[str] = None
    daily_limit: Optional[int] = None
    used_today: Optional[int] = None

    @property
    def remaining(self) -> Optional[int]:
        if self.daily_limit is None or self.used_today is None:
            return None
        return max(0, self.daily_limit - self.used_today)


def _bearer(request: Request) -> Optional[str]:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip() or None
    # Also accept the raw key in X-API-Key for convenience in the playground.
    return request.headers.get("x-api-key", "").strip() or None


def _set_headers(response: Response, ctx: KeyCtx) -> None:
    response.headers["X-RateLimit-Scope"] = ctx.scope
    if ctx.daily_limit is not None:
        response.headers["X-RateLimit-Limit"] = str(ctx.daily_limit)
    if ctx.remaining is not None:
        response.headers["X-RateLimit-Remaining"] = str(ctx.remaining)


def api_key(request: Request, response: Response) -> KeyCtx:
    """Dependency: resolve + meter the caller. Attach to any /v1 route to bill it.

    Raises 401 for a presented-but-unknown/revoked key (when the keystore is
    reachable) and 429 when a key exceeds its daily limit. Anonymous callers and
    the fail-open path are always allowed.
    """
    presented = _bearer(request)

    # No key → anonymous demo traffic. Always allowed, never metered.
    if not presented:
        ctx = KeyCtx(scope="anonymous")
        _set_headers(response, ctx)
        return ctx

    # A key was presented but we can't verify it (Supabase not configured):
    # dev/offline fail-open — treat it as a sandbox key so local playground work.
    if not keystore.configured():
        ctx = KeyCtx(scope="sandbox", label="unverified (keystore offline)")
        _set_headers(response, ctx)
        return ctx

    row = keystore.lookup_key(presented)
    if row is None:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key.")

    key_id = row.get("id")
    limit = row.get("daily_limit")
    used = keystore.touch_and_count(key_id) if key_id else None
    ctx = KeyCtx(
        scope=row.get("scope", "sandbox"),
        key_id=key_id,
        label=row.get("label"),
        daily_limit=limit,
        used_today=used,
    )
    if used is not None and limit is not None and used > limit:
        _set_headers(response, ctx)
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {limit} requests reached for this {ctx.scope} key.",
        )
    _set_headers(response, ctx)
    return ctx
