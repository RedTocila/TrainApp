-- Custom trainer plans, payment orders, trainer labels
-- Includes subscription_orders setup from 20240709 so this file can run standalone in the SQL editor.

-- === From 20240709_subscriptions.sql ===
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

drop policy if exists "Users read own subscription orders" on public.subscription_orders;
create policy "Users read own subscription orders"
  on public.subscription_orders for select
  using (auth.uid() = user_id);

drop policy if exists "Admins read all subscription orders" on public.subscription_orders;
create policy "Admins read all subscription orders"
  on public.subscription_orders for select
  using (public.is_admin());

-- === Custom trainer plan extensions ===
alter table public.subscription_orders
  add column if not exists order_kind text not null default 'subscription'
    check (order_kind in ('subscription', 'custom_workout', 'custom_nutrition')),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.plan_requests
  add column if not exists payment_order_id uuid references public.subscription_orders(id),
  add column if not exists amount_cents integer,
  add column if not exists preferences text,
  add column if not exists delivered_workout_plan_id uuid references public.workout_plans(id),
  add column if not exists delivered_nutrition_plan_id uuid references public.nutrition_plans(id),
  add column if not exists rejected_reason text,
  add column if not exists approved_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists implemented_at timestamptz;

alter table public.workout_plans
  add column if not exists trainer_label text;

alter table public.nutrition_plans
  add column if not exists trainer_label text;

alter table public.plan_requests drop constraint if exists plan_requests_status_check;
alter table public.plan_requests
  add constraint plan_requests_status_check check (
    status in (
      'pending',
      'awaiting_approval',
      'rejected',
      'in_progress',
      'delivered',
      'implemented',
      'completed'
    )
  );
