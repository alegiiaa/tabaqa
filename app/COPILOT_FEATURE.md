# Tabaqa Copilot — Wispr-style command bar (PARKED)

> **Status:** fully built, **unmounted** from the app on 2026-06-28 (per product decision
> to prioritise the Credit Report). All code is kept in the repo and dormant — re-enabling
> is a one-line change. The backend endpoint stays live.

## What it is
A premium, **Wispr-style command capsule** pinned to the bottom of the dashboard: a
voice + text AI bar that understands the whole Tabaqa app and **acts inside it**
(navigates screens, opens the docs) — never the OS. Bilingual EN/AR.

## Design (premium midnight-blue + electric-cyan)
- Slim glass pill, `border-radius: 9999px`, midnight-blue body (`#0A0F1A → #050B14`),
  electric-cyan (`#00F0FF`) accents.
- Layered shadows (tight dark + soft ambient + faint cyan ring) + a top inner light
  reflection; a subtle `feTurbulence` **film-grain** overlay for tactile depth.
- Two states: **idle** (✦ spark + input + mic/send circle) and **recording**
  (✕ cancel · monospace live timer · glowing cyan **dotted waveform** · ✓ confirm).
- Floating dark reply card with the answer, suggestion chips, an "→ Opening Financing"
  acting pill, and a **"⟳ Tap to retry"** on error.
- Voice via the browser **Web Speech API** (`ar-SA`/`en-US`); confirm-to-send (no auto-send).

## Files
| File | Role |
|---|---|
| `web/src/components/dashboard/CommandBar.tsx` | the capsule UI (current, premium-blue) |
| `web/src/components/dashboard/Assistant.tsx` | the earlier corner-chat version (superseded) |
| `styles.css` → `.cmd-*` (and legacy `.asst-*`) | all styling |
| `web/src/lib/api.ts` → `AssistantMessage/Action/Reply`, `api.assistant()` | client |
| `app/assistant.py` | system prompt + bilingual FAQ fallback + `derive_action()` (deterministic navigate/open) |
| `pipeline/llm.py` → `chat()`, `ASSISTANT_MODEL` (default `claude-haiku-4-5`) | LLM call |
| `api/main.py` → `POST /v1/assistant`; `api/models.py` → `AssistantRequest/Response` | endpoint (still **live**) |

## How it worked
Frontend posts the message history + `{section, connected}` to `/v1/assistant`. The backend
returns `{reply, suggestions, source, action}`:
- **reply** = Claude (`chat()`) when `ANTHROPIC_API_KEY` is set, else a bilingual scripted FAQ.
- **action** = `{type: navigate|open|none, section?, target?}` from a **deterministic** EN+AR
  keyword map (`derive_action`) — demo-safe. The frontend `Dashboard.handleAction` executes it
  (navigate sections / `window.open('/developers')`).

## To re-enable
1. In `web/src/components/dashboard/Dashboard.tsx`: re-import `CommandBar` + `AssistantAction`,
   restore the `handleAction` helper, and mount `<CommandBar section=… connected=… onAction={handleAction} />`
   in both the Connect and dashboard return branches (see git history of this file).
2. (No backend change — `/v1/assistant` is already deployed.)
3. To make replies truly conversational in prod: set `ANTHROPIC_API_KEY` on the `tabaqa-api`
   Vercel project (the `anthropic` SDK is already bundled) + redeploy.

See [[judge-experience-and-api-docs]] memory for the full history.
