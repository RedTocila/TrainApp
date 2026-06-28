-- 3-phase tournament: R1 semi-elimination (10→5), R2 group finals (10→1), R3 champion

alter table public.challenges
  add column if not exists round_1_zoom_at timestamptz,
  add column if not exists round_2_zoom_at timestamptz,
  add column if not exists round_3_zoom_at timestamptz,
  add column if not exists prize_paid_at timestamptz,
  add column if not exists current_phase smallint not null default 0
    check (current_phase >= 0 and current_phase <= 4);

comment on column public.challenges.current_phase is
  '0=registration, 1=month1, 2=month2, 3=final, 4=completed';

alter table public.challenge_groups
  add column if not exists scheduled_at timestamptz;

alter table public.challenge_groups
  drop constraint if exists challenge_groups_round_check;

alter table public.challenge_groups
  add constraint challenge_groups_round_check check (round in (1, 2, 3));

alter table public.challenge_group_members
  add column if not exists outcome text not null default 'pending'
    check (outcome in ('pending', 'advanced', 'eliminated', 'group_winner', 'champion'));

alter table public.challenge_participants
  add column if not exists status text not null default 'registered'
    check (status in ('registered', 'active', 'eliminated', 'finalist', 'champion')),
  add column if not exists eliminated_round smallint
    check (eliminated_round is null or eliminated_round in (1, 2, 3));

-- Backfill existing data
update public.challenge_group_members cgm
set outcome = case
  when cg.winner_participant_id = cgm.participant_id and cg.round = 2 then 'champion'
  when cg.winner_participant_id = cgm.participant_id and cg.round = 1 then 'advanced'
  when cg.winner_participant_id is not null then 'eliminated'
  else 'pending'
end
from public.challenge_groups cg
where cg.id = cgm.group_id
  and cgm.outcome = 'pending'
  and cg.winner_participant_id is not null;

update public.challenge_participants cp
set status = case
  when c.champion_participant_id = cp.id then 'champion'
  else cp.status
end
from public.challenges c
where c.id = cp.challenge_id
  and c.champion_participant_id = cp.id;

update public.challenges
set
  round_1_zoom_at = coalesce(round_1_zoom_at, scheduled_at + interval '1 month'),
  round_2_zoom_at = coalesce(round_2_zoom_at, scheduled_at + interval '2 months'),
  round_3_zoom_at = coalesce(round_3_zoom_at, scheduled_at + interval '3 months')
where round_1_zoom_at is null;
