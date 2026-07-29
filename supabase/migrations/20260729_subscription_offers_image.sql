alter table if exists public.subscription_offers
  add column if not exists image_url text;
