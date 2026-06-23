-- Personal cardio library and calendar scheduling

create table if not exists public.client_cardio (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  youtube_url text,
  duration_minutes int check (
    duration_minutes is null
    or (duration_minutes > 0 and duration_minutes <= 300)
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_cardio (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  cardio_id uuid not null references public.client_cardio(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, scheduled_date)
);

create index if not exists idx_client_cardio_client
  on public.client_cardio(client_id, created_at desc);

create index if not exists idx_scheduled_cardio_client_date
  on public.scheduled_cardio(client_id, scheduled_date);

alter table public.client_cardio enable row level security;
alter table public.scheduled_cardio enable row level security;

create policy "client_cardio_own" on public.client_cardio
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "scheduled_cardio_own" on public.scheduled_cardio
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);
