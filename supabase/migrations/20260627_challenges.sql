-- Community challenges (LiveKit video rooms)

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  room_name text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists challenges_published_scheduled_idx
  on public.challenges (published, scheduled_at desc);

alter table public.challenges enable row level security;

create policy "Admins manage challenges"
  on public.challenges for all
  using (public.is_admin());

create policy "AI subscribers read published challenges"
  on public.challenges for select
  using (
    public.is_admin()
    or (
      published = true
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.subscription_plan = 'ai'
          and p.subscription_status = 'active'
          and (p.subscription_expires_at is null or p.subscription_expires_at > now())
      )
    )
  );
