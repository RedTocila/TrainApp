-- 7-day free trial of AI Pro (second package) for new clients.
-- Does NOT unlock Elite (live classes / challenges).

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (
    subscription_status in ('inactive', 'active', 'past_due', 'canceled', 'trialing')
  );

alter table public.profiles
  add column if not exists trial_started_at timestamptz;

comment on column public.profiles.trial_started_at is
  'When the AI Pro free trial started. Set once; never re-granted.';

-- Start AI Pro trial on signup for non-admin clients
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text := 'client';
  trial_ends timestamptz := now() + interval '7 days';
begin
  if lower(coalesce(new.email, '')) = lower(coalesce(current_setting('app.admin_email', true), '')) then
    user_role := 'admin';
  end if;

  -- Hardcoded admin fallback used historically in complete_setup
  if lower(coalesce(new.email, '')) = 'redtocila@gmail.com' then
    user_role := 'admin';
  end if;

  insert into public.profiles (
    id,
    role,
    full_name,
    subscription_plan,
    subscription_status,
    subscription_interval,
    subscription_expires_at,
    trial_started_at
  )
  values (
    new.id,
    user_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when user_role = 'client' then 'ai' else null end,
    case when user_role = 'client' then 'trialing' else 'inactive' end,
    null,
    case when user_role = 'client' then trial_ends else null end,
    case when user_role = 'client' then now() else null end
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return new;
end;
$$;
