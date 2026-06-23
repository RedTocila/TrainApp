-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('admin', 'client')),
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Plan requests
create table if not exists public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('workout', 'diet')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  notes text,
  created_at timestamptz not null default now()
);

-- Notifications
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

-- Workout plans
create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references public.profiles(id),
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
  order_index int not null default 0
);

create table if not exists public.workout_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  start_date date not null default current_date,
  active boolean not null default true
);

-- Nutrition plans
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
  foods jsonb not null default '[]',
  order_index int not null default 0
);

create table if not exists public.nutrition_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  start_date date not null default current_date,
  active boolean not null default true
);

-- Daily logs
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

-- Blog
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text not null default '',
  cover_image text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_plan_requests_client on public.plan_requests(client_id);
create index if not exists idx_plan_requests_status on public.plan_requests(status);
create index if not exists idx_notifications_user on public.notifications(user_id, read);
create index if not exists idx_daily_logs_client_date on public.daily_logs(client_id, date);

-- Helper: is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role text := 'client';
begin
  if new.email = current_setting('app.admin_email', true) then
    user_role := 'admin';
  end if;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    user_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.plan_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_days enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_assignments enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.meals enable row level security;
alter table public.nutrition_assignments enable row level security;
alter table public.daily_logs enable row level security;
alter table public.blog_posts enable row level security;

-- Profiles policies
create policy "Users read own profile" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Admin read all profiles" on public.profiles for select using (public.is_admin());

-- Plan requests
create policy "Clients create requests" on public.plan_requests for insert with check (auth.uid() = client_id);
create policy "Clients read own requests" on public.plan_requests for select using (auth.uid() = client_id or public.is_admin());
create policy "Admin manage requests" on public.plan_requests for all using (public.is_admin());

-- Notifications
create policy "Users read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users update own notifications" on public.notifications for update using (auth.uid() = user_id);
create policy "System insert notifications" on public.notifications for insert with check (public.is_admin() or auth.uid() = user_id);

-- Workout plans (admin write, assigned clients read)
create policy "Admin manage workout plans" on public.workout_plans for all using (public.is_admin());
create policy "Clients read assigned workout plans" on public.workout_plans for select using (
  exists (
    select 1 from public.workout_assignments wa
    where wa.plan_id = workout_plans.id and wa.client_id = auth.uid() and wa.active = true
  )
);

create policy "Admin manage workout days" on public.workout_days for all using (public.is_admin());
create policy "Clients read workout days" on public.workout_days for select using (
  exists (
    select 1 from public.workout_assignments wa
    where wa.plan_id = workout_days.plan_id and wa.client_id = auth.uid() and wa.active = true
  )
);

create policy "Admin manage exercises" on public.exercises for all using (public.is_admin());
create policy "Clients read exercises" on public.exercises for select using (
  exists (
    select 1 from public.workout_days wd
    join public.workout_assignments wa on wa.plan_id = wd.plan_id
    where wd.id = exercises.day_id and wa.client_id = auth.uid() and wa.active = true
  )
);

create policy "Admin manage workout assignments" on public.workout_assignments for all using (public.is_admin());
create policy "Clients read own workout assignments" on public.workout_assignments for select using (auth.uid() = client_id);

-- Nutrition
create policy "Admin manage nutrition plans" on public.nutrition_plans for all using (public.is_admin());
create policy "Clients read assigned nutrition plans" on public.nutrition_plans for select using (
  exists (
    select 1 from public.nutrition_assignments na
    where na.plan_id = nutrition_plans.id and na.client_id = auth.uid() and na.active = true
  )
);

create policy "Admin manage meals" on public.meals for all using (public.is_admin());
create policy "Clients read meals" on public.meals for select using (
  exists (
    select 1 from public.nutrition_assignments na
    where na.plan_id = meals.plan_id and na.client_id = auth.uid() and na.active = true
  )
);

create policy "Admin manage nutrition assignments" on public.nutrition_assignments for all using (public.is_admin());
create policy "Clients read own nutrition assignments" on public.nutrition_assignments for select using (auth.uid() = client_id);

-- Daily logs
create policy "Clients manage own logs" on public.daily_logs for all using (auth.uid() = client_id);
create policy "Admin read all logs" on public.daily_logs for select using (public.is_admin());

-- Blog
create policy "Anyone read published posts" on public.blog_posts for select using (published = true or public.is_admin());
create policy "Admin manage blog" on public.blog_posts for all using (public.is_admin());

-- Realtime for notifications
alter publication supabase_realtime add table public.notifications;
