# Deploying Tabaqa (public, judge-testable)

Two pieces: the **API** (FastAPI, stateless scoring service) and the **web app**
(Vite SPA). Persistence + auth are already hosted on Supabase. The web app talks
to the API over HTTPS (`VITE_API_BASE`) and to Supabase directly (RLS).

```
 judge ─▶ Vercel (web, SPA) ──▶ Render/Fly (API, /v1/*)
                        └──────▶ Supabase (auth + applicants/scores, RLS)
```

---

## 1 · Deploy the API (Render — simplest)

A `render.yaml` blueprint is at the repo root.

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. It reads `render.yaml`:
   - builds from `app/` with `pip install -r requirements-api.txt` (slim — no pandas/sklearn),
   - serves `uvicorn api.main:app --host 0.0.0.0 --port $PORT`,
   - health check `/health`.
3. After the first deploy, copy the service URL (e.g. `https://tabaqa-api.onrender.com`).
4. Set the env var **`CORS_ORIGINS`** = your web origin (fill in after step 2 below),
   e.g. `https://tabaqa.vercel.app`. Comma-separate if you have more than one.

**Alternative — Fly / Railway / any Docker host:** an `app/Dockerfile` is included
(build context `app/`). `fly launch --dockerfile app/Dockerfile` or point Railway at
the repo; set `CORS_ORIGINS` the same way. The host provides `$PORT`.

Verify: `curl https://<api-host>/health` → `{"status":"ok",...}`.

---

## 2 · Deploy the web app (Vercel)

1. Vercel → **New Project** → import the repo.
2. Set **Root Directory** = `app/web`. (Vercel auto-detects Vite; `app/web/vercel.json`
   adds the SPA rewrite so `/app` and `/login` work on direct load / refresh.)
3. **Environment Variables** (Project Settings → Environment Variables):
   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://birxppzpkybqoyldxktz.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your anon public key |
   | `VITE_API_BASE` | the API URL from step 1, e.g. `https://tabaqa-api.onrender.com` |
4. Deploy. Copy the resulting URL (e.g. `https://tabaqa.vercel.app`).
5. Go back to the **API** and set `CORS_ORIGINS` to this URL; redeploy the API.

---

## 3 · Point Supabase at the deployed web app

Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://tabaqa.vercel.app`
- **Redirect URLs**: add `https://tabaqa.vercel.app/**` (covers `/app`, `/login`,
  the email-confirm and OAuth return paths).

If Google / Twitter OAuth is enabled, add the same web origin to each provider's
allowed redirect list (and to the provider's own console).

Make sure the **`applicants` + `scores` migration** has been applied
(`supabase/migrations/20260624120000_applicants_scores.sql`) so saved history works.

---

## 4 · Verify the judge path

From a clean browser (incognito):
1. Open the Vercel URL → **Sign up** → confirm email if required.
2. **New applicant → Load sample** (or upload a CSV / pick a persona) → **Reveal & score**.
3. Walk the four screens: reveal · score · ledger · affordability.
4. Reload → the applicant is still listed (persistence via Supabase RLS).

That's the self-serve flow a judge follows. ✅

---

## Notes
- The API is **stateless** — no secrets beyond `CORS_ORIGINS`. All per-user data is
  written browser-side to Supabase under row-level security.
- Free Render instances cold-start (~30s after idle); the first request may be slow.
  For judging, hit `/health` once to warm it, or use a paid instance / Fly.
- `VITE_*` vars are baked at **build** time — changing them needs a Vercel redeploy.
