-- Store actual duration when a schedule task (e.g. cardio) is completed.
alter table public.schedule_task_completions
  add column if not exists elapsed_seconds int
  check (elapsed_seconds is null or elapsed_seconds >= 0);
