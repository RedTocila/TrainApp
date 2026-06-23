-- Personal nutrition plans with folder organization (mirrors workout folders)

alter table public.nutrition_plans
  add column if not exists is_personal boolean not null default false;

create table if not exists public.nutrition_folders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_nutrition_folders_client
  on public.nutrition_folders(client_id, created_at);

alter table public.nutrition_plans
  add column if not exists folder_id uuid references public.nutrition_folders(id) on delete set null;

create index if not exists idx_nutrition_plans_folder
  on public.nutrition_plans(folder_id)
  where folder_id is not null;

alter table public.nutrition_folders enable row level security;

create policy "nutrition_folders_own" on public.nutrition_folders
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "nutrition_plans_personal_own" on public.nutrition_plans
  for all
  using (is_personal = true and created_by = auth.uid())
  with check (is_personal = true and created_by = auth.uid());

create policy "meals_personal" on public.meals
  for all
  using (exists (
    select 1 from public.nutrition_plans np
    where np.id = meals.plan_id
      and np.is_personal = true
      and np.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.nutrition_plans np
    where np.id = meals.plan_id
      and np.is_personal = true
      and np.created_by = auth.uid()
  ));

create policy "nutrition_assignments_client_own" on public.nutrition_assignments
  for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.nutrition_plans np
      where np.id = plan_id
        and np.is_personal = true
        and np.created_by = auth.uid()
    )
  );

create policy "nutrition_assignments_client_update_own" on public.nutrition_assignments
  for update
  using (auth.uid() = client_id);
