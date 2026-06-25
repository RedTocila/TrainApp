-- Fix RLS for subscription_orders (clients need to create/update their own orders)

alter table public.subscription_orders enable row level security;

drop policy if exists "Users read own subscription orders" on public.subscription_orders;
create policy "Users read own subscription orders"
  on public.subscription_orders for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own subscription orders" on public.subscription_orders;
create policy "Users insert own subscription orders"
  on public.subscription_orders for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own subscription orders" on public.subscription_orders;
create policy "Users update own subscription orders"
  on public.subscription_orders for update
  using (auth.uid() = user_id);

-- Keep admin visibility
drop policy if exists "Admins read all subscription orders" on public.subscription_orders;
create policy "Admins read all subscription orders"
  on public.subscription_orders for select
  using (public.is_admin());

