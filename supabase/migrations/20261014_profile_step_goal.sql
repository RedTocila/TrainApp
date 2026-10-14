alter table public.profiles
  add column if not exists step_goal int not null default 10000
    check (step_goal >= 1000 and step_goal <= 100000);
