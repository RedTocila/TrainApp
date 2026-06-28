-- Flash challenges: short sprints with entry fee and smaller prize pool

alter table public.challenges
  add column if not exists is_flash boolean not null default false,
  add column if not exists entry_fee_cents integer not null default 0
    check (entry_fee_cents >= 0);

comment on column public.challenges.is_flash is
  'Quick competition (1–7 days). One active flash enrollment per user.';
comment on column public.challenges.entry_fee_cents is
  'Display entry fee in cents (e.g. 1000 = €10). Paid manually offline.';

drop policy if exists "Clients join challenge waitlist" on public.challenge_waitlist;

create policy "Clients join challenge waitlist"
  on public.challenge_waitlist for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.published = true
        and (c.is_transformation = true or c.is_flash = true)
    )
  );
