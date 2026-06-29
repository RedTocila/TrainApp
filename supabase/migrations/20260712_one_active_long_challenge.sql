-- Enforce at most one active long (transformation) challenge enrollment per user.

create or replace function public.challenge_is_long(c public.challenges)
returns boolean
language sql
stable
as $$
  select coalesce(c.is_transformation, false)
    or c.slug in (
      'transformation-30-day',
      'transformation-90-day',
      'transformation-6-month',
      'transformation-12-month'
    );
$$;

create or replace function public.challenge_is_not_ended(c public.challenges)
returns boolean
language sql
stable
as $$
  select case
    when c.duration_days is not null and c.duration_days > 0 then
      now() <= (c.scheduled_at + (c.duration_days || ' days')::interval)
    else
      now() <= (
        c.scheduled_at
        + (coalesce(c.duration_months, 3) || ' months')::interval
      )
  end;
$$;

create or replace function public.enforce_one_active_long_challenge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.challenges%rowtype;
  blocking_title text;
begin
  select * into target from public.challenges where id = new.challenge_id;
  if not found or not public.challenge_is_long(target) then
    return new;
  end if;

  if not public.challenge_is_not_ended(target) then
    return new;
  end if;

  select c.title into blocking_title
  from public.challenge_participants cp
  join public.challenges c on c.id = cp.challenge_id
  where cp.user_id = new.user_id
    and cp.challenge_id <> new.challenge_id
    and public.challenge_is_long(c)
    and public.challenge_is_not_ended(c)
  limit 1;

  if blocking_title is not null then
    raise exception
      'Already enrolled in an active long challenge (%). Leave it or wait until it finishes before joining another.',
      blocking_title
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_one_active_long_challenge on public.challenge_participants;
create trigger enforce_one_active_long_challenge
  before insert on public.challenge_participants
  for each row
  execute function public.enforce_one_active_long_challenge();

create or replace function public.enforce_one_active_long_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.challenges%rowtype;
  blocking_title text;
begin
  select * into target from public.challenges where id = new.challenge_id;
  if not found or not public.challenge_is_long(target) then
    return new;
  end if;

  if not public.challenge_is_not_ended(target) then
    return new;
  end if;

  select c.title into blocking_title
  from public.challenge_participants cp
  join public.challenges c on c.id = cp.challenge_id
  where cp.user_id = new.user_id
    and cp.challenge_id <> new.challenge_id
    and public.challenge_is_long(c)
    and public.challenge_is_not_ended(c)
  limit 1;

  if blocking_title is not null then
    raise exception
      'Already enrolled in an active long challenge (%). Leave it or wait until it finishes before joining another waitlist.',
      blocking_title
      using errcode = 'check_violation';
  end if;

  select c.title into blocking_title
  from public.challenge_waitlist cw
  join public.challenges c on c.id = cw.challenge_id
  where cw.user_id = new.user_id
    and cw.challenge_id <> new.challenge_id
    and public.challenge_is_long(c)
    and public.challenge_is_not_ended(c)
  limit 1;

  if blocking_title is not null then
    raise exception
      'Already on the waitlist for an active long challenge (%). Leave that waitlist before joining another.',
      blocking_title
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_one_active_long_waitlist on public.challenge_waitlist;
create trigger enforce_one_active_long_waitlist
  before insert on public.challenge_waitlist
  for each row
  execute function public.enforce_one_active_long_waitlist();
