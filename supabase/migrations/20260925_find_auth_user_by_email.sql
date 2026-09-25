-- Fast email → auth user id lookup (avoids paginating listUsers).
create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
