-- Production lost the admin write policy on classes (inserts failed RLS even for admins).
drop policy if exists "Admins manage classes" on public.classes;
create policy "Admins manage classes"
  on public.classes for all
  using (public.is_admin())
  with check (public.is_admin());
