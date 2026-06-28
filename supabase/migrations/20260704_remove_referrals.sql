-- Remove referral program tables and profile columns

drop table if exists public.referral_credit_transactions;
drop table if exists public.referral_reward_claims;
drop table if exists public.referrals;

alter table public.subscription_orders
  drop column if exists referral_credits_applied_cents;

alter table public.profiles
  drop column if exists referral_code,
  drop column if exists referred_by,
  drop column if exists founder_badge,
  drop column if exists referral_credit_balance_cents,
  drop column if exists referral_credits_earned_cents,
  drop column if exists referral_money_saved_cents,
  drop column if exists ambassador_tier,
  drop column if exists signup_device_hash;

drop index if exists profiles_referral_code_idx;
drop index if exists referrals_referrer_id_idx;
drop index if exists referrals_referred_id_idx;
drop index if exists referrals_payment_fingerprint_idx;
drop index if exists referrals_qualified_at_idx;
drop index if exists referral_credit_transactions_user_id_idx;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role text := 'client';
begin
  if new.email = current_setting('app.admin_email', true) then
    user_role := 'admin';
  end if;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    user_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;
