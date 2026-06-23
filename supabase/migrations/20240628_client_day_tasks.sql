-- Client-managed daily tasks (calendar to-do list)

create table if not exists public.client_day_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  title text not null check (char_length(trim(title)) > 0),
  completed boolean not null default false,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_day_tasks_client_date
  on public.client_day_tasks(client_id, date);

alter table public.client_day_tasks enable row level security;

create policy "client_day_tasks_own" on public.client_day_tasks
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "client_day_tasks_admin_read" on public.client_day_tasks
  for select
  using (public.is_admin());
