# Tabaqa Sandbox — the simulated upstream-provider environment

**What it is.** The demo journey consumes five consented data sources (PRODUCT_SPEC §5,
§16.3): bank core, open-banking AIS, digital wallet, employment registry, credit bureau.
In production each is a licensed integration. In the sandbox each is a **real HTTP
endpoint on the Tabaqa API** (`api/sandbox.py`) serving simulated payloads with
production-shaped schemas, per-provider latency, request IDs, and consent context —
keyed by Luhn-valid **test** national IDs.

**The honesty posture (say this to judges).** Every response self-identifies:
`environment: "sandbox"`, `simulated: true`, and `(محاكاة)` provider labels inside the
payloads. No live SIMAH/GOSI/bank connection exists and no real personal data is served.
The pitch line: *"swapping a simulated provider for its production integration is a
base-URL change, not a rebuild."*

## Test identities

NINs pass the real Saudi-ID Luhn checksum and match the masked digits already in each
persona's employment record (`1•••••4821` etc.), so consent screen, payloads, and
sandbox tell one story.

| NIN | Persona | Scenario (§10 outcome — computed, never labeled) |
|---|---|---|
| `1084634821` | Ahmed Al-Qahtani | approved — the consented, fused picture covers the full ask |
| `2047183377` | Sara Al-Shammari | declined — existing obligations exceed the regulatory cap |
| `1069127734` | Khalid Al-Otaibi | manual review — employment claim conflicts with salary transactions |

## Endpoints

| Endpoint | Serves |
|---|---|
| `GET /sandbox/v1` | environment metadata, identity directory, provider list, disclaimer |
| `GET /sandbox/v1/identities` | the test identities |
| `GET /sandbox/v1/identities/{nin}` | identity verification (KYC-shaped — never underwriting features) |
| `GET /sandbox/v1/bank-core/{nin}` | the bank's own account statement |
| `GET /sandbox/v1/open-banking/{nin}` | other-bank account via AIS (read-only) |
| `GET /sandbox/v1/wallet/{nin}` | wallet transactions (side-income streams) |
| `GET /sandbox/v1/employment/{nin}` | employer, sector, service years, verified salary |
| `GET /sandbox/v1/credit-bureau/{nin}` | grade, payment history, obligations |

Every provider response is wrapped in an envelope:

```json
{
  "environment": "sandbox",
  "simulated": true,
  "provider": {"id": "employment", "name_ar": "مصدر التوظيف والرواتب الرسمي (محاكاة)", "name_en": "…"},
  "request_id": "sbx_c145667f10a4",
  "subject": {"national_id": "1084634821", "persona": "ahmed"},
  "consent": {"scope": "read-only", "status": "active", "purpose": "financing eligibility assessment only"},
  "latency_ms": 309,
  "data": { …the raw payload the engine derives from… }
}
```

Unknown NINs and unknown providers 404 with the list of valid values — there is no
Sehhaty/health provider and never will be (TEAM_BRIEF §7).

Try it:

```bash
curl -s localhost:8000/sandbox/v1 | jq .
curl -s localhost:8000/sandbox/v1/employment/1084634821 | jq .
curl -s localhost:8000/sandbox/v1/credit-bureau/2047183377 | jq .data.report
curl -s localhost:8000/health | jq .sandbox     # {"identities": 3, "stocked": 3, …}
```

## Data flow — one set of bytes, two transports

Canonical payloads live in `web/src/data/<persona>/*.json`. The web app **bundles**
them (`raw.ts`) and the sandbox **serves the same files** over HTTP, so the two can
never drift.

- `connectors.ts` — `retrieveSource(persona, source)` fetches `/sandbox/v1/...`
  (3.5s timeout) and falls back to the bundled payload at the same pacing when the
  API is unreachable. Existing exports (`PERSONAS`, `PERSONA_LIST`, `RAW_COUNTS`) are
  unchanged.
- `FinanceFlow.tsx` `Processing` — the retrieval steps (identity, employment, the
  three accounts in parallel, obligations) tick **when their HTTP call actually
  resolves** (watch the network tab: six calls per run); the engine passes in between
  are local compute, paced for legibility. The footer states the transport honestly:
  sandbox vs offline-local.
- Demo fallback ladder: sandbox API → bundled payloads. The journey plays identically
  either way because the bytes are identical; only the footer line changes.

## Ops

- **Dev:** Vite proxies `/sandbox` → `localhost:8000` (vite.config.ts). Restart a
  non-`--reload` uvicorn after pulling this feature.
- **Deploy:** slim API deployments that exclude `web/` are covered by the snapshot in
  `data/sandbox/` — regenerate after editing persona data with
  `python -m api.sandbox sync` (also prints the identity registry).
- **Probe:** `/health` now carries `"sandbox": {"identities": 3, "stocked": 3, …}`.
