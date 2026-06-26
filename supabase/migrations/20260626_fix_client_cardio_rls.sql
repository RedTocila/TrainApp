-- Ensure client cardio RLS policies allow authenticated clients to manage their own rows.

drop policy if exists "client_cardio_own" on public.client_cardio;
drop policy if exists "client_cardio_select_own" on public.client_cardio;
drop policy if exists "client_cardio_insert_own" on public.client_cardio;
drop policy if exists "client_cardio_update_own" on public.client_cardio;
drop policy if exists "client_cardio_delete_own" on public.client_cardio;

create policy "client_cardio_select_own" on public.client_cardio
  for select
  using (auth.uid() = client_id);

create policy "client_cardio_insert_own" on public.client_cardio
  for insert
  with check (auth.uid() = client_id);

create policy "client_cardio_update_own" on public.client_cardio
  for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "client_cardio_delete_own" on public.client_cardio
  for delete
  using (auth.uid() = client_id);

drop policy if exists "scheduled_cardio_own" on public.scheduled_cardio;
drop policy if exists "scheduled_cardio_select_own" on public.scheduled_cardio;
drop policy if exists "scheduled_cardio_insert_own" on public.scheduled_cardio;
drop policy if exists "scheduled_cardio_update_own" on public.scheduled_cardio;
drop policy if exists "scheduled_cardio_delete_own" on public.scheduled_cardio;

create policy "scheduled_cardio_select_own" on public.scheduled_cardio
  for select
  using (auth.uid() = client_id);

create policy "scheduled_cardio_insert_own" on public.scheduled_cardio
  for insert
  with check (auth.uid() = client_id);

create policy "scheduled_cardio_update_own" on public.scheduled_cardio
  for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "scheduled_cardio_delete_own" on public.scheduled_cardio
  for delete
  using (auth.uid() = client_id);

grant select, insert, update, delete on table public.client_cardio to authenticated;
grant select, insert, update, delete on table public.scheduled_cardio to authenticated;
