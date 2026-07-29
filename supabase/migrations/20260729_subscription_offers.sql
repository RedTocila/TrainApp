-- Admin-managed subscription/package discounts (e.g. "September 50% OFF").
create table if not exists public.subscription_offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_id text not null check (plan_id in ('ai', 'elite')),
  billing_interval text not null default 'all'
    check (billing_interval in ('monthly', 'annual', 'all')),
  percent_off integer not null check (percent_off >= 1 and percent_off <= 100),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  badge_text text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_offers_active_idx
  on public.subscription_offers (active);

create index if not exists subscription_offers_plan_interval_idx
  on public.subscription_offers (plan_id, billing_interval);

alter table public.subscription_offers enable row level security;

-- Admins can fully manage offers.
drop policy if exists "subscription_offers_admin_all" on public.subscription_offers;
create policy "subscription_offers_admin_all"
  on public.subscription_offers
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Public/pricing pages can read only active offers.
drop policy if exists "subscription_offers_public_read_active" on public.subscription_offers;
create policy "subscription_offers_public_read_active"
  on public.subscription_offers
  for select
  using (active = true or public.is_admin());
