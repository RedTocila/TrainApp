-- Card-backed AI Pro free trial: collect card first, charge after 7 days.
-- Stops auto-granting trial on signup.

alter table public.profiles
  add column if not exists pokpay_card_id text;

alter table public.profiles
  add column if not exists trial_converted_at timestamptz;

comment on column public.profiles.pokpay_card_id is
  'PokPay vaulted card id for charging AI Pro after free trial ends.';

comment on column public.profiles.trial_converted_at is
  'When a card-backed free trial was successfully charged into a paid subscription.';

alter table public.subscription_orders
  drop constraint if exists subscription_orders_order_kind_check;

alter table public.subscription_orders
  add constraint subscription_orders_order_kind_check
  check (
    order_kind in (
      'subscription',
      'custom_workout',
      'custom_nutrition',
      'flash_challenge_entry',
      'trial_conversion'
    )
  );

-- New signups start inactive — trial begins only after card is saved.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text := 'client';
  new_code text;
  attempts int := 0;
begin
  if lower(coalesce(new.email, '')) = lower(coalesce(current_setting('app.admin_email', true), '')) then
    user_role := 'admin';
  end if;

  if lower(coalesce(new.email, '')) = 'redtocila@gmail.com' then
    user_role := 'admin';
  end if;

  loop
    new_code := lower(substr(md5(random()::text || new.id::text || clock_timestamp()::text), 1, 8));
    attempts := attempts + 1;
    exit when not exists (
      select 1 from public.profiles where referral_code = new_code
    );
    if attempts > 20 then
      new_code := lower(substr(replace(new.id::text, '-', ''), 1, 12));
      exit;
    end if;
  end loop;

  insert into public.profiles (
    id,
    role,
    full_name,
    referral_code,
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
    new_code,
    null,
    'inactive',
    null,
    null,
    null
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    referral_code = coalesce(public.profiles.referral_code, excluded.referral_code);

  return new;
end;
$$;
