-- Ensure client habit RLS policies allow authenticated clients to manage their own rows.

drop policy if exists "client_habits_own" on public.client_habits;
drop policy if exists "client_habits_select_own" on public.client_habits;
drop policy if exists "client_habits_insert_own" on public.client_habits;
drop policy if exists "client_habits_update_own" on public.client_habits;
drop policy if exists "client_habits_delete_own" on public.client_habits;

create policy "client_habits_select_own" on public.client_habits
  for select
  using (auth.uid() = client_id);

create policy "client_habits_insert_own" on public.client_habits
  for insert
  with check (auth.uid() = client_id);

create policy "client_habits_update_own" on public.client_habits
  for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "client_habits_delete_own" on public.client_habits
  for delete
  using (auth.uid() = client_id);

drop policy if exists "habit_completions_own" on public.habit_completions;
drop policy if exists "habit_completions_select_own" on public.habit_completions;
drop policy if exists "habit_completions_insert_own" on public.habit_completions;
drop policy if exists "habit_completions_delete_own" on public.habit_completions;

create policy "habit_completions_select_own" on public.habit_completions
  for select
  using (auth.uid() = client_id);

create policy "habit_completions_insert_own" on public.habit_completions
  for insert
  with check (auth.uid() = client_id);

create policy "habit_completions_delete_own" on public.habit_completions
  for delete
  using (auth.uid() = client_id);

drop policy if exists "habit_scheduled_dates_own" on public.habit_scheduled_dates;
drop policy if exists "habit_scheduled_dates_select_own" on public.habit_scheduled_dates;
drop policy if exists "habit_scheduled_dates_insert_own" on public.habit_scheduled_dates;
drop policy if exists "habit_scheduled_dates_update_own" on public.habit_scheduled_dates;
drop policy if exists "habit_scheduled_dates_delete_own" on public.habit_scheduled_dates;

create policy "habit_scheduled_dates_select_own" on public.habit_scheduled_dates
  for select
  using (auth.uid() = client_id);

create policy "habit_scheduled_dates_insert_own" on public.habit_scheduled_dates
  for insert
  with check (auth.uid() = client_id);

create policy "habit_scheduled_dates_update_own" on public.habit_scheduled_dates
  for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "habit_scheduled_dates_delete_own" on public.habit_scheduled_dates
  for delete
  using (auth.uid() = client_id);
