-- Optional session note after completing a workout

alter table public.workout_sessions
  add column if not exists notes text;
