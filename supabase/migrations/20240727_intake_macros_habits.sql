-- Track habit suggestions the client dismissed from their health-based recommendations

alter table public.profiles
  add column if not exists dismissed_habit_suggestions text[] not null default '{}';
