-- Allow opening a workout before the timer starts (started_at set on explicit begin).

alter table public.workout_sessions
  alter column started_at drop default;

alter table public.workout_sessions
  alter column started_at drop not null;
