-- Daily body weight tracking

create table if not exists public.body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 500),
  created_at timestamptz not null default now(),
  unique (client_id, date)
);

create index if not exists idx_body_weight_logs_client_date
  on public.body_weight_logs(client_id, date);

alter table public.body_weight_logs enable row level security;

create policy "body_weight_logs_own" on public.body_weight_logs
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "body_weight_logs_admin_read" on public.body_weight_logs
  for select
  using (public.is_admin());
