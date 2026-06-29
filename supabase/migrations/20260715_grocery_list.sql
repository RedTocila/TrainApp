-- Weekly grocery list for nutrition plans + per-client checkmarks

alter table public.nutrition_plans
  add column if not exists grocery_list jsonb;

create table if not exists public.client_grocery_checks (
  client_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  week_key text not null,
  checked_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (client_id, plan_id, week_key)
);

create index if not exists idx_client_grocery_checks_client
  on public.client_grocery_checks(client_id, week_key desc);

alter table public.client_grocery_checks enable row level security;

create policy "client_grocery_checks_own" on public.client_grocery_checks
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);
