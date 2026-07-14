-- HIIT programs: timed work/rest intervals, rounds, and cycles on workout_plans

alter table public.workout_plans
  add column if not exists kind text not null default 'strength';

alter table public.workout_plans
  drop constraint if exists workout_plans_kind_check;

alter table public.workout_plans
  add constraint workout_plans_kind_check
  check (kind in ('strength', 'hiit'));

alter table public.workout_plans
  add column if not exists hiit_config jsonb;

comment on column public.workout_plans.kind is 'strength = sets/reps builder; hiit = interval timer program';
comment on column public.workout_plans.hiit_config is 'HIIT interval config JSON when kind = hiit';
