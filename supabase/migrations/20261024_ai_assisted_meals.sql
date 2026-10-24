alter table public.daily_meal_logs
  add column if not exists ai_assisted boolean not null default false;

update public.daily_meal_logs
set ai_assisted = true
where photo_path is not null
  and ai_assisted = false;
