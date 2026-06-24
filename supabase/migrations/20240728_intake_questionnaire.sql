-- Structured health & lifestyle questionnaire responses (pre-signup + profile)

alter table public.profiles
  add column if not exists intake_responses jsonb not null default '{}';
