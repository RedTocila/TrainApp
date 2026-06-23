-- Client health intake for custom nutrition plans + pending schedule on requests

alter table public.profiles
  add column if not exists height_cm integer,
  add column if not exists intake_weight_kg numeric(5, 1),
  add column if not exists vices text,
  add column if not exists injuries text,
  add column if not exists medical_conditions text,
  add column if not exists daily_routine text,
  add column if not exists work_schedule text;

alter table public.plan_requests
  add column if not exists schedule_config jsonb;
