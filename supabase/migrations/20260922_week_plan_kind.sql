-- Weekly templates: Mon/Tue/… with optional warm-up + stretch per day
alter table public.workout_plans
  drop constraint if exists workout_plans_kind_check;

alter table public.workout_plans
  add constraint workout_plans_kind_check
  check (kind in ('strength', 'hiit', 'warmup', 'stretch', 'week'));

alter table public.workout_plans
  add column if not exists week_config jsonb;

comment on column public.workout_plans.kind is
  'strength/hiit = single workouts; warmup/stretch = day extras; week = full-week template';
comment on column public.workout_plans.week_config is
  'Week template JSON when kind = week (days with main/warmup/stretch plan refs)';
