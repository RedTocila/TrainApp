-- Workout session logging (in-progress + completed workouts)

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  day_id uuid references public.workout_days(id) on delete set null,
  scheduled_date date,
  day_title text,
  plan_title text,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  name text not null,
  target_sets int not null default 3,
  target_reps text not null default '10',
  order_index int not null default 0,
  notes text
);

create table if not exists public.workout_session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  set_number int not null,
  reps int,
  weight_kg numeric(8, 2),
  completed boolean not null default false,
  unique (session_exercise_id, set_number)
);

create index if not exists idx_workout_sessions_client_status
  on public.workout_sessions(client_id, status);

create index if not exists idx_workout_sessions_client_date
  on public.workout_sessions(client_id, scheduled_date);

create index if not exists idx_workout_session_exercises_session
  on public.workout_session_exercises(session_id);

create index if not exists idx_workout_session_sets_exercise
  on public.workout_session_sets(session_exercise_id);

alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_session_sets enable row level security;

create policy "workout_sessions_own" on public.workout_sessions
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "workout_session_exercises_own" on public.workout_session_exercises
  for all
  using (exists (
    select 1 from public.workout_sessions ws
    where ws.id = workout_session_exercises.session_id
      and ws.client_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_sessions ws
    where ws.id = workout_session_exercises.session_id
      and ws.client_id = auth.uid()
  ));

create policy "workout_session_sets_own" on public.workout_session_sets
  for all
  using (exists (
    select 1 from public.workout_session_exercises wse
    join public.workout_sessions ws on ws.id = wse.session_id
    where wse.id = workout_session_sets.session_exercise_id
      and ws.client_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_session_exercises wse
    join public.workout_sessions ws on ws.id = wse.session_id
    where wse.id = workout_session_sets.session_exercise_id
      and ws.client_id = auth.uid()
  ));
