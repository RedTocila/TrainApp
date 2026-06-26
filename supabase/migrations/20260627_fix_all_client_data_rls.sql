-- Fix RLS for all client-owned tables: split FOR ALL policies and grant authenticated access.

-- body_weight_logs
drop policy if exists "body_weight_logs_own" on public.body_weight_logs;
drop policy if exists "body_weight_logs_select_own" on public.body_weight_logs;
drop policy if exists "body_weight_logs_insert_own" on public.body_weight_logs;
drop policy if exists "body_weight_logs_update_own" on public.body_weight_logs;
drop policy if exists "body_weight_logs_delete_own" on public.body_weight_logs;
create policy "body_weight_logs_select_own" on public.body_weight_logs for select using (auth.uid() = client_id);
create policy "body_weight_logs_insert_own" on public.body_weight_logs for insert with check (auth.uid() = client_id);
create policy "body_weight_logs_update_own" on public.body_weight_logs for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "body_weight_logs_delete_own" on public.body_weight_logs for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.body_weight_logs to authenticated;

-- progress_photo_sets
drop policy if exists "progress_photo_sets_own" on public.progress_photo_sets;
drop policy if exists "progress_photo_sets_select_own" on public.progress_photo_sets;
drop policy if exists "progress_photo_sets_insert_own" on public.progress_photo_sets;
drop policy if exists "progress_photo_sets_update_own" on public.progress_photo_sets;
drop policy if exists "progress_photo_sets_delete_own" on public.progress_photo_sets;
create policy "progress_photo_sets_select_own" on public.progress_photo_sets for select using (auth.uid() = client_id);
create policy "progress_photo_sets_insert_own" on public.progress_photo_sets for insert with check (auth.uid() = client_id);
create policy "progress_photo_sets_update_own" on public.progress_photo_sets for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "progress_photo_sets_delete_own" on public.progress_photo_sets for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.progress_photo_sets to authenticated;

-- daily_logs
drop policy if exists "Clients manage own logs" on public.daily_logs;
drop policy if exists "daily_logs_select_own" on public.daily_logs;
drop policy if exists "daily_logs_insert_own" on public.daily_logs;
drop policy if exists "daily_logs_update_own" on public.daily_logs;
drop policy if exists "daily_logs_delete_own" on public.daily_logs;
create policy "daily_logs_select_own" on public.daily_logs for select using (auth.uid() = client_id);
create policy "daily_logs_insert_own" on public.daily_logs for insert with check (auth.uid() = client_id);
create policy "daily_logs_update_own" on public.daily_logs for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "daily_logs_delete_own" on public.daily_logs for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.daily_logs to authenticated;

-- daily_meal_logs
drop policy if exists "daily_meal_logs_own" on public.daily_meal_logs;
drop policy if exists "daily_meal_logs_select_own" on public.daily_meal_logs;
drop policy if exists "daily_meal_logs_insert_own" on public.daily_meal_logs;
drop policy if exists "daily_meal_logs_update_own" on public.daily_meal_logs;
drop policy if exists "daily_meal_logs_delete_own" on public.daily_meal_logs;
create policy "daily_meal_logs_select_own" on public.daily_meal_logs for select using (auth.uid() = client_id);
create policy "daily_meal_logs_insert_own" on public.daily_meal_logs for insert with check (auth.uid() = client_id);
create policy "daily_meal_logs_update_own" on public.daily_meal_logs for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "daily_meal_logs_delete_own" on public.daily_meal_logs for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.daily_meal_logs to authenticated;

-- schedule_task_completions
drop policy if exists "schedule_task_completions_own" on public.schedule_task_completions;
drop policy if exists "schedule_task_completions_select_own" on public.schedule_task_completions;
drop policy if exists "schedule_task_completions_insert_own" on public.schedule_task_completions;
drop policy if exists "schedule_task_completions_update_own" on public.schedule_task_completions;
drop policy if exists "schedule_task_completions_delete_own" on public.schedule_task_completions;
create policy "schedule_task_completions_select_own" on public.schedule_task_completions for select using (auth.uid() = client_id);
create policy "schedule_task_completions_insert_own" on public.schedule_task_completions for insert with check (auth.uid() = client_id);
create policy "schedule_task_completions_update_own" on public.schedule_task_completions for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "schedule_task_completions_delete_own" on public.schedule_task_completions for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.schedule_task_completions to authenticated;

-- client_day_tasks
drop policy if exists "client_day_tasks_own" on public.client_day_tasks;
drop policy if exists "client_day_tasks_select_own" on public.client_day_tasks;
drop policy if exists "client_day_tasks_insert_own" on public.client_day_tasks;
drop policy if exists "client_day_tasks_update_own" on public.client_day_tasks;
drop policy if exists "client_day_tasks_delete_own" on public.client_day_tasks;
create policy "client_day_tasks_select_own" on public.client_day_tasks for select using (auth.uid() = client_id);
create policy "client_day_tasks_insert_own" on public.client_day_tasks for insert with check (auth.uid() = client_id);
create policy "client_day_tasks_update_own" on public.client_day_tasks for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "client_day_tasks_delete_own" on public.client_day_tasks for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.client_day_tasks to authenticated;

-- workout_folders
drop policy if exists "workout_folders_own" on public.workout_folders;
drop policy if exists "workout_folders_select_own" on public.workout_folders;
drop policy if exists "workout_folders_insert_own" on public.workout_folders;
drop policy if exists "workout_folders_update_own" on public.workout_folders;
drop policy if exists "workout_folders_delete_own" on public.workout_folders;
create policy "workout_folders_select_own" on public.workout_folders for select using (auth.uid() = client_id);
create policy "workout_folders_insert_own" on public.workout_folders for insert with check (auth.uid() = client_id);
create policy "workout_folders_update_own" on public.workout_folders for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "workout_folders_delete_own" on public.workout_folders for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.workout_folders to authenticated;

-- nutrition_folders
drop policy if exists "nutrition_folders_own" on public.nutrition_folders;
drop policy if exists "nutrition_folders_select_own" on public.nutrition_folders;
drop policy if exists "nutrition_folders_insert_own" on public.nutrition_folders;
drop policy if exists "nutrition_folders_update_own" on public.nutrition_folders;
drop policy if exists "nutrition_folders_delete_own" on public.nutrition_folders;
create policy "nutrition_folders_select_own" on public.nutrition_folders for select using (auth.uid() = client_id);
create policy "nutrition_folders_insert_own" on public.nutrition_folders for insert with check (auth.uid() = client_id);
create policy "nutrition_folders_update_own" on public.nutrition_folders for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "nutrition_folders_delete_own" on public.nutrition_folders for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.nutrition_folders to authenticated;

-- scheduled_workouts
drop policy if exists "scheduled_workouts_own" on public.scheduled_workouts;
drop policy if exists "scheduled_workouts_select_own" on public.scheduled_workouts;
drop policy if exists "scheduled_workouts_insert_own" on public.scheduled_workouts;
drop policy if exists "scheduled_workouts_update_own" on public.scheduled_workouts;
drop policy if exists "scheduled_workouts_delete_own" on public.scheduled_workouts;
create policy "scheduled_workouts_select_own" on public.scheduled_workouts for select using (auth.uid() = client_id);
create policy "scheduled_workouts_insert_own" on public.scheduled_workouts for insert with check (auth.uid() = client_id);
create policy "scheduled_workouts_update_own" on public.scheduled_workouts for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "scheduled_workouts_delete_own" on public.scheduled_workouts for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.scheduled_workouts to authenticated;

-- scheduled_nutrition_days
drop policy if exists "scheduled_nutrition_own" on public.scheduled_nutrition_days;
drop policy if exists "scheduled_nutrition_days_select_own" on public.scheduled_nutrition_days;
drop policy if exists "scheduled_nutrition_days_insert_own" on public.scheduled_nutrition_days;
drop policy if exists "scheduled_nutrition_days_update_own" on public.scheduled_nutrition_days;
drop policy if exists "scheduled_nutrition_days_delete_own" on public.scheduled_nutrition_days;
create policy "scheduled_nutrition_days_select_own" on public.scheduled_nutrition_days for select using (auth.uid() = client_id);
create policy "scheduled_nutrition_days_insert_own" on public.scheduled_nutrition_days for insert with check (auth.uid() = client_id);
create policy "scheduled_nutrition_days_update_own" on public.scheduled_nutrition_days for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "scheduled_nutrition_days_delete_own" on public.scheduled_nutrition_days for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.scheduled_nutrition_days to authenticated;

-- scheduled_meal_slots
drop policy if exists "scheduled_meal_slots_own" on public.scheduled_meal_slots;
drop policy if exists "scheduled_meal_slots_select_own" on public.scheduled_meal_slots;
drop policy if exists "scheduled_meal_slots_insert_own" on public.scheduled_meal_slots;
drop policy if exists "scheduled_meal_slots_update_own" on public.scheduled_meal_slots;
drop policy if exists "scheduled_meal_slots_delete_own" on public.scheduled_meal_slots;
create policy "scheduled_meal_slots_select_own" on public.scheduled_meal_slots for select using (auth.uid() = client_id);
create policy "scheduled_meal_slots_insert_own" on public.scheduled_meal_slots for insert with check (auth.uid() = client_id);
create policy "scheduled_meal_slots_update_own" on public.scheduled_meal_slots for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "scheduled_meal_slots_delete_own" on public.scheduled_meal_slots for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.scheduled_meal_slots to authenticated;

-- client_cardio + scheduled_cardio (idempotent with prior fix)
drop policy if exists "client_cardio_own" on public.client_cardio;
drop policy if exists "client_cardio_select_own" on public.client_cardio;
drop policy if exists "client_cardio_insert_own" on public.client_cardio;
drop policy if exists "client_cardio_update_own" on public.client_cardio;
drop policy if exists "client_cardio_delete_own" on public.client_cardio;
create policy "client_cardio_select_own" on public.client_cardio for select using (auth.uid() = client_id);
create policy "client_cardio_insert_own" on public.client_cardio for insert with check (auth.uid() = client_id);
create policy "client_cardio_update_own" on public.client_cardio for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "client_cardio_delete_own" on public.client_cardio for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.client_cardio to authenticated;

drop policy if exists "scheduled_cardio_own" on public.scheduled_cardio;
drop policy if exists "scheduled_cardio_select_own" on public.scheduled_cardio;
drop policy if exists "scheduled_cardio_insert_own" on public.scheduled_cardio;
drop policy if exists "scheduled_cardio_update_own" on public.scheduled_cardio;
drop policy if exists "scheduled_cardio_delete_own" on public.scheduled_cardio;
create policy "scheduled_cardio_select_own" on public.scheduled_cardio for select using (auth.uid() = client_id);
create policy "scheduled_cardio_insert_own" on public.scheduled_cardio for insert with check (auth.uid() = client_id);
create policy "scheduled_cardio_update_own" on public.scheduled_cardio for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "scheduled_cardio_delete_own" on public.scheduled_cardio for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.scheduled_cardio to authenticated;

-- client_habits + related (idempotent)
drop policy if exists "client_habits_own" on public.client_habits;
drop policy if exists "client_habits_select_own" on public.client_habits;
drop policy if exists "client_habits_insert_own" on public.client_habits;
drop policy if exists "client_habits_update_own" on public.client_habits;
drop policy if exists "client_habits_delete_own" on public.client_habits;
create policy "client_habits_select_own" on public.client_habits for select using (auth.uid() = client_id);
create policy "client_habits_insert_own" on public.client_habits for insert with check (auth.uid() = client_id);
create policy "client_habits_update_own" on public.client_habits for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "client_habits_delete_own" on public.client_habits for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.client_habits to authenticated;

drop policy if exists "habit_completions_own" on public.habit_completions;
drop policy if exists "habit_completions_select_own" on public.habit_completions;
drop policy if exists "habit_completions_insert_own" on public.habit_completions;
drop policy if exists "habit_completions_delete_own" on public.habit_completions;
create policy "habit_completions_select_own" on public.habit_completions for select using (auth.uid() = client_id);
create policy "habit_completions_insert_own" on public.habit_completions for insert with check (auth.uid() = client_id);
create policy "habit_completions_delete_own" on public.habit_completions for delete using (auth.uid() = client_id);
grant select, insert, delete on table public.habit_completions to authenticated;

drop policy if exists "habit_scheduled_dates_own" on public.habit_scheduled_dates;
drop policy if exists "habit_scheduled_dates_select_own" on public.habit_scheduled_dates;
drop policy if exists "habit_scheduled_dates_insert_own" on public.habit_scheduled_dates;
drop policy if exists "habit_scheduled_dates_update_own" on public.habit_scheduled_dates;
drop policy if exists "habit_scheduled_dates_delete_own" on public.habit_scheduled_dates;
create policy "habit_scheduled_dates_select_own" on public.habit_scheduled_dates for select using (auth.uid() = client_id);
create policy "habit_scheduled_dates_insert_own" on public.habit_scheduled_dates for insert with check (auth.uid() = client_id);
create policy "habit_scheduled_dates_update_own" on public.habit_scheduled_dates for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "habit_scheduled_dates_delete_own" on public.habit_scheduled_dates for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.habit_scheduled_dates to authenticated;

-- workout_sessions
drop policy if exists "workout_sessions_own" on public.workout_sessions;
drop policy if exists "workout_sessions_select_own" on public.workout_sessions;
drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
drop policy if exists "workout_sessions_delete_own" on public.workout_sessions;
create policy "workout_sessions_select_own" on public.workout_sessions for select using (auth.uid() = client_id);
create policy "workout_sessions_insert_own" on public.workout_sessions for insert with check (auth.uid() = client_id);
create policy "workout_sessions_update_own" on public.workout_sessions for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "workout_sessions_delete_own" on public.workout_sessions for delete using (auth.uid() = client_id);
grant select, insert, update, delete on table public.workout_sessions to authenticated;

drop policy if exists "workout_session_exercises_own" on public.workout_session_exercises;
drop policy if exists "workout_session_exercises_select_own" on public.workout_session_exercises;
drop policy if exists "workout_session_exercises_insert_own" on public.workout_session_exercises;
drop policy if exists "workout_session_exercises_update_own" on public.workout_session_exercises;
drop policy if exists "workout_session_exercises_delete_own" on public.workout_session_exercises;
create policy "workout_session_exercises_select_own" on public.workout_session_exercises for select using (
  exists (select 1 from public.workout_sessions ws where ws.id = workout_session_exercises.session_id and ws.client_id = auth.uid())
);
create policy "workout_session_exercises_insert_own" on public.workout_session_exercises for insert with check (
  exists (select 1 from public.workout_sessions ws where ws.id = workout_session_exercises.session_id and ws.client_id = auth.uid())
);
create policy "workout_session_exercises_update_own" on public.workout_session_exercises for update using (
  exists (select 1 from public.workout_sessions ws where ws.id = workout_session_exercises.session_id and ws.client_id = auth.uid())
) with check (
  exists (select 1 from public.workout_sessions ws where ws.id = workout_session_exercises.session_id and ws.client_id = auth.uid())
);
create policy "workout_session_exercises_delete_own" on public.workout_session_exercises for delete using (
  exists (select 1 from public.workout_sessions ws where ws.id = workout_session_exercises.session_id and ws.client_id = auth.uid())
);
grant select, insert, update, delete on table public.workout_session_exercises to authenticated;

drop policy if exists "workout_session_sets_own" on public.workout_session_sets;
drop policy if exists "workout_session_sets_select_own" on public.workout_session_sets;
drop policy if exists "workout_session_sets_insert_own" on public.workout_session_sets;
drop policy if exists "workout_session_sets_update_own" on public.workout_session_sets;
drop policy if exists "workout_session_sets_delete_own" on public.workout_session_sets;
create policy "workout_session_sets_select_own" on public.workout_session_sets for select using (
  exists (
    select 1 from public.workout_session_exercises wse
    join public.workout_sessions ws on ws.id = wse.session_id
    where wse.id = workout_session_sets.session_exercise_id and ws.client_id = auth.uid()
  )
);
create policy "workout_session_sets_insert_own" on public.workout_session_sets for insert with check (
  exists (
    select 1 from public.workout_session_exercises wse
    join public.workout_sessions ws on ws.id = wse.session_id
    where wse.id = workout_session_sets.session_exercise_id and ws.client_id = auth.uid()
  )
);
create policy "workout_session_sets_update_own" on public.workout_session_sets for update using (
  exists (
    select 1 from public.workout_session_exercises wse
    join public.workout_sessions ws on ws.id = wse.session_id
    where wse.id = workout_session_sets.session_exercise_id and ws.client_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.workout_session_exercises wse
    join public.workout_sessions ws on ws.id = wse.session_id
    where wse.id = workout_session_sets.session_exercise_id and ws.client_id = auth.uid()
  )
);
create policy "workout_session_sets_delete_own" on public.workout_session_sets for delete using (
  exists (
    select 1 from public.workout_session_exercises wse
    join public.workout_sessions ws on ws.id = wse.session_id
    where wse.id = workout_session_sets.session_exercise_id and ws.client_id = auth.uid()
  )
);
grant select, insert, update, delete on table public.workout_session_sets to authenticated;
