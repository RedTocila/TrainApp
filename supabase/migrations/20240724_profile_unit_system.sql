-- Unit system preference (EU metric vs US/Imperial)

alter table public.profiles
  add column if not exists unit_system text not null default 'metric';

alter table public.profiles
  drop constraint if exists profiles_unit_system_values;

alter table public.profiles
  add constraint profiles_unit_system_values
  check (unit_system in ('metric', 'imperial'));

