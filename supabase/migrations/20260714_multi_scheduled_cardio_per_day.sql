-- Allow multiple scheduled cardio sessions on the same calendar day.

alter table public.scheduled_cardio
  drop constraint if exists scheduled_cardio_client_id_scheduled_date_key;

alter table public.scheduled_cardio
  add column if not exists order_index int not null default 0;

create unique index if not exists scheduled_cardio_client_date_cardio_unique
  on public.scheduled_cardio (client_id, scheduled_date, cardio_id);

create index if not exists idx_scheduled_cardio_client_date_order
  on public.scheduled_cardio (client_id, scheduled_date, order_index, created_at);

-- Backfill order_index for existing rows on the same date.
with ranked as (
  select
    id,
    row_number() over (
      partition by client_id, scheduled_date
      order by created_at, id
    ) - 1 as next_order
  from public.scheduled_cardio
)
update public.scheduled_cardio sc
set order_index = ranked.next_order
from ranked
where sc.id = ranked.id;
