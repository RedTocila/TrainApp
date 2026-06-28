-- Prize pool grows with each registered participant (admin sets € per entry)

alter table public.challenges
  add column if not exists prize_pool_cents_per_participant integer not null default 1000
    check (prize_pool_cents_per_participant >= 0);

comment on column public.challenges.prize_pool_cents_per_participant is
  'Cents added to the champion prize pool for each registered participant (e.g. 1000 = €10).';

-- Demo challenge: €10 per entry (100 demo entrants = €1,000 pool in-app)
update public.challenges
set prize_pool_cents_per_participant = 1000
where slug = 'demo-summer-challenge';
