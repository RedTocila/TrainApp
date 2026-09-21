-- Track when the health & lifestyle questionnaire was last saved
-- so we can nudge clients to refresh after ~30 days.
alter table public.profiles
  add column if not exists intake_responses_updated_at timestamptz;

-- Backfill: treat existing completed intakes as updated at account creation.
update public.profiles
set intake_responses_updated_at = created_at
where intake_responses_updated_at is null
  and intake_responses is not null
  and intake_responses <> '{}'::jsonb;
