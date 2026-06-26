-- Credit-based referral program (replaces milestone subscription grants)

alter table public.profiles
  add column if not exists referral_credit_balance_cents integer not null default 0
    check (referral_credit_balance_cents >= 0),
  add column if not exists referral_credits_earned_cents integer not null default 0
    check (referral_credits_earned_cents >= 0),
  add column if not exists referral_money_saved_cents integer not null default 0
    check (referral_money_saved_cents >= 0),
  add column if not exists ambassador_tier text
    check (ambassador_tier in ('bronze', 'silver', 'gold', 'elite')),
  add column if not exists signup_device_hash text;

alter table public.referrals
  add column if not exists qualifying_order_id uuid references public.subscription_orders(id) on delete set null,
  add column if not exists payment_fingerprint text,
  add column if not exists credit_granted_cents integer not null default 0,
  add column if not exists credit_granted_at timestamptz,
  add column if not exists revoked_at timestamptz;

alter table public.referrals
  drop constraint if exists referrals_status_check;

alter table public.referrals
  add constraint referrals_status_check
    check (status in ('pending', 'qualified', 'revoked'));

alter table public.subscription_orders
  add column if not exists referral_credits_applied_cents integer not null default 0
    check (referral_credits_applied_cents >= 0);

create table if not exists public.referral_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  referral_id uuid references public.referrals(id) on delete set null,
  order_id uuid references public.subscription_orders(id) on delete set null,
  amount_cents integer not null,
  type text not null check (type in ('earn', 'spend', 'revoke', 'bonus')),
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists referral_credit_transactions_user_id_idx
  on public.referral_credit_transactions(user_id);

create index if not exists referrals_payment_fingerprint_idx
  on public.referrals(payment_fingerprint)
  where payment_fingerprint is not null;

create index if not exists referrals_qualified_at_idx
  on public.referrals(qualified_at)
  where status = 'qualified';

alter table public.referral_credit_transactions enable row level security;

create policy "Users read own referral credit transactions"
  on public.referral_credit_transactions for select
  using (auth.uid() = user_id);

create policy "Admins read all referral credit transactions"
  on public.referral_credit_transactions for select
  using (public.is_admin());

-- Backfill €5 credits for referrals qualified before the credit system
update public.profiles p
set
  referral_credit_balance_cents = referral_credit_balance_cents + credited.total_cents,
  referral_credits_earned_cents = referral_credits_earned_cents + credited.total_cents
from (
  select referrer_id, count(*)::int * 500 as total_cents
  from public.referrals
  where status = 'qualified' and credit_granted_cents = 0
  group by referrer_id
) credited
where p.id = credited.referrer_id;

update public.referrals
set
  credit_granted_cents = 500,
  credit_granted_at = coalesce(qualified_at, now())
where status = 'qualified' and credit_granted_cents = 0;

insert into public.referral_credit_transactions (user_id, referral_id, amount_cents, type, description)
select
  r.referrer_id,
  r.id,
  500,
  'earn',
  'Backfilled referral credit for a successful paying referral (€5)'
from public.referrals r
where r.status = 'qualified'
  and r.credit_granted_at = coalesce(r.qualified_at, now())
  and not exists (
    select 1 from public.referral_credit_transactions t
    where t.referral_id = r.id and t.type = 'earn'
  );

-- Backfill ambassador tiers from founder badge / qualified counts
update public.profiles p
set ambassador_tier = case
  when coalesce((
    select count(*)::int from public.referrals r
    where r.referrer_id = p.id and r.status = 'qualified'
  ), 0) >= 75 then 'elite'
  when coalesce((
    select count(*)::int from public.referrals r
    where r.referrer_id = p.id and r.status = 'qualified'
  ), 0) >= 30 then 'gold'
  when coalesce((
    select count(*)::int from public.referrals r
    where r.referrer_id = p.id and r.status = 'qualified'
  ), 0) >= 15 then 'silver'
  when coalesce((
    select count(*)::int from public.referrals r
    where r.referrer_id = p.id and r.status = 'qualified'
  ), 0) >= 5 then 'bronze'
  when p.founder_badge then 'elite'
  else p.ambassador_tier
end
where p.ambassador_tier is null
  and (
    p.founder_badge
    or exists (
      select 1 from public.referrals r
      where r.referrer_id = p.id and r.status = 'qualified'
    )
  );
