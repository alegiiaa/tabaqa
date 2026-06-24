# Tabaqa App — Completion Checklist

> Goal: finish the runnable app described in [`../README.md`](../README.md) — a lender logs in,
> sees the Fahd reveal (4,000 → 10,000, score 82), and runs the financing calculator.
> **We start with Supabase** (auth + persistence), then the dashboard, then Service ②.
>
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done · 🔴 blocker · ⭐ demo-critical · ◦ optional/stretch

---

## Current state (verified 2026-06-23)

| Area | Status |
|---|---|
| Backend Service ① pipeline + scoring | ✅ runs end-to-end (`python3 smoke_test.py` asserts 4,000→10,000, score 82) |
| API endpoints | ✅ `/health`, `/v1/score`, `/v1/profile`, `/v1/access-request` — but access-requests are **in-memory** (`api/main.py:69`) |
| `/v1/affordability` (Service ②) | ❌ not implemented (specced in README §8.8) |
| Frontend landing + i18n (EN/AR RTL) | ✅ built |
| Frontend auth **code** | ✅ `lib/supabase.ts`, `auth/AuthContext.tsx` (email/pw + OAuth + reset), `RequireAuth`, `AuthPage` |
| Frontend **dashboard** | ❌ `AppHome.tsx` is a placeholder (email + sign-out only) — the real UI.md screens are not built |
| Supabase project / access | ✅ project `birxppzpkybqoyldxktz` ("amd Hackathon", ap-southeast-1); CLI authed via `supabase login` — **run CLI with `env -u SUPABASE_ACCESS_TOKEN`** (a stale token in `~/.zshrc:25` overrides login) |
| `app/web/.env.local` | ✅ filled (`VITE_SUPABASE_URL` + anon key); `npm run build` + `tsc` clean |
| DB schema / migrations | ✅ `supabase/migrations/` — `access_requests` + `profiles` (RLS + `on_auth_user_created` trigger), **applied & verified live** |
| Auth config (hosted) | ✅ Site URL + redirect allow-list set; email confirmation **OFF** (autoconfirm); signup→session→profile loop verified server-side |

---

## Phase 0 — Supabase access ✅ (done 2026-06-23)

- [x] **Confirm/create the Supabase project** — `birxppzpkybqoyldxktz` ("amd Hackathon", ap-southeast-1).
- [x] **Mint a fresh Personal Access Token** — done; CLI re-authed via `supabase login`.
      ⚠️ A stale `sbp_…` token in `~/.zshrc:25` overrides login — run all CLI as `env -u SUPABASE_ACCESS_TOKEN supabase …`.
- [x] **Re-auth the tools** — `env -u SUPABASE_ACCESS_TOKEN supabase projects list` lists, not 401.
      (Migrations applied via the Management API `/v1/projects/{ref}/database/query` with the PAT — needs `User-Agent: curl/…` or Cloudflare 1010-blocks the default `python-urllib` UA.)
- [x] **Fill `app/web/.env.local`** with Project URL + anon key.
- [x] `npm run build` + `tsc --noEmit` clean; the "not configured" notice is gone (env present).

## Phase 1 — Auth wiring ⭐ (config done; one browser click-through left)

- [x] **Email** provider enabled (`external_email_enabled`); email confirmation **OFF** (`mailer_autoconfirm`) for the demo.
- [x] Auth → URL config: Site URL `http://localhost:5173`; allow-list `/app`, `/login`, `/**`.
- [~] Verify the loop end-to-end — **server-side verified** (signup→session→profile→sign-in via anon key);
      still worth one manual browser pass: `/login` → sign up → land on `/app` → sign out → `/login`.
- [ ] ◦ Google OAuth: create Google OAuth credentials, add to Supabase → test `signInWithOAuth('google')`.
- [x] ◦ `public.profiles` table (id ↔ `auth.users`, email, full_name, company) + `on_auth_user_created`
      trigger + RLS (user reads/updates own row) — `supabase/migrations/20260623140100_profiles.sql`, verified.

## Phase 2 — DB schema + persistence ⭐

- [x] Migration: **`access_requests`** (`id`, `name`, `email`, `company`, `usecase`, `status` default `'new'`,
      `created_at`) + RLS: `anon` INSERT, SELECT privileged-only — `supabase/migrations/20260623140000_access_requests.sql`.
- [x] Wire **`SignUp.tsx`** → `supabase.from('access_requests').insert(...)` (no `.select()` — anon has no SELECT
      policy, so `RETURNING` would be RLS-rejected) + loading/error states. Verified anon insert works, anon read blocked.
- [ ] ◦ Migration: **`scores`** (`id`, `user_id` → `auth.users`, `connection_id`, `tabaqa_score`, `pd`,
      `risk_flag`, `verified_income`, `income` jsonb, `reason_codes` jsonb, `created_at`) + RLS owner-only —
      lets the dashboard show score history.
- [ ] ◦ Migration: **`applicants`/`connections`** if moving fixtures into the DB (JSON fixtures are fine for the demo).

## Phase 3 — Backend ↔ Supabase ◦ (only if we want server-side writes/auth)

- [ ] Add `supabase` (or `httpx` → PostgREST) to `requirements.txt`; load **service-role key** from env
      (server-side only — never shipped to the frontend).
- [ ] `POST /v1/access-request` → insert into `access_requests` (replaces the in-memory list at `api/main.py:69`).
- [ ] ◦ Verify the Supabase JWT on protected endpoints (FastAPI dependency: validate bearer via JWKS, extract user).
- [ ] ◦ On `POST /v1/score`, persist a `scores` row for the signed-in user.

## Phase 4 — The real dashboard ⭐ (the actual demo payload)

- [ ] Replace `AppHome.tsx` placeholder with the dashboard that calls `/v1/score` + `/v1/profile`
      (dev proxy `/v1` → `:8000` already set in `vite.config.ts`).
- [ ] Build the UI.md screens: **the reveal** (bank-only vs verified), **the score** + reason codes,
      **the transaction ledger** with 3-tier provenance tags, and **the affordability** panel.
- [ ] Loading + error + empty states; keep it bilingual EN/AR RTL (i18n already wired).

## Phase 5 — Service ② affordability ⭐

- [ ] `app/affordability.py` implementing README §8.8 (annuity factor → installment → DBR before/after →
      max installment / max financing → APPROVE/REVIEW/DECLINE).
- [ ] `POST /v1/affordability` endpoint + Pydantic request/response models in `api/models.py`.
- [ ] Frontend calculator screen — the bank-only(4,000) vs verified(10,000) comparison, the ~4.8× headline.

## Phase 6 — Deploy / demo-readiness ◦

- [ ] `npm run build` → host the static frontend (Vercel/Netlify).
- [ ] Deploy the API (Render/Fly/Railway) **or** wrap the pipeline in a Supabase Edge Function.
- [ ] Prod env wiring (URLs, keys) + CORS to the prod origin (currently `localhost:5173` only, `api/main.py:51`).
- [ ] Smoke the full login → reveal → calculator loop on the deployed URL.

---

### Immediate next action

Phases 0–2 are **done** (Supabase live, auth verified, schema + RLS applied, SignUp wired). Next:
**Phase 4 — the real dashboard.** Replace the `AppHome.tsx` placeholder with the UI.md screens
(the reveal: bank-only 4,000 vs verified 10,000 → score 82, reason codes, the 3-tier transaction
ledger), calling `/v1/score` + `/v1/profile` (dev proxy `/v1` → `:8000` already in `vite.config.ts`).
In parallel, **Phase 5 — Service ② affordability** (`/v1/affordability` + the calculator screen).
