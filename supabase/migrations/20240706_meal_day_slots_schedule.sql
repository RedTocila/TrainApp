-- Fixed meal slots per day menu + calendar scheduling

alter table public.meals
  add column if not exists slot text check (slot in ('breakfast', 'snack_1', 'lunch', 'snack_2', 'dinner'));

create index if not exists idx_meals_plan_slot
  on public.meals(plan_id, slot, order_index);

create table if not exists public.scheduled_nutrition_days (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, scheduled_date)
);

create index if not exists idx_scheduled_nutrition_client_date
  on public.scheduled_nutrition_days(client_id, scheduled_date);

alter table public.scheduled_nutrition_days enable row level security;

create policy "scheduled_nutrition_own" on public.scheduled_nutrition_days
  for all using (client_id = auth.uid());

-- Backfill slot from meal_type for existing rows
update public.meals m
set slot = case
  when meal_type = 'breakfast' then 'breakfast'
  when meal_type = 'lunch' then 'lunch'
  when meal_type = 'dinner' then 'dinner'
  when meal_type = 'snack' and (
    select count(*) from public.meals m2
    where m2.plan_id = m.plan_id and m2.meal_type = 'snack' and m2.order_index < m.order_index
  ) = 0 then 'snack_1'
  when meal_type = 'snack' then 'snack_2'
  else null
end
where slot is null;
