alter table public.profiles
  add column if not exists preferred_locale text not null default 'al'
  check (preferred_locale in ('al', 'en'));
