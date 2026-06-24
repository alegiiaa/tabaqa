-- access_requests: landing-page "request access" submissions (SignUp.tsx).
-- Anonymous visitors may INSERT their own request; reads are privileged-only.

create table if not exists public.access_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  company    text,
  usecase    text,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.access_requests enable row level security;

-- Anyone (anon landing visitor or signed-in user) may submit a request.
create policy "access_requests_insert_anon"
  on public.access_requests
  for insert
  to anon, authenticated
  with check (true);

-- No SELECT/UPDATE/DELETE policy on purpose: with RLS enabled and no policy,
-- those operations are denied for anon/authenticated. service_role bypasses RLS,
-- so the backend / admin tooling can still read and triage submissions.
