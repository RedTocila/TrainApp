-- Allow multiple scheduled workouts on the same calendar day (e.g. push + core).

alter table public.scheduled_workouts
  drop constraint if exists scheduled_workouts_client_id_scheduled_date_key;

alter table public.scheduled_workouts
  add column if not exists order_index int not null default 0;

create unique index if not exists scheduled_workouts_client_date_plan_day_unique
  on public.scheduled_workouts (client_id, scheduled_date, plan_id, day_id);

create index if not exists idx_scheduled_workouts_client_date_order
  on public.scheduled_workouts (client_id, scheduled_date, order_index, created_at);

alter table public.workout_sessions
  add column if not exists scheduled_workout_id uuid
  references public.scheduled_workouts(id) on delete set null;

create index if not exists idx_workout_sessions_scheduled_workout
  on public.workout_sessions (scheduled_workout_id)
  where scheduled_workout_id is not null;

-- Backfill order_index for existing rows on the same date.
with ranked as (
  select
    id,
    row_number() over (
      partition by client_id, scheduled_date
      order by created_at, id
    ) - 1 as next_order
  from public.scheduled_workouts
)
update public.scheduled_workouts sw
set order_index = ranked.next_order
from ranked
where sw.id = ranked.id;
