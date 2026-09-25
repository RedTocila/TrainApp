-- Align one-active long-challenge SQL with app: ended when calendar window passed
-- OR (started and past end). Never-started past scheduled window is also ended.
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
