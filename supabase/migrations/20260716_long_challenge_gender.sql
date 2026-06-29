-- Long (transformation) challenges are gender-specific: 4 tiers × men/women.

alter table public.challenges
  add column if not exists gender text;

alter table public.challenges
  drop constraint if exists challenges_gender_values;

alter table public.challenges
  add constraint challenges_gender_values
  check (gender is null or gender in ('male', 'female'));

comment on column public.challenges.gender is
  'For long challenges: male or female pool. Null for flash and legacy admin challenges.';

-- Mark existing transformation tiers as men and rename slugs.
update public.challenges
set
  gender = 'male',
  slug = case slug
    when 'transformation-30-day' then 'transformation-30-day-men'
    when 'transformation-90-day' then 'transformation-90-day-men'
    when 'transformation-6-month' then 'transformation-6-month-men'
    when 'transformation-12-month' then 'transformation-12-month-men'
    else slug
  end
where is_transformation = true
  and gender is null;

-- Women's long challenges (same tiers, separate pools).
insert into public.challenges (
  id,
  title,
  slug,
  description,
  scheduled_at,
  duration_minutes,
  duration_months,
  duration_days,
  group_size,
  max_participants,
  is_transformation,
  gender,
  prize_pool_cents_per_participant,
  published,
  current_phase
)
select
  v.id,
  v.title,
  v.slug,
  v.description,
  date_trunc('month', now()),
  60,
  v.duration_months,
  v.duration_days,
  10,
  100,
  true,
  'female',
  1000,
  true,
  0
from (
  values
    (
      '10000000-0000-4000-8000-000000000031'::uuid,
      '30-Day Transformation Challenge',
      'transformation-30-day-women',
      'Commit to 30 days of consistent training, nutrition, and habits. **100 spots max** — join the waitlist when full. **+€10 per participant** added to the prize pool each month (up to **€1,000** at full capacity).',
      1,
      30
    ),
    (
      '10000000-0000-4000-8000-000000000091'::uuid,
      '90-Day Transformation Challenge',
      'transformation-90-day-women',
      'A full quarter to transform your physique and build lasting habits. **100 spots max** with a FIFO waitlist when full. **+€10 per participant per month** (up to **€3,000** at full capacity).',
      3,
      90
    ),
    (
      '10000000-0000-4000-8000-000000000181'::uuid,
      '6-Month Transformation Challenge',
      'transformation-6-month-women',
      'Six months of structured progress toward your best shape. Long-form tournament with monthly elimination Zoom days. **100 spots max**. **+€10 per participant per month** (up to **€6,000** at full capacity).',
      6,
      null::integer
    ),
    (
      '10000000-0000-4000-8000-000000000361'::uuid,
      '12-Month Transformation Challenge',
      'transformation-12-month-women',
      'The ultimate year-long transformation journey. Twelve months of logging, AI coaching, and live Zoom eliminations. **100 spots max**. **+€10 per participant per month** (up to **€12,000** at full capacity).',
      12,
      null::integer
    )
) as v(id, title, slug, description, duration_months, duration_days)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  duration_months = excluded.duration_months,
  duration_days = excluded.duration_days,
  max_participants = excluded.max_participants,
  is_transformation = excluded.is_transformation,
  gender = excluded.gender,
  prize_pool_cents_per_participant = excluded.prize_pool_cents_per_participant,
  published = excluded.published;

-- Prefer is_transformation flag over slug list for long-challenge detection.
create or replace function public.challenge_is_long(c public.challenges)
returns boolean
language sql
stable
as $$
  select coalesce(c.is_transformation, false);
$$;

-- Block joining a long challenge when profile gender does not match the challenge pool.
create or replace function public.enforce_long_challenge_gender_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.challenges%rowtype;
  profile_gender text;
begin
  select * into target from public.challenges where id = new.challenge_id;
  if not found or not public.challenge_is_long(target) or target.gender is null then
    return new;
  end if;

  select p.gender into profile_gender
  from public.profiles p
  where p.id = new.user_id;

  if profile_gender is distinct from target.gender then
    raise exception
      'This long challenge is for % only.',
      case target.gender when 'male' then 'men' else 'women' end
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_long_challenge_gender_participants on public.challenge_participants;
create trigger enforce_long_challenge_gender_participants
  before insert on public.challenge_participants
  for each row
  execute function public.enforce_long_challenge_gender_match();

drop trigger if exists enforce_long_challenge_gender_waitlist on public.challenge_waitlist;
create trigger enforce_long_challenge_gender_waitlist
  before insert on public.challenge_waitlist
  for each row
  execute function public.enforce_long_challenge_gender_match();
