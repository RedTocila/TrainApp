-- Locked identity for progress photo check-ins (first accepted photo establishes baseline)
alter table public.profiles
  add column if not exists progress_photo_identity jsonb;

comment on column public.profiles.progress_photo_identity is 'Coach Alex baseline identity from first valid progress photo — used to reject wrong gender or different person';
