-- Meal log photos (compressed, retained 30 days)

alter table public.daily_meal_logs
  add column if not exists photo_path text,
  add column if not exists photo_expires_at timestamptz;

create index if not exists idx_daily_meal_logs_photo_expires
  on public.daily_meal_logs(photo_expires_at)
  where photo_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-photos',
  'meal-photos',
  false,
  2097152,
  array['image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "meal_photos_select_own" on storage.objects
  for select
  using (
    bucket_id = 'meal-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "meal_photos_insert_own" on storage.objects
  for insert
  with check (
    bucket_id = 'meal-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "meal_photos_update_own" on storage.objects
  for update
  using (
    bucket_id = 'meal-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "meal_photos_delete_own" on storage.objects
  for delete
  using (
    bucket_id = 'meal-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
