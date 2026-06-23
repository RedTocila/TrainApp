-- User-created workouts, YouTube videos, and calendar scheduling

alter table public.workout_plans
  add column if not exists is_personal boolean not null default false;

alter table public.exercises
  add column if not exists video_url text;

create table if not exists public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  day_id uuid not null references public.workout_days(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, scheduled_date)
);

create index if not exists idx_scheduled_workouts_client_date
  on public.scheduled_workouts(client_id, scheduled_date);

alter table public.scheduled_workouts enable row level security;

-- Personal workout plans: clients manage their own
create policy "workout_plans_personal_own" on public.workout_plans
  for all
  using (is_personal = true and created_by = auth.uid())
  with check (is_personal = true and created_by = auth.uid());

create policy "workout_days_personal" on public.workout_days
  for all
  using (exists (
    select 1 from public.workout_plans wp
    where wp.id = workout_days.plan_id
      and wp.is_personal = true
      and wp.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_plans wp
    where wp.id = workout_days.plan_id
      and wp.is_personal = true
      and wp.created_by = auth.uid()
  ));

create policy "exercises_personal" on public.exercises
  for all
  using (exists (
    select 1 from public.workout_days wd
    join public.workout_plans wp on wp.id = wd.plan_id
    where wd.id = exercises.day_id
      and wp.is_personal = true
      and wp.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_days wd
    join public.workout_plans wp on wp.id = wd.plan_id
    where wd.id = exercises.day_id
      and wp.is_personal = true
      and wp.created_by = auth.uid()
  ));

-- Clients can self-assign their personal plans
create policy "workout_assignments_client_own" on public.workout_assignments
  for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.workout_plans wp
      where wp.id = plan_id
        and wp.is_personal = true
        and wp.created_by = auth.uid()
    )
  );

create policy "workout_assignments_client_update_own" on public.workout_assignments
  for update
  using (auth.uid() = client_id);

-- Scheduled workouts
create policy "scheduled_workouts_own" on public.scheduled_workouts
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);
