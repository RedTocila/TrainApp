-- Replace LiveKit rooms with Zoom + tournament bracket system

alter table public.challenges
  drop column if exists room_name;

alter table public.challenges
  add column if not exists group_size integer not null default 10 check (group_size > 0);

alter table public.challenges
  add column if not exists final_zoom_url text;

create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

alter table public.challenges
  add column if not exists champion_participant_id uuid references public.challenge_participants (id) on delete set null;

create table if not exists public.challenge_groups (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  round smallint not null check (round in (1, 2)),
  group_number integer not null check (group_number > 0),
  zoom_url text,
  winner_participant_id uuid references public.challenge_participants (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (challenge_id, round, group_number)
);

create table if not exists public.challenge_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.challenge_groups (id) on delete cascade,
  participant_id uuid not null references public.challenge_participants (id) on delete cascade,
  unique (group_id, participant_id)
);

create index if not exists challenge_participants_challenge_idx
  on public.challenge_participants (challenge_id);

create index if not exists challenge_groups_challenge_idx
  on public.challenge_groups (challenge_id);

alter table public.challenge_participants enable row level security;
alter table public.challenge_groups enable row level security;
alter table public.challenge_group_members enable row level security;

create policy "Admins manage challenge participants"
  on public.challenge_participants for all
  using (public.is_admin());

create policy "AI subscribers read challenge participants"
  on public.challenge_participants for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.subscription_plan = 'ai'
            and p.subscription_status = 'active'
            and (p.subscription_expires_at is null or p.subscription_expires_at > now())
        )
    )
  );

create policy "Clients register for published challenges"
  on public.challenge_participants for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
    )
  );

create policy "Admins manage challenge groups"
  on public.challenge_groups for all
  using (public.is_admin());

create policy "AI subscribers read challenge groups"
  on public.challenge_groups for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.subscription_plan = 'ai'
            and p.subscription_status = 'active'
            and (p.subscription_expires_at is null or p.subscription_expires_at > now())
        )
    )
  );

create policy "Admins manage challenge group members"
  on public.challenge_group_members for all
  using (public.is_admin());

create policy "AI subscribers read challenge group members"
  on public.challenge_group_members for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.challenge_groups g
      join public.challenges c on c.id = g.challenge_id
      where g.id = group_id
        and c.published = true
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.subscription_plan = 'ai'
            and p.subscription_status = 'active'
            and (p.subscription_expires_at is null or p.subscription_expires_at > now())
        )
    )
  );
