-- Personal nutrition macro targets on profile (used when no plan is assigned)

alter table public.profiles
  add column if not exists target_calories int not null default 2000
    check (target_calories >= 500 and target_calories <= 10000),
  add column if not exists target_protein int not null default 150
    check (target_protein >= 0 and target_protein <= 1000),
  add column if not exists target_carbs int not null default 200
    check (target_carbs >= 0 and target_carbs <= 2000),
  add column if not exists target_fat int not null default 65
    check (target_fat >= 0 and target_fat <= 500);
