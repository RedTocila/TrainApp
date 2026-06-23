-- Allow clients to self-assign coach-delivered plans when implementing (optional belt-and-suspenders;
-- server actions also use service role after auth checks).

create policy "nutrition_assignments_client_implement_delivered"
  on public.nutrition_assignments
  for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1
      from public.plan_requests pr
      where pr.client_id = auth.uid()
        and pr.delivered_nutrition_plan_id = plan_id
        and pr.status = 'delivered'
        and pr.type = 'diet'
    )
  );

create policy "workout_assignments_client_implement_delivered"
  on public.workout_assignments
  for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1
      from public.plan_requests pr
      where pr.client_id = auth.uid()
        and pr.delivered_workout_plan_id = plan_id
        and pr.status = 'delivered'
        and pr.type = 'workout'
    )
  );

create policy "plan_requests_client_implement"
  on public.plan_requests
  for update
  using (auth.uid() = client_id and status = 'delivered')
  with check (auth.uid() = client_id and status = 'implemented');
