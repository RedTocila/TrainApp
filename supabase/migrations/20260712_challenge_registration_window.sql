-- Admin-controlled registration window before challenge start

alter table public.challenges
  add column if not exists registration_opens_at timestamptz,
  add column if not exists registration_closes_at timestamptz;

comment on column public.challenges.registration_opens_at is
  'When participants can start joining. Null = open immediately once published.';
comment on column public.challenges.registration_closes_at is
  'When registration ends. Null = closes at scheduled_at (challenge start).';
