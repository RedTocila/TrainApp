-- Sell Plus and Pro. Keep legacy plan ids so existing subscribers are unchanged.

alter table public.subscription_orders
  drop constraint if exists subscription_orders_plan_check;

alter table public.subscription_orders
  add constraint subscription_orders_plan_check
  check (plan in ('core', 'basic', 'ai', 'elite', 'plus', 'pro'));

alter table public.profiles
  drop constraint if exists profiles_subscription_plan_check;

alter table public.profiles
  add constraint profiles_subscription_plan_check
  check (
    subscription_plan is null
    or subscription_plan in ('core', 'basic', 'ai', 'elite', 'plus', 'pro')
  );

alter table public.subscription_offers
  drop constraint if exists subscription_offers_plan_id_check;

alter table public.subscription_offers
  add constraint subscription_offers_plan_id_check
  check (plan_id in ('ai', 'elite', 'plus', 'pro'));

-- Pro (and legacy Elite) can read live classes and challenges.
-- Cancelling keeps rows; access ends when subscription_expires_at passes.

drop policy if exists "Elite subscribers read published classes" on public.classes;
create policy "Pro subscribers read published classes"
  on public.classes for select
  using (
    public.is_admin()
    or (
      published = true
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.subscription_plan in ('pro', 'elite')
          and p.subscription_status in ('active', 'canceled')
          and p.subscription_expires_at is not null
          and p.subscription_expires_at > now()
      )
    )
  );

drop policy if exists "Elite subscribers read published challenges" on public.challenges;
create policy "Pro subscribers read published challenges"
  on public.challenges for select
  using (
    public.is_admin()
    or (
      published = true
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.subscription_plan in ('pro', 'elite')
          and p.subscription_status in ('active', 'canceled')
          and p.subscription_expires_at is not null
          and p.subscription_expires_at > now()
      )
    )
  );

drop policy if exists "Elite subscribers read challenge participants" on public.challenge_participants;
create policy "Pro subscribers read challenge participants"
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
            and p.subscription_plan in ('pro', 'elite')
            and p.subscription_status in ('active', 'canceled')
            and p.subscription_expires_at is not null
            and p.subscription_expires_at > now()
        )
    )
  );

drop policy if exists "Elite clients register for published challenges" on public.challenge_participants;
create policy "Pro clients register for published challenges"
  on public.challenge_participants for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
    )
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or (
            p.subscription_plan in ('pro', 'elite')
            and p.subscription_status in ('active', 'canceled')
            and p.subscription_expires_at is not null
            and p.subscription_expires_at > now()
          )
        )
    )
  );

drop policy if exists "Elite subscribers read challenge groups" on public.challenge_groups;
create policy "Pro subscribers read challenge groups"
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
            and p.subscription_plan in ('pro', 'elite')
            and p.subscription_status in ('active', 'canceled')
            and p.subscription_expires_at is not null
            and p.subscription_expires_at > now()
        )
    )
  );

drop policy if exists "Elite subscribers read challenge group members" on public.challenge_group_members;
create policy "Pro subscribers read challenge group members"
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
            and p.subscription_plan in ('pro', 'elite')
            and p.subscription_status in ('active', 'canceled')
            and p.subscription_expires_at is not null
            and p.subscription_expires_at > now()
        )
    )
  );

drop policy if exists "Elite subscribers read challenge waitlist" on public.challenge_waitlist;
create policy "Pro subscribers read challenge waitlist"
  on public.challenge_waitlist for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.subscription_plan in ('pro', 'elite')
            and p.subscription_status in ('active', 'canceled')
            and p.subscription_expires_at is not null
            and p.subscription_expires_at > now()
        )
    )
  );

-- This table is not on every database. Skip it instead of failing the migration.
do $$
begin
  if to_regclass('public.challenge_announcements') is null then
    return;
  end if;

  execute 'drop policy if exists "AI subscribers read published challenge announcements" on public.challenge_announcements';
  execute 'drop policy if exists "Pro subscribers read published challenge announcements" on public.challenge_announcements';
  execute $policy$
    create policy "Pro subscribers read published challenge announcements"
      on public.challenge_announcements for select
      using (
        public.is_admin()
        or (
          published = true
          and exists (
            select 1 from public.challenges c
            where c.id = challenge_id
              and c.published = true
              and exists (
                select 1 from public.profiles p
                where p.id = auth.uid()
                  and p.subscription_plan in ('pro', 'elite')
                  and p.subscription_status in ('active', 'canceled')
                  and p.subscription_expires_at is not null
                  and p.subscription_expires_at > now()
              )
          )
        )
      )
  $policy$;
end $$;
