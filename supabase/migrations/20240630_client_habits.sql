-- User-defined daily habits

create table if not exists public.client_habits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_completions (
  habit_id uuid not null references public.client_habits(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  completed_at timestamptz not null default now(),
  primary key (habit_id, date)
);

create index if not exists idx_client_habits_client
  on public.client_habits(client_id);

create index if not exists idx_habit_completions_client_date
  on public.habit_completions(client_id, date);

alter table public.client_habits enable row level security;
alter table public.habit_completions enable row level security;

create policy "client_habits_own" on public.client_habits
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "habit_completions_own" on public.habit_completions
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);
