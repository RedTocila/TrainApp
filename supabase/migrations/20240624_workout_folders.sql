-- Workout folders for organizing personal programs (e.g. weight loss, weight gain)

create table if not exists public.workout_folders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workout_folders_client
  on public.workout_folders(client_id, created_at);

alter table public.workout_plans
  add column if not exists folder_id uuid references public.workout_folders(id) on delete set null;

create index if not exists idx_workout_plans_folder
  on public.workout_plans(folder_id)
  where folder_id is not null;

alter table public.workout_folders enable row level security;

create policy "workout_folders_own" on public.workout_folders
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);
