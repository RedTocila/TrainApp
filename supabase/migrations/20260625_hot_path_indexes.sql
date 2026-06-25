-- Performance: indexes for common dashboard/admin query patterns.

create index if not exists idx_notifications_user_created_at_desc
  on public.notifications(user_id, created_at desc);

create index if not exists idx_meals_plan_order_index
  on public.meals(plan_id, order_index);

create index if not exists idx_workout_days_plan_day_index
  on public.workout_days(plan_id, day_index);

create index if not exists idx_client_habits_client_order
  on public.client_habits(client_id, order_index);

create index if not exists idx_client_day_tasks_client_date_order
  on public.client_day_tasks(client_id, date, order_index);

create index if not exists idx_workout_plans_personal_created_desc
  on public.workout_plans(created_by, is_personal, created_at desc);

create index if not exists idx_nutrition_plans_personal_created_desc
  on public.nutrition_plans(created_by, is_personal, created_at desc);

create index if not exists idx_scheduled_workouts_client_date
  on public.scheduled_workouts(client_id, scheduled_date);

create index if not exists idx_scheduled_nutrition_days_client_date
  on public.scheduled_nutrition_days(client_id, scheduled_date);

create index if not exists idx_workout_assignments_client_active
  on public.workout_assignments(client_id, active);

create index if not exists idx_nutrition_assignments_client_active
  on public.nutrition_assignments(client_id, active);
