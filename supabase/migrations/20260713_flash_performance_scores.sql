-- Flash challenge group winner performance (seconds, reps, etc.)

alter table public.challenge_group_members
  add column if not exists performance_value numeric check (performance_value is null or performance_value >= 0);

comment on column public.challenge_group_members.performance_value is
  'Flash challenges: winning record entered by admin after Zoom judging (e.g. plank seconds, burpee count).';
