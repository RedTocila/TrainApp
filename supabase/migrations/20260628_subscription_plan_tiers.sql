-- Three-tier subscription plans: basic, ai (AI Pro), elite

alter table public.subscription_orders
  drop constraint if exists subscription_orders_plan_check;

alter table public.subscription_orders
  add constraint subscription_orders_plan_check
  check (plan in ('core', 'basic', 'ai', 'elite'));

alter table public.profiles
  drop constraint if exists profiles_subscription_plan_check;

alter table public.profiles
  add constraint profiles_subscription_plan_check
  check (
    subscription_plan is null
    or subscription_plan in ('core', 'basic', 'ai', 'elite')
  );

-- Elite subscribers get live classes & challenges (previously AI-only)
drop policy if exists "AI subscribers read published classes" on public.classes;
create policy "Elite subscribers read published classes"
  on public.classes for select
  using (
    public.is_admin()
    or (
      published = true
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.subscription_plan = 'elite'
          and p.subscription_status in ('active', 'canceled')
          and (p.subscription_expires_at is null or p.subscription_expires_at > now())
      )
    )
  );

drop policy if exists "AI subscribers read published challenges" on public.challenges;
create policy "Elite subscribers read published challenges"
  on public.challenges for select
  using (
    public.is_admin()
    or (
      published = true
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.subscription_plan = 'elite'
          and p.subscription_status in ('active', 'canceled')
          and (p.subscription_expires_at is null or p.subscription_expires_at > now())
      )
    )
  );

-- Challenge bracket tables (elite-only access)
drop policy if exists "AI subscribers read challenge participants" on public.challenge_participants;
create policy "Elite subscribers read challenge participants"
  on public.challenge_participants for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.subscription_plan = 'elite'
            and p.subscription_status in ('active', 'canceled')
            and (p.subscription_expires_at is null or p.subscription_expires_at > now())
        )
    )
  );

drop policy if exists "AI subscribers read challenge groups" on public.challenge_groups;
create policy "Elite subscribers read challenge groups"
  on public.challenge_groups for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.subscription_plan = 'elite'
            and p.subscription_status in ('active', 'canceled')
            and (p.subscription_expires_at is null or p.subscription_expires_at > now())
        )
    )
  );

drop policy if exists "AI subscribers read challenge group members" on public.challenge_group_members;
create policy "Elite subscribers read challenge group members"
  on public.challenge_group_members for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.challenge_groups g
      join public.challenges c on c.id = g.challenge_id
      where g.id = group_id
        and c.published = true
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.subscription_plan = 'elite'
            and p.subscription_status in ('active', 'canceled')
            and (p.subscription_expires_at is null or p.subscription_expires_at > now())
        )
    )
  );
