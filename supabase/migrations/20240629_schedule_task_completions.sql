-- Track completion of schedule-derived daily tasks (workout, nutrition, etc.)

create table if not exists public.schedule_task_completions (
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  task_id text not null,
  completed_at timestamptz not null default now(),
  primary key (client_id, date, task_id)
);

create index if not exists idx_schedule_task_completions_client_date
  on public.schedule_task_completions(client_id, date);

alter table public.schedule_task_completions enable row level security;

create policy "schedule_task_completions_own" on public.schedule_task_completions
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);
