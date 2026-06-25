-- =============================================================================
-- RUTINA — Complete Supabase Setup
-- Project: hpujlewxfdgkjhavqdyk
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- =============================================================================
-- TABLES
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('admin', 'client')),
  full_name text not null default '',
  avatar_url text,
  goal text,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('workout', 'diet')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_folders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references public.profiles(id),
  is_personal boolean not null default false,
  folder_id uuid references public.workout_folders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  day_index int not null,
  title text not null
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.workout_days(id) on delete cascade,
  name text not null,
  sets int not null default 3,
  reps text not null default '10',
  rest_seconds int not null default 60,
  notes text,
  image_url text,
  video_url text,
  order_index int not null default 0
);

create table if not exists public.workout_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  start_date date not null default current_date,
  active boolean not null default true
);

create table if not exists public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  day_id uuid not null references public.workout_days(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, scheduled_date)
);

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  target_calories int not null default 2000,
  target_protein int not null default 150,
  target_carbs int not null default 200,
  target_fat int not null default 65,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  description text,
  calories int,
  protein int,
  carbs int,
  fat int,
  foods jsonb not null default '[]',
  slot text check (slot in ('breakfast', 'snack_1', 'lunch', 'snack_2', 'dinner')),
  order_index int not null default 0
);

create table if not exists public.scheduled_nutrition_days (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, scheduled_date)
);

create table if not exists public.nutrition_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  start_date date not null default current_date,
  active boolean not null default true
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  water_ml int not null default 0,
  calories int not null default 0,
  protein int not null default 0,
  carbs int not null default 0,
  fat int not null default 0,
  unique (client_id, date)
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text not null default '',
  cover_image text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- Add image_url to exercises if upgrading from v1
alter table public.exercises add column if not exists image_url text;
alter table public.exercises add column if not exists video_url text;
alter table public.workout_plans add column if not exists is_personal boolean not null default false;
alter table public.workout_plans add column if not exists folder_id uuid references public.workout_folders(id) on delete set null;

-- =============================================================================
-- INDEXES
-- =============================================================================

create index if not exists idx_plan_requests_client on public.plan_requests(client_id);
create index if not exists idx_plan_requests_status on public.plan_requests(status);
create index if not exists idx_notifications_user on public.notifications(user_id, read);
create index if not exists idx_notifications_created on public.notifications(created_at desc);
create index if not exists idx_daily_logs_client_date on public.daily_logs(client_id, date);
create index if not exists idx_workout_days_plan on public.workout_days(plan_id, day_index);
create index if not exists idx_exercises_day on public.exercises(day_id, order_index);
create index if not exists idx_meals_plan on public.meals(plan_id, order_index);
create index if not exists idx_blog_posts_published on public.blog_posts(published, created_at desc);
create index if not exists idx_workout_assignments_client on public.workout_assignments(client_id) where active = true;
create index if not exists idx_nutrition_assignments_client on public.nutrition_assignments(client_id) where active = true;
create index if not exists idx_scheduled_workouts_client_date on public.scheduled_workouts(client_id, scheduled_date);
create index if not exists idx_scheduled_nutrition_client_date on public.scheduled_nutrition_days(client_id, scheduled_date);
create index if not exists idx_meals_plan_slot on public.meals(plan_id, slot, order_index);
create index if not exists idx_workout_folders_client on public.workout_folders(client_id, created_at);
create index if not exists idx_workout_plans_folder on public.workout_plans(folder_id) where folder_id is not null;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text := 'client';
begin
  if lower(new.email) = lower('redtocila@gmail.com') then
    user_role := 'admin';
  end if;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    user_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set
    full_name = excluded.full_name;

  return new;
end;
$$;

create or replace function public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, type, title, body, metadata)
  values (p_user_id, p_type, p_title, p_body, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.notify_all_admins(
  p_type text,
  p_title text,
  p_body text,
  p_metadata jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, metadata)
  select id, p_type, p_title, p_body, p_metadata
  from public.profiles
  where role = 'admin';
end;
$$;

grant execute on function public.notify_user(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.notify_all_admins(text, text, text, jsonb) to authenticated;

-- =============================================================================
-- AUTH TRIGGER
-- =============================================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY — public tables
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.plan_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_folders enable row level security;
alter table public.workout_days enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_assignments enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.meals enable row level security;
alter table public.nutrition_assignments enable row level security;
alter table public.daily_logs enable row level security;
alter table public.blog_posts enable row level security;
alter table public.scheduled_workouts enable row level security;
alter table public.scheduled_nutrition_days enable row level security;

-- Drop existing policies (idempotent re-run)
do $$ declare r record; begin
  for r in (
    select policyname, tablename from pg_policies where schemaname = 'public'
  ) loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Profiles
create policy "profiles_select" on public.profiles for select
  using (auth.uid() = id or public.is_admin());
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles for all
  using (public.is_admin());

-- Plan requests
create policy "plan_requests_insert" on public.plan_requests for insert
  with check (auth.uid() = client_id);
create policy "plan_requests_select" on public.plan_requests for select
  using (auth.uid() = client_id or public.is_admin());
create policy "plan_requests_admin" on public.plan_requests for all
  using (public.is_admin());

-- Notifications
create policy "notifications_select" on public.notifications for select
  using (auth.uid() = user_id);
create policy "notifications_update" on public.notifications for update
  using (auth.uid() = user_id);

-- Workout plans
create policy "workout_plans_admin" on public.workout_plans for all
  using (public.is_admin());
create policy "workout_plans_client_read" on public.workout_plans for select
  using (exists (
    select 1 from public.workout_assignments wa
    where wa.plan_id = workout_plans.id and wa.client_id = auth.uid() and wa.active = true
  ) or (is_personal = true and created_by = auth.uid()));

create policy "workout_plans_personal_own" on public.workout_plans for all
  using (is_personal = true and created_by = auth.uid())
  with check (is_personal = true and created_by = auth.uid());

create policy "workout_folders_own" on public.workout_folders for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "workout_days_admin" on public.workout_days for all using (public.is_admin());
create policy "workout_days_client_read" on public.workout_days for select using (exists (
  select 1 from public.workout_assignments wa
  where wa.plan_id = workout_days.plan_id and wa.client_id = auth.uid() and wa.active = true
) or exists (
  select 1 from public.workout_plans wp
  where wp.id = workout_days.plan_id and wp.is_personal = true and wp.created_by = auth.uid()
));
create policy "workout_days_personal" on public.workout_days for all
  using (exists (
    select 1 from public.workout_plans wp
    where wp.id = workout_days.plan_id and wp.is_personal = true and wp.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_plans wp
    where wp.id = workout_days.plan_id and wp.is_personal = true and wp.created_by = auth.uid()
  ));

create policy "exercises_admin" on public.exercises for all using (public.is_admin());
create policy "exercises_client_read" on public.exercises for select using (exists (
  select 1 from public.workout_days wd
  join public.workout_assignments wa on wa.plan_id = wd.plan_id
  where wd.id = exercises.day_id and wa.client_id = auth.uid() and wa.active = true
) or exists (
  select 1 from public.workout_days wd
  join public.workout_plans wp on wp.id = wd.plan_id
  where wd.id = exercises.day_id and wp.is_personal = true and wp.created_by = auth.uid()
));
create policy "exercises_personal" on public.exercises for all
  using (exists (
    select 1 from public.workout_days wd
    join public.workout_plans wp on wp.id = wd.plan_id
    where wd.id = exercises.day_id and wp.is_personal = true and wp.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_days wd
    join public.workout_plans wp on wp.id = wd.plan_id
    where wd.id = exercises.day_id and wp.is_personal = true and wp.created_by = auth.uid()
  ));

create policy "workout_assignments_admin" on public.workout_assignments for all using (public.is_admin());
create policy "workout_assignments_client_read" on public.workout_assignments for select
  using (auth.uid() = client_id);
create policy "workout_assignments_client_own" on public.workout_assignments for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.workout_plans wp
      where wp.id = plan_id and wp.is_personal = true and wp.created_by = auth.uid()
    )
  );
create policy "workout_assignments_client_update_own" on public.workout_assignments for update
  using (auth.uid() = client_id);

create policy "scheduled_workouts_own" on public.scheduled_workouts for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "scheduled_nutrition_own" on public.scheduled_nutrition_days for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

-- Nutrition
create policy "nutrition_plans_admin" on public.nutrition_plans for all using (public.is_admin());
create policy "nutrition_plans_client_read" on public.nutrition_plans for select using (exists (
  select 1 from public.nutrition_assignments na
  where na.plan_id = nutrition_plans.id and na.client_id = auth.uid() and na.active = true
));

create policy "meals_admin" on public.meals for all using (public.is_admin());
create policy "meals_client_read" on public.meals for select using (exists (
  select 1 from public.nutrition_assignments na
  where na.plan_id = meals.plan_id and na.client_id = auth.uid() and na.active = true
));

create policy "nutrition_assignments_admin" on public.nutrition_assignments for all using (public.is_admin());
create policy "nutrition_assignments_client_read" on public.nutrition_assignments for select
  using (auth.uid() = client_id);

-- Daily logs
create policy "daily_logs_own" on public.daily_logs for all using (auth.uid() = client_id);
create policy "daily_logs_admin_read" on public.daily_logs for select using (public.is_admin());

-- Blog
create policy "blog_public_read" on public.blog_posts for select
  using (published = true or public.is_admin());
create policy "blog_admin" on public.blog_posts for all using (public.is_admin());

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('blog-images', 'blog-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('exercise-media', 'exercise-media', true, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =============================================================================
-- STORAGE RLS
-- =============================================================================

drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_upload_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;
drop policy if exists "blog_images_public_read" on storage.objects;
drop policy if exists "blog_images_admin_write" on storage.objects;
drop policy if exists "exercise_media_public_read" on storage.objects;
drop policy if exists "exercise_media_admin_write" on storage.objects;

-- Avatars: public read, users upload to {user_id}/filename
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_upload_own" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update_own" on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_delete_own" on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- Blog images: public read, admin write
create policy "blog_images_public_read" on storage.objects for select
  using (bucket_id = 'blog-images');

create policy "blog_images_admin_write" on storage.objects for all
  using (bucket_id = 'blog-images' and public.is_admin())
  with check (bucket_id = 'blog-images' and public.is_admin());

-- Exercise media: public read, admin write
create policy "exercise_media_public_read" on storage.objects for select
  using (bucket_id = 'exercise-media');

create policy "exercise_media_admin_write" on storage.objects for all
  using (bucket_id = 'exercise-media' and public.is_admin())
  with check (bucket_id = 'exercise-media' and public.is_admin());

-- =============================================================================
-- REALTIME
-- =============================================================================

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

-- =============================================================================
-- SEED ADMIN PROFILE (if auth user already exists)
-- =============================================================================

insert into public.profiles (id, role, full_name)
select id, 'admin', coalesce(raw_user_meta_data->>'full_name', 'RED Admin')
from auth.users
where lower(email) = lower('redtocila@gmail.com')
on conflict (id) do update set role = 'admin';

-- =============================================================================
-- DONE
-- =============================================================================

select 'RUTINA Supabase setup complete' as status;
