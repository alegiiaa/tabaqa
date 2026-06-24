-- applicants + scores: per-user persistence for the dashboard. Owner-only RLS.
-- A user creates applicants (from a form, an uploaded statement, or a persona) and
-- saves the resulting Tabaqa score; both are visible only to their owner.

-- ── applicants ──────────────────────────────────────────────────────────────
create table if not exists public.applicants (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name          text not null default 'Applicant',
  connection_id text,
  input_kind    text not null default 'form',   -- 'form' | 'statement' | 'persona'
  input         jsonb,                            -- raw form/statement so the score is reproducible
  created_at    timestamptz not null default now()
);

alter table public.applicants enable row level security;

create policy "applicants_select_own"
  on public.applicants for select to authenticated
  using (auth.uid() = user_id);

create policy "applicants_insert_own"
  on public.applicants for insert to authenticated
  with check (auth.uid() = user_id);

create policy "applicants_update_own"
  on public.applicants for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "applicants_delete_own"
  on public.applicants for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists applicants_user_id_idx on public.applicants (user_id, created_at desc);

-- ── scores ──────────────────────────────────────────────────────────────────
create table if not exists public.scores (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade default auth.uid(),
  applicant_id      uuid references public.applicants(id) on delete cascade,
  tabaqa_score      int,
  pd                numeric,
  risk_flag         text,
  verified_income   numeric,
  bank_only_income  numeric,
  income            jsonb,        -- full income breakdown (the reveal)
  reason_codes      jsonb,        -- positive/negative score contributors
  created_at        timestamptz not null default now()
);

alter table public.scores enable row level security;

create policy "scores_select_own"
  on public.scores for select to authenticated
  using (auth.uid() = user_id);

create policy "scores_insert_own"
  on public.scores for insert to authenticated
  with check (auth.uid() = user_id);

create policy "scores_delete_own"
  on public.scores for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists scores_user_id_idx on public.scores (user_id, created_at desc);
create index if not exists scores_applicant_id_idx on public.scores (applicant_id);
