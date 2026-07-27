-- Defer auth.users creation until package purchase / free trial completes.

create table if not exists public.pending_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_encrypted text not null,
  full_name text not null,
  phone text,
  intake_json text,
  referral_code text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  consumed_at timestamptz,
  consumed_user_id uuid references auth.users(id) on delete set null
);

create unique index if not exists pending_signups_active_email_idx
  on public.pending_signups (lower(email))
  where consumed_at is null;

create index if not exists pending_signups_expires_at_idx
  on public.pending_signups (expires_at)
  where consumed_at is null;

alter table public.pending_signups enable row level security;

-- Service role only — no client policies.

alter table public.subscription_orders
  alter column user_id drop not null;

alter table public.subscription_orders
  add column if not exists pending_signup_id uuid references public.pending_signups(id) on delete set null;

create index if not exists subscription_orders_pending_signup_id_idx
  on public.subscription_orders (pending_signup_id)
  where pending_signup_id is not null;

alter table public.subscription_orders
  drop constraint if exists subscription_orders_user_or_pending_check;

alter table public.subscription_orders
  add constraint subscription_orders_user_or_pending_check
  check (user_id is not null or pending_signup_id is not null);
