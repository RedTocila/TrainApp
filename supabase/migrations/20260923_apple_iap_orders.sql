-- Apple IAP fields on subscription_orders (PokPay remains for web)

alter table public.subscription_orders
  add column if not exists payment_provider text not null default 'pokpay'
    check (payment_provider in ('pokpay', 'apple'));

alter table public.subscription_orders
  add column if not exists apple_transaction_id text;

alter table public.subscription_orders
  add column if not exists apple_original_transaction_id text;

alter table public.profiles
  add column if not exists apple_original_transaction_id text;

create unique index if not exists subscription_orders_apple_transaction_id_uidx
  on public.subscription_orders (apple_transaction_id)
  where apple_transaction_id is not null;

create index if not exists subscription_orders_apple_original_transaction_id_idx
  on public.subscription_orders (apple_original_transaction_id)
  where apple_original_transaction_id is not null;

create index if not exists profiles_apple_original_transaction_id_idx
  on public.profiles (apple_original_transaction_id)
  where apple_original_transaction_id is not null;

comment on column public.subscription_orders.payment_provider is
  'pokpay = web/Android card checkout; apple = App Store IAP';

comment on column public.profiles.apple_original_transaction_id is
  'StoreKit originalTransactionId for the active Apple subscription (restore / renewals).';
