-- Age and gender for health intake + AI plan personalization

alter table public.profiles
  add column if not exists age integer,
  add column if not exists gender text;

alter table public.profiles
  drop constraint if exists profiles_age_range;

alter table public.profiles
  add constraint profiles_age_range
  check (age is null or (age >= 13 and age <= 120));

alter table public.profiles
  drop constraint if exists profiles_gender_values;

alter table public.profiles
  add constraint profiles_gender_values
  check (
    gender is null
    or gender in ('male', 'female', 'other', 'prefer_not_to_say')
  );
