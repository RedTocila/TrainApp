-- Active = users can join. Published = visible in catalog.
-- Existing challenges stay active so live entries are unaffected.
alter table public.challenges
  add column if not exists is_active boolean not null default true;

comment on column public.challenges.is_active is
  'When false, challenge stays visible (if published) but greyed out and join is blocked.';
