-- Multi-month tournament challenges: one Zoom elimination round per month

alter table public.challenges
  add column if not exists duration_months integer not null default 3
    check (duration_months >= 1);

comment on column public.challenges.duration_months is
  'Total length of the tournament in months (e.g. 2, 3, or 6). Each month has one Zoom elimination round.';

update public.challenges
set duration_months = 3
where slug = 'demo-summer-challenge';
