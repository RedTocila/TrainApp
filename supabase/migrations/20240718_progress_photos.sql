-- Monthly progress photo sets (front / back / side)

create table if not exists public.progress_photo_sets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  month_key date not null,
  front_path text,
  back_path text,
  side_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month_key)
);

create index if not exists idx_progress_photo_sets_client_month
  on public.progress_photo_sets(client_id, month_key desc);

alter table public.progress_photo_sets enable row level security;

create policy "progress_photo_sets_own" on public.progress_photo_sets
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "progress_photo_sets_admin_read" on public.progress_photo_sets
  for select
  using (public.is_admin());

-- Private bucket; clients read/write only their folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  2097152,
  array['image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "progress_photos_select_own" on storage.objects
  for select
  using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "progress_photos_insert_own" on storage.objects
  for insert
  with check (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "progress_photos_update_own" on storage.objects
  for update
  using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "progress_photos_delete_own" on storage.objects
  for delete
  using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "progress_photos_admin_read" on storage.objects
  for select
  using (bucket_id = 'progress-photos' and public.is_admin());
