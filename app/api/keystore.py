"""The auth core's data layer — a stdlib-only Supabase (PostgREST) client.

The deployed API ships slim (fastapi + uvicorn + pydantic only), so this talks
to Supabase over ``urllib`` — no ``supabase``/``httpx``/``requests`` dependency.

Everything here **fails open**: if ``SUPABASE_URL`` / ``SUPABASE_SERVICE_ROLE_KEY``
are not configured, or a call errors/times out, the helpers return ``None`` and
the caller treats the request as unmetered demo traffic. A slow or down database
must never break scoring — the same posture as the LLM layer falling back to
deterministic rules.

Env:
    SUPABASE_URL                — e.g. https://<ref>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY   — service_role key (bypasses RLS; server-only)
    TABAQA_SIGNING_SECRET       — HMAC secret for passport signatures (optional)
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import urllib.error
import urllib.request
from typing import Any, Optional

_TIMEOUT = 4.0  # seconds; a stuck DB call must not hang a scoring request
_DEV_SIGNING_SECRET = "tabaqa-dev-signing-secret-not-for-production"


def _base() -> Optional[str]:
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    return url or None


def _service_key() -> Optional[str]:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None


def configured() -> bool:
    """True when we can reach Supabase with a service_role key."""
    return bool(_base() and _service_key())


def signing_secret() -> str:
    return os.environ.get("TABAQA_SIGNING_SECRET", "").strip() or _DEV_SIGNING_SECRET


# ── low-level PostgREST over urllib ────────────────────────────────────────
def _request(method: str, path: str, *, body: Any = None,
             prefer: Optional[str] = None) -> Optional[Any]:
    """Call PostgREST. Returns parsed JSON, or None on any failure (fail-open)."""
    base, key = _base(), _service_key()
    if not base or not key:
        return None
    url = f"{base}/rest/v1/{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError,
            ValueError, OSError):
        # Any transport/parse error → behave as if unconfigured (unmetered).
        return None


# ── key helpers ────────────────────────────────────────────────────────────
def hash_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def _new_plaintext(scope: str) -> str:
    tag = "lk" if scope == "live" else "sk"
    return f"tbq_{tag}_{secrets.token_hex(20)}"


def mint_key(scope: str = "sandbox", *, label: Optional[str] = None,
             owner_email: Optional[str] = None,
             daily_limit: Optional[int] = None) -> Optional[dict]:
    """Create a key. Returns ``{plaintext, prefix, scope, daily_limit, id}`` — the
    plaintext is shown once and never stored. None if Supabase is unconfigured."""
    if not configured():
        return None
    plaintext = _new_plaintext(scope)
    prefix = plaintext[:15]  # 'tbq_sk_' + 8 hex chars — safe to display/store
    limit = daily_limit if daily_limit is not None else (5000 if scope == "live" else 250)
    row = {
        "key_hash": hash_key(plaintext),
        "key_prefix": prefix,
        "scope": scope,
        "label": label,
        "owner_email": owner_email,
        "daily_limit": limit,
    }
    created = _request("POST", "api_keys", body=row, prefer="return=representation")
    if not created:
        return None
    rec = created[0] if isinstance(created, list) else created
    return {
        "plaintext": plaintext,
        "prefix": prefix,
        "scope": scope,
        "daily_limit": limit,
        "id": rec.get("id"),
    }


def lookup_key(plaintext: str) -> Optional[dict]:
    """Resolve a presented bearer key to its (non-revoked) row, or None."""
    if not configured() or not plaintext:
        return None
    kh = hash_key(plaintext)
    rows = _request(
        "GET",
        f"api_keys?key_hash=eq.{kh}&revoked_at=is.null&select=id,scope,label,daily_limit",
    )
    if isinstance(rows, list) and rows:
        return rows[0]
    return None


def touch_and_count(key_id: str) -> Optional[int]:
    """Atomically record one call for today and return the running count."""
    out = _request("POST", "rpc/api_key_touch", body={"p_key_id": key_id})
    if isinstance(out, int):
        return out
    if isinstance(out, list) and out and isinstance(out[0], int):
        return out[0]
    return None


# ── passport helpers ───────────────────────────────────────────────────────
def sign_snapshot(snapshot: dict) -> str:
    """HMAC-SHA256 over the canonical (sorted) JSON of the snapshot."""
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"),
                           ensure_ascii=False).encode("utf-8")
    return hmac.new(signing_secret().encode("utf-8"), canonical, hashlib.sha256).hexdigest()


def new_passport_id() -> str:
    return f"pass_{secrets.token_hex(9)}"


def create_passport(row: dict) -> Optional[dict]:
    """Persist a signed passport. None if unconfigured (caller then returns an
    ephemeral, un-persisted passport marked accordingly)."""
    if not configured():
        return None
    created = _request("POST", "passports", body=row, prefer="return=representation")
    if not created:
        return None
    return created[0] if isinstance(created, list) else created


def get_passport(passport_id: str) -> Optional[dict]:
    if not configured() or not passport_id:
        return None
    rows = _request("GET", f"passports?id=eq.{passport_id}&select=*")
    if isinstance(rows, list) and rows:
        return rows[0]
    return None
