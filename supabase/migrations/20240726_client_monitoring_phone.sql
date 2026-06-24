-- Client phone + admin activity monitoring policies

alter table public.profiles
  add column if not exists phone text;

-- Admin policies for client activity monitoring
drop policy if exists "daily_meal_logs_admin_read" on public.daily_meal_logs;
create policy "daily_meal_logs_admin_read" on public.daily_meal_logs
  for select
  using (public.is_admin());

drop policy if exists "workout_sessions_admin_read" on public.workout_sessions;
create policy "workout_sessions_admin_read" on public.workout_sessions
  for select
  using (public.is_admin());

drop policy if exists "habit_completions_admin_read" on public.habit_completions;
create policy "habit_completions_admin_read" on public.habit_completions
  for select
  using (public.is_admin());

drop policy if exists "schedule_task_completions_admin_read" on public.schedule_task_completions;
create policy "schedule_task_completions_admin_read" on public.schedule_task_completions
  for select
  using (public.is_admin());

drop policy if exists "client_habits_admin_read" on public.client_habits;
create policy "client_habits_admin_read" on public.client_habits
  for select
  using (public.is_admin());
