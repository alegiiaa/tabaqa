-- The serving layer: one auth core (api_keys + usage metering) that powers all
-- three surfaces — self-serve dev sandbox keys, the consumer score-passport, and
-- the lender live gate. The scoring engine stays stateless; these tables only
-- gate *access* and *rate*, never hold the score state.

-- ── api_keys ─────────────────────────────────────────────────────────────
-- We never store the plaintext key. `key_hash` = sha256(plaintext); `key_prefix`
-- is the human-readable head (e.g. 'tbq_sk_a1b2c3d4') shown in dashboards. A key
-- is either 'sandbox' (self-serve, presets only, low limit) or 'live' (issued to
-- an approved lender, higher limit, unlocks persistence + webhooks).
create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  key_hash     text not null unique,
  key_prefix   text not null,
  scope        text not null default 'sandbox' check (scope in ('sandbox','live')),
  label        text,
  owner_email  text,
  daily_limit  integer not null default 250,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);

-- ── api_key_usage ────────────────────────────────────────────────────────
-- One row per (key, day). Doubles as honest per-decision metering for billing.
create table if not exists public.api_key_usage (
  key_id uuid not null references public.api_keys(id) on delete cascade,
  day    date not null default current_date,
  count  integer not null default 0,
  primary key (key_id, day)
);

-- Atomic "record one call, return today's running count" — a single round-trip
-- so the rate-limit check can't race under concurrent serverless invocations.
create or replace function public.api_key_touch(p_key_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.api_key_usage (key_id, day, count)
  values (p_key_id, current_date, 1)
  on conflict (key_id, day)
  do update set count = public.api_key_usage.count + 1
  returning count into new_count;
  update public.api_keys set last_used_at = now() where id = p_key_id;
  return new_count;
end;
$$;

-- ── passports ────────────────────────────────────────────────────────────
-- A server-issued, signed, persisted credit passport. Replaces the old
-- self-encoded URL blob on /verify: the QR now points at a passport_id and the
-- server is the source of truth. `signature` is an HMAC over the canonical
-- snapshot so tampering is detectable even off-line.
create table if not exists public.passports (
  id               text primary key,
  connection_id    text,
  subject_name     text,
  score            integer not null,
  pd               double precision,
  risk_flag        text,
  true_income      double precision,
  bank_only_income double precision,
  verified_share   double precision,
  snapshot         jsonb,
  signature        text not null,
  issued_by        uuid references public.api_keys(id),
  scope            text not null default 'sandbox',
  issued_at        timestamptz not null default now(),
  expires_at       timestamptz
);

-- RLS on all three: the backend talks to these via the service_role key (which
-- bypasses RLS). With RLS enabled and no anon policy, the anon/public client
-- can't read keys, usage, or passports directly — verification goes through our
-- API (GET /v1/passport/{id}), never straight to PostgREST.
alter table public.api_keys       enable row level security;
alter table public.api_key_usage  enable row level security;
alter table public.passports      enable row level security;
