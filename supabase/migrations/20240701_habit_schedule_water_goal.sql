-- Habit scheduling (time window, repeat days) and daily water goal

alter table public.client_habits
  add column if not exists time_start time,
  add column if not exists time_end time,
  add column if not exists weekdays int[] not null default '{0,1,2,3,4,5,6}',
  add column if not exists repeat_weeks int not null default 12,
  add column if not exists schedule_start date;

create table if not exists public.habit_scheduled_dates (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.client_habits(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  unique (habit_id, scheduled_date)
);

create index if not exists idx_habit_scheduled_dates_client_date
  on public.habit_scheduled_dates(client_id, scheduled_date);

alter table public.habit_scheduled_dates enable row level security;

create policy "habit_scheduled_dates_own" on public.habit_scheduled_dates
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

alter table public.profiles
  add column if not exists water_goal_ml int not null default 2500
    check (water_goal_ml >= 500 and water_goal_ml <= 10000);
