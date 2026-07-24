-- Referral credit system: invite codes, bankable credits, order discounts
-- Idempotent against leftover schema/policies from 20260626 / 20260627

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists referral_credit_balance_cents integer not null default 0
    check (referral_credit_balance_cents >= 0),
  add column if not exists referral_credits_earned_cents integer not null default 0
    check (referral_credits_earned_cents >= 0),
  add column if not exists referral_money_saved_cents integer not null default 0
    check (referral_money_saved_cents >= 0);

-- Backfill unique referral codes for existing users
update public.profiles
set referral_code = lower(substr(md5(id::text || random()::text), 1, 8))
where referral_code is null;

alter table public.profiles
  alter column referral_code set not null;

create unique index if not exists profiles_referral_code_idx
  on public.profiles (referral_code);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'qualified', 'revoked')),
  qualifying_order_id uuid references public.subscription_orders(id) on delete set null,
  credit_granted_cents integer not null default 0,
  credit_granted_at timestamptz,
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint referrals_referred_id_unique unique (referred_id),
  constraint referrals_no_self_referral check (referrer_id <> referred_id)
);

-- Upgrade leftover referrals table from older migrations
alter table public.referrals
  add column if not exists qualifying_order_id uuid references public.subscription_orders(id) on delete set null,
  add column if not exists credit_granted_cents integer not null default 0,
  add column if not exists credit_granted_at timestamptz,
  add column if not exists qualified_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.referrals
  drop constraint if exists referrals_status_check;

alter table public.referrals
  add constraint referrals_status_check
    check (status in ('pending', 'qualified', 'revoked'));

create index if not exists referrals_referrer_id_idx on public.referrals(referrer_id);
create index if not exists referrals_referred_id_idx on public.referrals(referred_id);
create index if not exists referrals_qualified_at_idx
  on public.referrals(qualified_at)
  where status = 'qualified';

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

alter table public.subscription_orders
  add column if not exists referral_credits_applied_cents integer not null default 0
    check (referral_credits_applied_cents >= 0),
  add column if not exists invitee_discount_cents integer not null default 0
    check (invitee_discount_cents >= 0);

alter table public.referrals enable row level security;
alter table public.referral_credit_transactions enable row level security;

-- Replace any policies left from the previous referral system
drop policy if exists "Users read referrals they made" on public.referrals;
drop policy if exists "Users read referrals about them" on public.referrals;
drop policy if exists "Admins read all referrals" on public.referrals;
drop policy if exists "Users read own referral credit transactions" on public.referral_credit_transactions;
drop policy if exists "Admins read all referral credit transactions" on public.referral_credit_transactions;

create policy "Users read referrals they made"
  on public.referrals for select
  using (auth.uid() = referrer_id);

create policy "Users read referrals about them"
  on public.referrals for select
  using (auth.uid() = referred_id);

create policy "Admins read all referrals"
  on public.referrals for select
  using (public.is_admin());

create policy "Users read own referral credit transactions"
  on public.referral_credit_transactions for select
  using (auth.uid() = user_id);

create policy "Admins read all referral credit transactions"
  on public.referral_credit_transactions for select
  using (public.is_admin());

-- Auto-create profile on signup with unique referral_code + AI Pro trial
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text := 'client';
  trial_ends timestamptz := now() + interval '7 days';
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
    case when user_role = 'client' then 'ai' else null end,
    case when user_role = 'client' then 'trialing' else 'inactive' end,
    null,
    case when user_role = 'client' then trial_ends else null end,
    case when user_role = 'client' then now() else null end
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    referral_code = coalesce(public.profiles.referral_code, excluded.referral_code);

  return new;
end;
$$;
