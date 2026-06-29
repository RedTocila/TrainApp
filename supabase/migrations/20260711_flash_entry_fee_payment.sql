-- Flash challenge entry fee: first group reserves free, pay when full; later groups pay on join.

alter table public.challenge_participants
  add column if not exists entry_fee_paid_at timestamptz;

comment on column public.challenge_participants.entry_fee_paid_at is
  'When the participant paid the flash entry fee. Null = reserved seat (first group) or payment pending.';

alter table public.subscription_orders
  drop constraint if exists subscription_orders_order_kind_check;

alter table public.subscription_orders
  add constraint subscription_orders_order_kind_check
  check (
    order_kind in (
      'subscription',
      'custom_workout',
      'custom_nutrition',
      'flash_challenge_entry'
    )
  );
