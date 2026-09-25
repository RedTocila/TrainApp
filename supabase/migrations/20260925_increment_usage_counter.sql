-- Atomic usage counter increment (avoids TOCTOU lost updates).
create or replace function public.increment_usage_counter(
  p_user_id uuid,
  p_counter_key text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.user_usage_counters (user_id, counter_key, count, updated_at)
  values (p_user_id, p_counter_key, 1, now())
  on conflict (user_id, counter_key)
  do update set
    count = public.user_usage_counters.count + 1,
    updated_at = now()
  returning count into v_count;

  return v_count;
end;
$$;

revoke all on function public.increment_usage_counter(uuid, text) from public;
grant execute on function public.increment_usage_counter(uuid, text) to service_role;
