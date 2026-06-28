-- Transformation challenge series: capacity, waitlist, four fixed tiers

alter table public.challenges
  add column if not exists max_participants integer
    check (max_participants is null or max_participants > 0),
  add column if not exists duration_days integer
    check (duration_days is null or duration_days > 0),
  add column if not exists is_transformation boolean not null default false;

comment on column public.challenges.max_participants is
  'Cap on active participants; null = unlimited.';
comment on column public.challenges.duration_days is
  'Optional day-based length (30-day, 90-day). Falls back to duration_months when null.';
comment on column public.challenges.is_transformation is
  'Fixed transformation series — one active enrollment per user across these challenges.';

create table if not exists public.challenge_waitlist (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create index if not exists challenge_waitlist_challenge_created_idx
  on public.challenge_waitlist (challenge_id, created_at asc);

alter table public.challenge_waitlist enable row level security;

create policy "Admins manage challenge waitlist"
  on public.challenge_waitlist for all
  using (public.is_admin());

create policy "Elite subscribers read challenge waitlist"
  on public.challenge_waitlist for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.subscription_plan = 'elite'
            and p.subscription_status = 'active'
            and (p.subscription_expires_at is null or p.subscription_expires_at > now())
        )
    )
  );

create policy "Clients join challenge waitlist"
  on public.challenge_waitlist for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
        and c.is_transformation = true
    )
  );

create policy "Clients leave challenge waitlist"
  on public.challenge_waitlist for delete
  using (auth.uid() = user_id);

create policy "Clients leave their challenge registration"
  on public.challenge_participants for delete
  using (auth.uid() = user_id);

-- Four transformation challenges (100 participants each, €10 per entrant display pool)
insert into public.challenges (
  id,
  title,
  slug,
  description,
  scheduled_at,
  duration_minutes,
  duration_months,
  duration_days,
  group_size,
  max_participants,
  is_transformation,
  prize_pool_cents_per_participant,
  published,
  current_phase
) values
  (
    '10000000-0000-4000-8000-000000000030',
    '30-Day Transformation Challenge',
    'transformation-30-day',
    'Commit to 30 days of consistent training, nutrition, and habits. One elimination tournament with Zoom check-ins. **100 spots max** — join the waitlist when full.',
    date_trunc('month', now()),
    60,
    1,
    30,
    10,
    100,
    true,
    1000,
    true,
    0
  ),
  (
    '10000000-0000-4000-8000-000000000090',
    '90-Day Transformation Challenge',
    'transformation-90-day',
    'A full quarter to transform your physique and build lasting habits. Three-month tournament with elimination Zoom rounds. **100 spots max**.',
    date_trunc('month', now()),
    60,
    3,
    90,
    10,
    100,
    true,
    1000,
    true,
    0
  ),
  (
    '10000000-0000-4000-8000-000000000180',
    '6-Month Transformation Challenge',
    'transformation-6-month',
    'Six months of structured progress toward your best shape. Long-form tournament with monthly elimination Zoom days. **100 spots max**.',
    date_trunc('month', now()),
    60,
    6,
    null,
    10,
    100,
    true,
    1000,
    true,
    0
  ),
  (
    '10000000-0000-4000-8000-000000000360',
    '12-Month Transformation Challenge',
    'transformation-12-month',
    'The ultimate year-long transformation journey. Twelve months of logging, AI coaching, and live Zoom eliminations. **100 spots max**.',
    date_trunc('month', now()),
    60,
    12,
    null,
    10,
    100,
    true,
    1000,
    true,
    0
  )
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  duration_months = excluded.duration_months,
  duration_days = excluded.duration_days,
  max_participants = excluded.max_participants,
  is_transformation = excluded.is_transformation,
  prize_pool_cents_per_participant = excluded.prize_pool_cents_per_participant,
  published = excluded.published;
