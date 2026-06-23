-- Meals logged per day (macros summed into Nutrition Today)

create table if not exists public.daily_meal_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  description text,
  calories int not null default 0,
  protein int not null default 0,
  carbs int not null default 0,
  fat int not null default 0,
  foods jsonb not null default '[]',
  source_meal_id uuid references public.meals(id) on delete set null,
  logged_at timestamptz not null default now()
);

create index if not exists idx_daily_meal_logs_client_date
  on public.daily_meal_logs(client_id, date);

alter table public.daily_meal_logs enable row level security;

create policy "daily_meal_logs_own" on public.daily_meal_logs
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);
