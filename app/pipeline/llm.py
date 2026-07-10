"""Optional LLM augmentation layer — the deterministic core never depends on it.

Tabaqa's pipeline is deliberately pure-stdlib and reproducible: the eval harness
and ``smoke_test.py`` must run with **zero third-party packages and no API key**.
This module is the single, isolated place where an LLM plugs in *on top* of the
verified core:

  * the long-tail merchant/txn enricher (``enrich.py``) calls :func:`structured`
    when the rules dict returns ``unknown`` — to classify *any* Saudi merchant;
  * the financial-intelligence layer (``insights.py``) calls it to turn the
    deterministic signals into a lender-facing narrative.

**Two interchangeable providers**, chosen by ``TABAQA_LLM_PROVIDER`` (``auto``|``groq``|``anthropic``):

  * **groq** → **ALLaM** (``allam-2-7b``), Saudi Arabia's national bilingual model
    (SDAIA/NCAI), served on GroqCloud under HUMAIN's terms — the sovereign, Arabic-first
    path. Called over the OpenAI-compatible REST endpoint with **stdlib urllib only**
    (no SDK), so the core stays dependency-light. Key from ``GROQ_API_KEY`` or ``app/.groq.key``.
  * **anthropic** → Claude, via the ``anthropic`` SDK. Key from ``ANTHROPIC_API_KEY``.

``auto`` prefers Groq/ALLaM when its key is present (the Saudi hero), else Claude.
Everything degrades gracefully: if no provider is usable, :func:`available` is ``False``
and every helper returns ``None`` so the caller falls back to deterministic rules —
keeping the honest, offline eval number intact.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional

try:  # the SDK is an optional/stretch dependency — the core never imports it eagerly
    import anthropic
except Exception:  # pragma: no cover - absent in the pure-stdlib eval/smoke envs
    anthropic = None  # type: ignore[assignment]

PROVIDER_PREF = os.environ.get("TABAQA_LLM_PROVIDER", "auto").strip().lower()
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# Cloudflare in front of api.groq.com 403s the default Python-urllib UA (error 1010),
# so we send a real one. (The official SDK sets its own; stdlib needs this.)
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) tabaqa/1.0"

_client: Any = None
# Process-local caches. Making repeated identical inputs deterministic *and* free —
# the same statement scored twice never re-bills.
_cache: dict[str, Any] = {}
_key_cache: dict[str, str] = {}


# ── key loading ─────────────────────────────────────────────────────────────
def _groq_key() -> str:
    """Groq key from env, else the gitignored ``app/.groq.key`` file (dev)."""
    v = os.environ.get("GROQ_API_KEY", "").strip()
    if v:
        return v
    if "groq" in _key_cache:
        return _key_cache["groq"]
    try:
        k = (Path(__file__).resolve().parent.parent / ".groq.key").read_text("utf-8").strip()
    except Exception:
        k = ""
    if k.startswith("gsk_PASTE"):  # untouched placeholder → treat as absent
        k = ""
    _key_cache["groq"] = k
    return k


def _anthropic_ready() -> bool:
    return anthropic is not None and bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())


def _active() -> Optional[str]:
    """The provider actually usable right now: 'groq' | 'anthropic' | None."""
    groq_ok, anth_ok = bool(_groq_key()), _anthropic_ready()
    if PROVIDER_PREF == "groq":
        return "groq" if groq_ok else ("anthropic" if anth_ok else None)
    if PROVIDER_PREF == "anthropic":
        return "anthropic" if anth_ok else ("groq" if groq_ok else None)
    # auto → prefer the Saudi sovereign model when available
    if groq_ok:
        return "groq"
    if anth_ok:
        return "anthropic"
    return None


def available() -> bool:
    """True only when a provider is usable — else callers fall back to rules."""
    return _active() is not None


# ── provider-aware model + label selection (resolved at import) ─────────────
def _model(anth_env: str, anth_def: str, groq_env: str, groq_def: str) -> str:
    if _active() == "groq":
        return os.environ.get(groq_env, groq_def)
    return os.environ.get(anth_env, anth_def)


# ALLaM for every role on the Groq path (7B, fast, Arabic-first — env-overridable);
# Haiku/Sonnet on the Claude path.
ENRICH_MODEL = _model("TABAQA_ENRICH_MODEL", "claude-haiku-4-5",
                      "TABAQA_GROQ_ENRICH_MODEL", "allam-2-7b")
INSIGHTS_MODEL = _model("TABAQA_INSIGHTS_MODEL", "claude-sonnet-4-6",
                        "TABAQA_GROQ_INSIGHTS_MODEL", "allam-2-7b")
ASSISTANT_MODEL = _model("TABAQA_ASSISTANT_MODEL", "claude-haiku-4-5",
                         "TABAQA_GROQ_ASSISTANT_MODEL", "allam-2-7b")

# Tag baked into ``generated_by``/``source`` so the UI can show which model spoke.
PROVIDER_TAG = "allam" if _active() == "groq" else "claude"


# ── anthropic (Claude) transport ────────────────────────────────────────────
def _get_client() -> Any:
    global _client
    if not _anthropic_ready():
        return None
    if _client is None:
        _client = anthropic.Anthropic(max_retries=2)
    return _client


def _anthropic_structured(model, system, prompt, schema, max_tokens, thinking) -> Optional[dict]:
    client = _get_client()
    if client is None:
        return None
    kwargs: dict[str, Any] = dict(
        model=model, max_tokens=max_tokens, system=system,
        messages=[{"role": "user", "content": prompt}],
        output_config={"format": {"type": "json_schema", "schema": schema}},
    )
    if thinking:
        kwargs["thinking"] = {"type": "adaptive"}
    try:
        resp = client.messages.create(**kwargs)
        text = next(b.text for b in resp.content if b.type == "text")
        return json.loads(text)
    except Exception:  # pragma: no cover - any API/parse failure → graceful fallback
        return None


def _anthropic_chat(model, system, messages, max_tokens) -> Optional[str]:
    client = _get_client()
    if client is None:
        return None
    try:
        resp = client.messages.create(
            model=model, max_tokens=max_tokens, system=system, messages=messages,
        )
        return next((b.text for b in resp.content if b.type == "text"), "").strip() or None
    except Exception:  # pragma: no cover
        return None


# ── groq / ALLaM transport (OpenAI-compatible REST, stdlib only) ────────────
# Groq free tier meters allam-2-7b at 6,000 tokens/minute and counts REQUESTED
# max_tokens in the pre-check — so oversized asks (sized for Claude's thinking
# budget) 429 even when the actual reply is short. Clamp the ask; ALLaM's role
# here is a 3-5 sentence narrative or a small JSON object, never a long essay.
_GROQ_MAX_COMPLETION = int(os.environ.get("TABAQA_GROQ_MAX_COMPLETION", "600"))


def _groq_raw(model, messages, max_tokens, temperature, json_mode) -> Optional[str]:
    key = _groq_key()
    if not key:
        return None
    body: dict[str, Any] = dict(model=model, messages=messages,
                                max_tokens=min(max_tokens, _GROQ_MAX_COMPLETION),
                                temperature=temperature)
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    data = json.dumps(body).encode("utf-8")

    for attempt in (0, 1):
        req = urllib.request.Request(
            GROQ_URL, data=data, method="POST",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                     "User-Agent": _UA},
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            return payload["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:  # pragma: no cover - live-service behaviour
            err_body = e.read().decode("utf-8", "ignore")
            # Groq's json_object mode 400s when the model emits imperfect JSON — but
            # ships the raw generation in the error. Return it; callers already salvage
            # the first {...} block, so a trailing-comma-grade slip still lands.
            if e.code == 400 and json_mode and "failed_generation" in err_body:
                try:
                    failed = json.loads(err_body)["error"]["failed_generation"]
                    if isinstance(failed, str) and failed.strip():
                        return failed
                except Exception:
                    pass
            # 429 with a short suggested wait → one retry; anything else → fallback.
            if e.code == 429 and attempt == 0:
                m = re.search(r"try again in ([0-9.]+)s", err_body)
                wait = float(m.group(1)) if m else 0.0
                if 0 < wait <= 3.0:
                    time.sleep(wait + 0.2)
                    continue
            return None
        except Exception:  # pragma: no cover - network/parse → graceful fallback
            return None
    return None


def _groq_structured(model, system, prompt, schema, max_tokens) -> Optional[dict]:
    # ALLaM offers JSON *object* mode (valid JSON, not strict schema enforcement),
    # so we hand it the schema in the system prompt and validate/salvage on return.
    sys = (system + "\n\nReturn ONE valid JSON object only — no markdown, no prose — "
           "conforming to this JSON schema:\n" + json.dumps(schema, ensure_ascii=False))
    content = _groq_raw(
        model, [{"role": "system", "content": sys}, {"role": "user", "content": prompt}],
        max_tokens=max_tokens, temperature=0.2, json_mode=True,
    )
    if not content:
        return None
    try:
        return json.loads(content)
    except Exception:
        s, e = content.find("{"), content.rfind("}")  # salvage the first {...} block
        if 0 <= s < e:
            try:
                return json.loads(content[s:e + 1])
            except Exception:
                return None
        return None


def _groq_chat(model, system, messages, max_tokens, temperature=0.7) -> Optional[str]:
    msgs = ([{"role": "system", "content": system}] if system else []) + list(messages)
    return (_groq_raw(model, msgs, max_tokens=max_tokens, temperature=temperature, json_mode=False)
            or None)


# ── public API (provider-routed) ────────────────────────────────────────────
def structured(
    *, model: str, system: str, prompt: str, schema: dict,
    max_tokens: int = 1024, thinking: bool = False, cache_key: Optional[str] = None,
) -> Optional[dict]:
    """One structured-output call → a schema-validated dict, or ``None`` if disabled/errored.

    Routes to the active provider (ALLaM via Groq, or Claude). Any failure (no key,
    network, rate limit, malformed output) returns ``None`` so the caller degrades to rules.
    """
    prov = _active()
    if prov is None:
        return None
    key = cache_key or hashlib.sha256(f"{prov}\n{model}\n{prompt}".encode("utf-8")).hexdigest()
    if key in _cache:
        return _cache[key]

    data = (_groq_structured(model, system, prompt, schema, max_tokens) if prov == "groq"
            else _anthropic_structured(model, system, prompt, schema, max_tokens, thinking))
    if data is not None:
        _cache[key] = data
    return data


def chat(*, model: str, system: str, messages: list[dict], max_tokens: int = 600,
         temperature: float = 0.7) -> Optional[str]:
    """Plain conversational completion → assistant text, or None if disabled/errored.

    ``messages`` is the running [{role, content}] history. Not cached (each turn is
    unique). Used by the in-app assistant; degrades to a scripted fallback on None.
    (``temperature`` applies to the Groq path; Anthropic chat keeps its default.)
    """
    prov = _active()
    if prov is None:
        return None
    return (_groq_chat(model, system, messages, max_tokens, temperature) if prov == "groq"
            else _anthropic_chat(model, system, messages, max_tokens))
