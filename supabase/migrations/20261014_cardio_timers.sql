-- Shared cardio clock so the iPhone and Apple Watch start and stop the same session.

create table if not exists public.cardio_timers (
  client_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  cardio_id uuid not null,
  status text not null check (status in ('idle', 'running', 'paused')),
  accumulated_ms integer not null default 0 check (accumulated_ms >= 0),
  segment_started_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (client_id, scheduled_date, cardio_id)
);

alter table public.cardio_timers enable row level security;

drop policy if exists "cardio_timers_select_own" on public.cardio_timers;
drop policy if exists "cardio_timers_insert_own" on public.cardio_timers;
drop policy if exists "cardio_timers_update_own" on public.cardio_timers;
drop policy if exists "cardio_timers_delete_own" on public.cardio_timers;

create policy "cardio_timers_select_own"
  on public.cardio_timers for select
  using (auth.uid() = client_id);

create policy "cardio_timers_insert_own"
  on public.cardio_timers for insert
  with check (auth.uid() = client_id);

create policy "cardio_timers_update_own"
  on public.cardio_timers for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "cardio_timers_delete_own"
  on public.cardio_timers for delete
  using (auth.uid() = client_id);

grant select, insert, update, delete on table public.cardio_timers to authenticated;
grant select, insert, update, delete on table public.cardio_timers to service_role;
