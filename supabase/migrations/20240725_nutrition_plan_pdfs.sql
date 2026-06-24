-- Custom nutrition plans delivered as PDF files

alter table public.plan_requests
  add column if not exists delivered_nutrition_pdf_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nutrition-plan-pdfs',
  'nutrition-plan-pdfs',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "nutrition_plan_pdfs_admin_all" on storage.objects
  for all
  using (bucket_id = 'nutrition-plan-pdfs' and public.is_admin())
  with check (bucket_id = 'nutrition-plan-pdfs' and public.is_admin());

create policy "nutrition_plan_pdfs_client_read" on storage.objects
  for select
  using (
    bucket_id = 'nutrition-plan-pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
