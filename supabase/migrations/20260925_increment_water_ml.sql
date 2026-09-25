-- Atomic water intake increment to avoid lost updates under concurrent taps.

create or replace function public.increment_water_ml(
  p_user_id uuid,
  p_date date,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_water integer;
begin
  if p_amount is null or p_amount = 0 then
    select coalesce(water_ml, 0)
      into v_water
    from public.daily_logs
    where client_id = p_user_id
      and date = p_date;
    return coalesce(v_water, 0);
  end if;

  insert into public.daily_logs (client_id, date, water_ml)
  values (p_user_id, p_date, greatest(0, p_amount))
  on conflict (client_id, date)
  do update set water_ml = greatest(0, public.daily_logs.water_ml + excluded.water_ml)
  returning water_ml into v_water;

  return v_water;
end;
$$;

revoke all on function public.increment_water_ml(uuid, date, integer) from public;
grant execute on function public.increment_water_ml(uuid, date, integer) to authenticated;
grant execute on function public.increment_water_ml(uuid, date, integer) to service_role;
