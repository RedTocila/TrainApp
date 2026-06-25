-- Live classes (RUTINA AI / €24 plan)

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  category text not null default 'Training'
    check (category in ('Training', 'Nutrition', 'Recovery', 'Mindset', 'Science')),
  cover_image text,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  meeting_url text,
  replay_url text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists classes_published_scheduled_idx
  on public.classes (published, scheduled_at desc);

alter table public.classes enable row level security;

create policy "Admins manage classes"
  on public.classes for all
  using (public.is_admin());

create policy "AI subscribers read published classes"
  on public.classes for select
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
