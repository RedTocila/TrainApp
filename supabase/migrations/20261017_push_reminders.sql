-- Device tokens for reminder push, and one send record per daytime slot.

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_token_key unique (token)
);

create index if not exists idx_push_devices_user on public.push_devices(user_id);

alter table public.push_devices enable row level security;

drop policy if exists "push_devices_select_own" on public.push_devices;
drop policy if exists "push_devices_insert_own" on public.push_devices;
drop policy if exists "push_devices_update_own" on public.push_devices;
drop policy if exists "push_devices_delete_own" on public.push_devices;

create policy "push_devices_select_own" on public.push_devices
  for select using (auth.uid() = user_id);
create policy "push_devices_insert_own" on public.push_devices
  for insert with check (auth.uid() = user_id);
create policy "push_devices_update_own" on public.push_devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_devices_delete_own" on public.push_devices
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on table public.push_devices to authenticated;

create table if not exists public.reminder_push_sends (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date_key date not null,
  slot smallint not null check (slot in (1, 2, 3)),
  types text[] not null default '{}',
  sent_at timestamptz not null default now(),
  primary key (user_id, date_key, slot)
);

alter table public.reminder_push_sends enable row level security;
