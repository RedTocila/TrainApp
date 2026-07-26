-- Allow warm-up and stretching plans alongside main workouts
alter table public.workout_plans
  drop constraint if exists workout_plans_kind_check;

alter table public.workout_plans
  add constraint workout_plans_kind_check
  check (kind in ('strength', 'hiit', 'warmup', 'stretch'));

comment on column public.workout_plans.kind is
  'strength/hiit = main workouts; warmup/stretch = extras that can share a calendar day';
