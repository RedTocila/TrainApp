create table if not exists public.user_usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  counter_key text not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, counter_key)
);

create index if not exists user_usage_counters_user_id_idx
  on public.user_usage_counters (user_id);

alter table public.user_usage_counters enable row level security;
