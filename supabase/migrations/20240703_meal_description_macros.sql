-- Per-meal description and macros

alter table public.meals
  add column if not exists description text,
  add column if not exists calories int,
  add column if not exists protein int,
  add column if not exists carbs int,
  add column if not exists fat int;
