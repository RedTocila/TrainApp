-- Client reminder preferences (local notification nudges)

alter table public.profiles
  add column if not exists reminder_settings jsonb not null default '{}'::jsonb;
