-- Admin-posted announcements on challenge detail pages

create table if not exists public.challenge_announcements (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  title text not null,
  body text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists challenge_announcements_challenge_created_idx
  on public.challenge_announcements (challenge_id, created_at desc);

alter table public.challenge_announcements enable row level security;

create policy "Admins manage challenge announcements"
  on public.challenge_announcements for all
  using (public.is_admin());

create policy "AI subscribers read published challenge announcements"
  on public.challenge_announcements for select
  using (
    public.is_admin()
    or (
      published = true
      and exists (
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
    )
  );
