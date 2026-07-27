-- Admin-managed YouTube video URLs for exercises from the catalog.
-- The catalog_exercise_id is the string "id" field from exercise-catalog.json.
create table if not exists public.exercise_video_overrides (
  catalog_exercise_id text primary key,
  youtube_url text not null,
  updated_at timestamptz not null default now()
);

-- Only admins can read/write.
alter table public.exercise_video_overrides enable row level security;

create policy "exercise_video_overrides_admin"
  on public.exercise_video_overrides
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Clients can read (so video shows in their workout view).
create policy "exercise_video_overrides_client_read"
  on public.exercise_video_overrides
  for select
  using (auth.role() = 'authenticated');
