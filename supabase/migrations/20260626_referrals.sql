-- Referral program: codes, tracking, milestone rewards

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists founder_badge boolean not null default false;

-- Backfill unique referral codes for existing users
update public.profiles
set referral_code = lower(substr(md5(id::text || random()::text), 1, 8))
where referral_code is null;

alter table public.profiles
  alter column referral_code set not null;

create unique index if not exists profiles_referral_code_idx
  on public.profiles (referral_code);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'qualified')),
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint referrals_referred_id_unique unique (referred_id),
  constraint referrals_no_self_referral check (referrer_id <> referred_id)
);

create index if not exists referrals_referrer_id_idx on public.referrals(referrer_id);
create index if not exists referrals_referred_id_idx on public.referrals(referred_id);

create table if not exists public.referral_reward_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  milestone int not null,
  reward_label text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, milestone)
);

alter table public.referrals enable row level security;
alter table public.referral_reward_claims enable row level security;

create policy "Users read referrals they made"
  on public.referrals for select
  using (auth.uid() = referrer_id);

create policy "Users read own referral reward claims"
  on public.referral_reward_claims for select
  using (auth.uid() = user_id);

create policy "Admins read all referrals"
  on public.referrals for select
  using (public.is_admin());

create policy "Admins read all referral reward claims"
  on public.referral_reward_claims for select
  using (public.is_admin());

-- Auto-create profile on signup (add referral_code generation)
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role text := 'client';
  new_code text;
  attempts int := 0;
begin
  if new.email = current_setting('app.admin_email', true) then
    user_role := 'admin';
  end if;

  loop
    new_code := lower(substr(md5(random()::text || new.id::text || clock_timestamp()::text), 1, 8));
    attempts := attempts + 1;
    exit when not exists (
      select 1 from public.profiles where referral_code = new_code
    );
    if attempts > 20 then
      new_code := lower(replace(new.id::text, '-', ''));
      exit;
    end if;
  end loop;

  insert into public.profiles (id, role, full_name, referral_code)
  values (
    new.id,
    user_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new_code
  );
  return new;
end;
$$ language plpgsql security definer;
