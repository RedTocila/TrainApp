-- Per-slot meal scheduling (breakfast, lunch, etc. on specific dates)

create table if not exists public.scheduled_meal_slots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  slot text not null check (slot in ('breakfast', 'snack_1', 'lunch', 'snack_2', 'dinner')),
  scheduled_date date not null,
  created_at timestamptz not null default now(),
  unique (client_id, scheduled_date, slot)
);

create index if not exists idx_scheduled_meal_slots_client_date
  on public.scheduled_meal_slots(client_id, scheduled_date);

create index if not exists idx_scheduled_meal_slots_plan
  on public.scheduled_meal_slots(plan_id);

alter table public.scheduled_meal_slots enable row level security;

drop policy if exists "scheduled_meal_slots_own" on public.scheduled_meal_slots;
create policy "scheduled_meal_slots_own" on public.scheduled_meal_slots
  for all using (client_id = auth.uid());
