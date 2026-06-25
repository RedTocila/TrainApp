-- Performance: indexes to support activity feed ORDER BY + filters
-- These are safe (IF NOT EXISTS) and align with the most common query patterns.

create index if not exists idx_daily_meal_logs_client_logged_at_desc
  on public.daily_meal_logs(client_id, logged_at desc);

create index if not exists idx_workout_sessions_client_status_completed_at_desc
  on public.workout_sessions(client_id, status, completed_at desc);

create index if not exists idx_body_weight_logs_client_created_at_desc
  on public.body_weight_logs(client_id, created_at desc);

create index if not exists idx_habit_completions_client_completed_at_desc
  on public.habit_completions(client_id, completed_at desc);

create index if not exists idx_schedule_task_completions_client_completed_at_desc
  on public.schedule_task_completions(client_id, completed_at desc);

