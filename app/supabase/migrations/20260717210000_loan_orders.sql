-- loan_orders — the SHARED orders desk between تطبيق طبقة (the phone) and the
-- bank-worker dashboard (/demo), with Supabase Realtime pushing every change to
-- both screens the moment it happens:
--   phone submits  → INSERT   → the desk sees the order live
--   worker decides → UPDATE   → the phone raises the approval/decline notice
--   worker extends → UPDATE   → tenor + installment change lands on the phone
-- Replaces the per-lambda in-memory desk (Vercel serverless kept one list per
-- instance, so orders could land on an instance the dashboard never polls).

create table if not exists public.loan_orders (
  id text primary key check (id ~ '^ord_[0-9a-f]{6,32}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  national_id text not null default '',
  applicant_ar text not null default '',
  lender_id text not null default '',
  lender_ar text not null default '',
  product_ar text not null default '',
  amount numeric not null default 0,
  tenor_months integer not null default 0,
  installment numeric not null default 0,
  apr numeric not null default 0,
  total numeric not null default 0,
  score integer not null default 0,
  risk text not null default '',
  eligible_income numeric not null default 0,
  obligations numeric not null default 0,
  original_tenor_months integer,          -- set once, on the first extension ("كانت 48")
  extended_at timestamptz,
  decided_at timestamptz,
  events jsonb not null default '[]'::jsonb,
  report_d text not null default '',      -- the applicant's encoded fused statement (/report?o=)
  source text not null default 'tabaqa-app'
);

create index if not exists loan_orders_created_idx on public.loan_orders (created_at desc);

create or replace function public.touch_loan_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists loan_orders_touch on public.loan_orders;
create trigger loan_orders_touch
  before update on public.loan_orders
  for each row execute function public.touch_loan_orders();

-- Sandbox demo surface: the /demo desk has no login gate by design, and every
-- row is simulated data — so anon may read and write the desk. (authenticated
-- covers the demo Supabase login used on the dashboard.)
alter table public.loan_orders enable row level security;

drop policy if exists loan_orders_select on public.loan_orders;
create policy loan_orders_select on public.loan_orders
  for select to anon, authenticated using (true);

drop policy if exists loan_orders_insert on public.loan_orders;
create policy loan_orders_insert on public.loan_orders
  for insert to anon, authenticated with check (true);

drop policy if exists loan_orders_update on public.loan_orders;
create policy loan_orders_update on public.loan_orders
  for update to anon, authenticated using (true) with check (true);

drop policy if exists loan_orders_delete on public.loan_orders;
create policy loan_orders_delete on public.loan_orders
  for delete to anon, authenticated using (true);

-- the realtime stream both screens subscribe to (INSERT on the desk, UPDATE on the phone)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'loan_orders'
  ) then
    alter publication supabase_realtime add table public.loan_orders;
  end if;
end;
$$;
