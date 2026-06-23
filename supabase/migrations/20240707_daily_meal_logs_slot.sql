-- Track which planned meal slot a daily log belongs to

alter table public.daily_meal_logs
  add column if not exists slot text
  check (slot is null or slot in ('breakfast', 'snack_1', 'lunch', 'snack_2', 'dinner'));

create index if not exists idx_daily_meal_logs_client_date_slot
  on public.daily_meal_logs(client_id, date, slot);
