-- Subscription plans on profiles + order tracking for PokPay

alter table public.profiles
  add column if not exists subscription_plan text check (subscription_plan in ('core', 'ai')),
  add column if not exists subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'active', 'past_due', 'canceled')),
  add column if not exists subscription_interval text
    check (subscription_interval in ('monthly', 'annual')),
  add column if not exists subscription_expires_at timestamptz;

create table if not exists public.subscription_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('core', 'ai')),
  billing_interval text not null check (billing_interval in ('monthly', 'annual')),
  amount_cents integer not null,
  currency_code text not null default 'EUR',
  pokpay_order_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists subscription_orders_user_id_idx on public.subscription_orders(user_id);
create index if not exists subscription_orders_pokpay_order_id_idx on public.subscription_orders(pokpay_order_id);

alter table public.subscription_orders enable row level security;

create policy "Users read own subscription orders"
  on public.subscription_orders for select
  using (auth.uid() = user_id);

create policy "Admins read all subscription orders"
  on public.subscription_orders for select
  using (public.is_admin());
