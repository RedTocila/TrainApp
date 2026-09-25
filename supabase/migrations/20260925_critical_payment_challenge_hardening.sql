-- Critical hardening: Elite-only challenge registration RLS,
-- idempotent referral credit spends, atomic credit reserve/release.

-- 1) Challenge participant inserts must be Elite (or admin), matching server actions.
drop policy if exists "Clients register for published challenges" on public.challenge_participants;
drop policy if exists "Elite clients register for published challenges" on public.challenge_participants;

create policy "Elite clients register for published challenges"
  on public.challenge_participants for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
    )
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or (
            p.subscription_plan = 'elite'
            and p.subscription_status in ('active', 'canceled')
            and p.subscription_expires_at is not null
            and p.subscription_expires_at > now()
          )
        )
    )
  );

-- 2) Track whether reserved credits were booked into money_saved at completion.
alter table public.subscription_orders
  add column if not exists referral_credits_settled_at timestamptz;

-- 3) One spend (and one earn) ledger row per order — makes settlement idempotent.
create unique index if not exists referral_credit_transactions_order_spend_uidx
  on public.referral_credit_transactions (order_id)
  where order_id is not null and type = 'spend';

create unique index if not exists referral_credit_transactions_order_earn_uidx
  on public.referral_credit_transactions (order_id)
  where order_id is not null and type = 'earn';

-- 4) Atomically reserve credits when a pending order is created.
create or replace function public.reserve_referral_credits(
  p_user_id uuid,
  p_order_id uuid,
  p_amount_cents integer,
  p_description text default 'Reserved for checkout'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    return 0;
  end if;

  select referral_credit_balance_cents
    into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_balance < p_amount_cents then
    raise exception 'Insufficient referral credits';
  end if;

  update public.profiles
  set referral_credit_balance_cents = v_balance - p_amount_cents
  where id = p_user_id;

  insert into public.referral_credit_transactions (
    user_id, order_id, amount_cents, type, description
  ) values (
    p_user_id, p_order_id, -p_amount_cents, 'spend', p_description
  );

  return p_amount_cents;
end;
$$;

-- 5) Release reserved credits if checkout fails / order is abandoned.
create or replace function public.release_referral_credits(
  p_user_id uuid,
  p_order_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spend integer;
begin
  delete from public.referral_credit_transactions
  where order_id = p_order_id
    and user_id = p_user_id
    and type = 'spend'
  returning abs(amount_cents) into v_spend;

  if v_spend is null or v_spend <= 0 then
    return 0;
  end if;

  update public.profiles
  set referral_credit_balance_cents = referral_credit_balance_cents + v_spend
  where id = p_user_id;

  return v_spend;
end;
$$;

-- 6) Book money_saved once after successful payment (credits already reserved).
create or replace function public.finalize_referral_credit_spend(
  p_user_id uuid,
  p_order_id uuid,
  p_description text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spend integer;
  v_settled timestamptz;
begin
  select referral_credits_settled_at
    into v_settled
  from public.subscription_orders
  where id = p_order_id
  for update;

  if v_settled is not null then
    return 0;
  end if;

  select abs(amount_cents)
    into v_spend
  from public.referral_credit_transactions
  where order_id = p_order_id
    and user_id = p_user_id
    and type = 'spend'
  limit 1;

  if v_spend is null then
    v_spend := 0;
  end if;

  if p_description is not null and v_spend > 0 then
    update public.referral_credit_transactions
    set description = p_description
    where order_id = p_order_id
      and user_id = p_user_id
      and type = 'spend';
  end if;

  if v_spend > 0 then
    update public.profiles
    set referral_money_saved_cents = coalesce(referral_money_saved_cents, 0) + v_spend
    where id = p_user_id;
  end if;

  update public.subscription_orders
  set referral_credits_settled_at = now()
  where id = p_order_id;

  return v_spend;
end;
$$;

revoke all on function public.reserve_referral_credits(uuid, uuid, integer, text) from public;
revoke all on function public.release_referral_credits(uuid, uuid) from public;
revoke all on function public.finalize_referral_credit_spend(uuid, uuid, text) from public;
grant execute on function public.reserve_referral_credits(uuid, uuid, integer, text) to service_role;
grant execute on function public.release_referral_credits(uuid, uuid) to service_role;
grant execute on function public.finalize_referral_credit_spend(uuid, uuid, text) to service_role;
