"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireClient } from "@/lib/actions/auth";
import {
  countChallengeParticipants,
  findActiveSeriesParticipant,
  findActiveSeriesWaitlistEntry,
  getLongChallengeJoinBlockReason,
  leaveOtherSeriesChallenges,
  promoteNextFromWaitlist,
  removeIneligibleSeriesParticipants,
  removeParticipantAndPromote,
} from "@/lib/challenge-slot-management";
import { participantIdsByPlatformScore } from "@/lib/challenge-participant-ranking";
import { getPlatformEngagementScores } from "@/lib/actions/platform-engagement-score";
import {
  groupScheduledAt,
  isChallengeAtCapacity,
  canLeaveChallenge,
  canRegisterForChallenge,
  getChallengePhase,
  getChallengeStatus,
  ROUND1_ADVANCE_COUNT,
} from "@/lib/challenge-utils";
import type { ChallengeSeries } from "@/lib/challenge-series";
import { getChallengeSeries, isFlashChallenge, isTransformationChallenge, usesChallengeWaitlist } from "@/lib/challenge-series";
import {
  flashGroupSize,
  flashRequiresPaymentOnJoin,
} from "@/lib/flash-challenge-entry-fee";
import {
  FLASH_MIN_PARTICIPANTS_TO_START,
  flashMaxGroupCount,
  participantIdsByJoinOrder,
} from "@/lib/flash-challenge-utils";
import { hasEliteAccess } from "@/lib/subscription";
import type {
  Challenge,
  ChallengeBracketData,
  ChallengeBracketGroup,
  ChallengeBracketParticipant,
  ChallengeGroup,
  ChallengeMemberOutcome,
  ChallengeParticipant,
  ChallengeParticipantStatus,
  UserSeriesChallengeStatus,
} from "@/lib/types";

function rowToParticipant(row: Record<string, unknown>): ChallengeParticipant {
  return {
    ...(row as unknown as ChallengeParticipant),
    status: (row.status as ChallengeParticipantStatus) ?? "registered",
    eliminated_round: (row.eliminated_round as 1 | 2 | 3 | null) ?? null,
    entry_fee_paid_at: (row.entry_fee_paid_at as string | null) ?? null,
  };
}

function rowToGroup(row: Record<string, unknown>): ChallengeGroup {
  return {
    ...(row as unknown as ChallengeGroup),
    scheduled_at: (row.scheduled_at as string | null) ?? null,
  };
}

function rowToChallenge(row: Record<string, unknown>): Challenge {
  return {
    ...(row as unknown as Challenge),
    prize_pool_cents_per_participant:
      typeof row.prize_pool_cents_per_participant === "number"
        ? row.prize_pool_cents_per_participant
        : 1000,
    duration_months: typeof row.duration_months === "number" ? row.duration_months : 3,
    duration_days: typeof row.duration_days === "number" ? row.duration_days : null,
    max_participants:
      typeof row.max_participants === "number" ? row.max_participants : null,
    is_transformation: row.is_transformation === true,
    is_flash: row.is_flash === true,
    gender:
      row.gender === "male" || row.gender === "female" ? row.gender : null,
    entry_fee_cents: typeof row.entry_fee_cents === "number" ? row.entry_fee_cents : 0,
    round_1_zoom_at: (row.round_1_zoom_at as string | null) ?? null,
    round_2_zoom_at: (row.round_2_zoom_at as string | null) ?? null,
    round_3_zoom_at: (row.round_3_zoom_at as string | null) ?? null,
    prize_paid_at: (row.prize_paid_at as string | null) ?? null,
    registration_opens_at: (row.registration_opens_at as string | null) ?? null,
    registration_closes_at: (row.registration_closes_at as string | null) ?? null,
    current_phase: (row.current_phase as Challenge["current_phase"]) ?? 0,
  };
}

function nestedChallenge(
  value: unknown
): {
  id: string;
  slug: string;
  title: string;
  is_transformation?: boolean;
  is_flash?: boolean;
} | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return (value[0] as {
      id: string;
      slug: string;
      title: string;
      is_transformation?: boolean;
      is_flash?: boolean;
    }) ?? null;
  }
  return value as {
    id: string;
    slug: string;
    title: string;
    is_transformation?: boolean;
    is_flash?: boolean;
  };
}

export async function getUserSeriesChallengeStatus(
  userId: string,
  series: ChallengeSeries
): Promise<UserSeriesChallengeStatus> {
  const supabase = await createClient();
  await removeIneligibleSeriesParticipants(supabase, userId);

  const activeParticipant = await findActiveSeriesParticipant(supabase, userId, series);
  const participant = activeParticipant
    ? {
        challenge_id: activeParticipant.challenge_id,
        challenge_slug: activeParticipant.challenge_slug,
        challenge_title: activeParticipant.challenge_title,
      }
    : null;

  const activeWaitlist = await findActiveSeriesWaitlistEntry(supabase, userId, series);

  let waitlist: UserSeriesChallengeStatus["waitlist"] = null;
  if (activeWaitlist) {
    const { data: waitlistMeta } = await supabase
      .from("challenge_waitlist")
      .select("created_at")
      .eq("user_id", userId)
      .eq("challenge_id", activeWaitlist.challenge_id)
      .maybeSingle();

    if (waitlistMeta) {
      const { count } = await supabase
        .from("challenge_waitlist")
        .select("id", { count: "exact", head: true })
        .eq("challenge_id", activeWaitlist.challenge_id)
        .lte("created_at", waitlistMeta.created_at);

      waitlist = {
        challenge_id: activeWaitlist.challenge_id,
        challenge_slug: activeWaitlist.challenge_slug,
        challenge_title: activeWaitlist.challenge_title,
        position: count ?? 1,
      };
    }
  }

  return { participant, waitlist };
}

export async function getUserTransformationChallengeStatus(
  userId: string
): Promise<UserSeriesChallengeStatus> {
  return getUserSeriesChallengeStatus(userId, "transformation");
}

export async function getUserFlashChallengeStatus(
  userId: string
): Promise<UserSeriesChallengeStatus> {
  return getUserSeriesChallengeStatus(userId, "flash");
}

function revalidateChallengePaths(challenge: Pick<Challenge, "id" | "slug">) {
  revalidatePath(`/dashboard/challenges/${challenge.slug}`);
  revalidatePath("/dashboard/classes");
  revalidatePath(`/admin/challenges/${challenge.id}/bracket`);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export async function registerForChallenge(challengeId: string) {
  const profile = await requireClient();
  if (!hasEliteAccess(profile)) {
    return { error: "Elite membership is required to join community challenges." };
  }

  const supabase = await createClient();
  await removeIneligibleSeriesParticipants(supabase, profile.id);

  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challengeRow?.published) {
    return { error: "Challenge not found." };
  }

  const challenge = rowToChallenge(challengeRow);

  if (!canRegisterForChallenge(challenge)) {
    const opens = challenge.registration_opens_at
      ? new Date(challenge.registration_opens_at)
      : null;
    if (opens && opens > new Date()) {
      return { error: "Registration has not opened yet." };
    }
    if (getChallengeStatus(challenge) === "ended") {
      return { error: "This challenge has ended." };
    }
    return { error: "Registration is not open right now." };
  }

  const { data: existingParticipant } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (existingParticipant) {
    return { error: "You are already registered." };
  }

  const series = getChallengeSeries(challenge);

  if (series === "transformation") {
    const blockReason = await getLongChallengeJoinBlockReason(
      supabase,
      profile.id,
      challengeId,
      profile.gender
    );
    if (blockReason) {
      return { error: blockReason };
    }
  } else if (series === "flash") {
    // Flash challenges allow multiple simultaneous enrollments.
  }

  const participantCount = await countChallengeParticipants(supabase, challengeId);

  if (series === "flash" && flashRequiresPaymentOnJoin(participantCount, flashGroupSize(challenge))) {
    return {
      error:
        "The first group is full — pay the entry fee to join. Use the Join button to checkout.",
      requiresPayment: true,
    };
  }

  if (isChallengeAtCapacity(challenge, participantCount)) {
    if (!usesChallengeWaitlist(challenge)) {
      return { error: "This challenge is full." };
    }

    const { data: existingWaitlist } = await supabase
      .from("challenge_waitlist")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existingWaitlist) {
      return { error: "You are already on the waitlist for this challenge." };
    }

    if (series === "flash") {
      await supabase.from("challenge_waitlist").delete().eq("user_id", profile.id);
    }

    const { error: waitlistError } = await supabase.from("challenge_waitlist").insert({
      challenge_id: challengeId,
      user_id: profile.id,
    });

    if (waitlistError) {
      if (waitlistError.code === "23505") {
        return { error: "You are already on the waitlist for this challenge." };
      }
      if (waitlistError.code === "23514") {
        return { error: waitlistError.message };
      }
      return { error: waitlistError.message };
    }

    revalidateChallengePaths(challenge);
    return { success: true, waitlisted: true };
  }

  const insertPayload: Record<string, unknown> = {
    challenge_id: challengeId,
    user_id: profile.id,
    display_name: profile.full_name?.trim() || "Participant",
    status: "active",
  };

  if (series === "flash") {
    insertPayload.entry_fee_paid_at = null;
  }

  const { error } = await supabase.from("challenge_participants").insert(insertPayload);

  if (error) {
    if (error.code === "23505") {
      return { error: "You are already registered." };
    }
    if (error.code === "23514") {
      return { error: error.message };
    }
    return { error: error.message };
  }

  await supabase
    .from("challenge_waitlist")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("user_id", profile.id);

  if (series === "flash" && getChallengePhase(challenge) > 0) {
    const { data: inserted } = await supabase
      .from("challenge_participants")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (inserted?.id) {
      await assignFlashParticipantToGroup(supabase, challengeId, inserted.id as string);
    }
  }

  revalidateChallengePaths(challenge);
  return { success: true };
}

export async function leaveChallenge(challengeId: string) {
  const profile = await requireClient();
  const supabase = await createClient();

  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("id, slug, max_participants, is_transformation, is_flash")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challengeRow) return { error: "Challenge not found." };

  const challenge = rowToChallenge(challengeRow);

  const { data: participant } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!participant) {
    return { error: "You are not registered for this challenge." };
  }

  const { data: fullChallengeRow } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (fullChallengeRow && !canLeaveChallenge(rowToChallenge(fullChallengeRow))) {
    const fullChallenge = rowToChallenge(fullChallengeRow);
    if (isTransformationChallenge(fullChallenge) && getChallengePhase(fullChallenge) > 0) {
      return { error: "You cannot leave after the tournament has started." };
    }
    return { error: "You cannot leave after registration closes." };
  }

  await removeParticipantAndPromote(supabase, challenge, profile.id);
  revalidateChallengePaths(challenge);
  return { success: true };
}

export async function leaveChallengeWaitlist(challengeId: string) {
  const profile = await requireClient();
  const supabase = await createClient();

  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("id, slug")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challengeRow) return { error: "Challenge not found." };

  const { error } = await supabase
    .from("challenge_waitlist")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("user_id", profile.id);

  if (error) return { error: error.message };

  revalidateChallengePaths(rowToChallenge(challengeRow));
  return { success: true };
}

export async function getChallengeBracket(
  challengeId: string,
  userId?: string | null
): Promise<ChallengeBracketData | null> {
  const supabase = await createClient();

  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challengeRow) return null;

  const challenge = rowToChallenge(challengeRow);

  const { data: participants } = await supabase
    .from("challenge_participants")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true });

  const { data: groups } = await supabase
    .from("challenge_groups")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("round", { ascending: true })
    .order("group_number", { ascending: true });

  const groupIds = (groups ?? []).map((g) => g.id);
  let members: {
    group_id: string;
    participant_id: string;
    outcome: ChallengeMemberOutcome;
    performance_value: number | null;
  }[] = [];

  if (groupIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("challenge_group_members")
      .select("group_id, participant_id, outcome, performance_value")
      .in("group_id", groupIds);
    members = (memberRows ?? []).map((m) => ({
      group_id: m.group_id,
      participant_id: m.participant_id,
      outcome: (m.outcome as ChallengeMemberOutcome) ?? "pending",
      performance_value:
        typeof m.performance_value === "number" ? m.performance_value : null,
    }));
  }

  const participantList = (participants ?? []).map(rowToParticipant);
  const participantById = new Map(participantList.map((p) => [p.id, p]));
  const currentUserParticipantId =
    userId != null
      ? participantList.find((p) => p.user_id === userId)?.id ?? null
      : null;

  const champion = challenge.champion_participant_id
    ? participantById.get(challenge.champion_participant_id) ?? null
    : null;

  const buildGroup = (group: ChallengeGroup): ChallengeBracketGroup => {
    const memberRows = members.filter((m) => m.group_id === group.id);

    const groupMembers: ChallengeBracketParticipant[] = memberRows.flatMap((row) => {
      const p = participantById.get(row.participant_id);
      if (!p) return [];
      const isWinner = p.id === group.winner_participant_id;
      return [
        {
          ...p,
          outcome: row.outcome,
          is_champion: p.id === challenge.champion_participant_id,
          is_group_winner: isWinner || row.outcome === "group_winner",
          group_id: group.id,
          group_number: group.group_number,
          round: group.round,
          performance_value:
            row.outcome === "group_winner" ? row.performance_value : null,
        },
      ];
    });

    const winner =
      groupMembers.find(
        (m) =>
          m.id === group.winner_participant_id ||
          m.outcome === "group_winner" ||
          m.outcome === "champion"
      ) ?? null;

    return { ...group, members: groupMembers, winner };
  };

  const allGroups = (groups ?? []).map((g) => buildGroup(rowToGroup(g)));
  const round1Groups = allGroups.filter((g) => g.round === 1);
  const round2Groups = allGroups.filter((g) => g.round === 2);
  const round3Group = allGroups.find((g) => g.round === 3) ?? null;

  return {
    challenge,
    participants: participantList,
    round1Groups,
    round2Groups,
    round3Group,
    champion,
    currentUserParticipantId,
    currentPhase: challenge.current_phase ?? 0,
    groupStage: round1Groups,
    finalRound: round3Group,
  };
}

export async function getChallengeBracketBySlug(
  slug: string,
  userId?: string | null
): Promise<ChallengeBracketData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("challenges")
    .select("id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!data) return null;
  return getChallengeBracket(data.id, userId);
}

async function deleteGroupsForRound(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: string,
  round: 1 | 2 | 3
) {
  const { data: roundGroups } = await supabase
    .from("challenge_groups")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("round", round);

  const ids = (roundGroups ?? []).map((g) => g.id);
  if (ids.length === 0) return;

  await supabase.from("challenge_group_members").delete().in("group_id", ids);
  await supabase.from("challenge_groups").delete().in("id", ids);
}

export async function generateRound1Groups(challengeId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, slug, group_size, round_1_zoom_at")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge) throw new Error("Challenge not found.");

  const { data: participants } = await supabase
    .from("challenge_participants")
    .select("id, user_id, created_at")
    .eq("challenge_id", challengeId)
    .in("status", ["registered", "active"])
    .order("created_at", { ascending: true });

  const participantRows = participants ?? [];
  if (participantRows.length === 0) throw new Error("Add participants before generating groups.");

  const scoreEntries = await getPlatformEngagementScores(
    participantRows.map((participant) => ({
      userId: participant.user_id as string,
      since: participant.created_at as string,
    }))
  );

  const scores = Object.fromEntries(
    Object.entries(scoreEntries).map(([userId, entry]) => [userId, entry.score])
  );

  const ids = participantIdsByPlatformScore(
    participantRows.map((participant) => ({
      id: participant.id as string,
      user_id: participant.user_id as string,
      created_at: participant.created_at as string,
    })),
    scores
  );

  const groupSize = challenge.group_size || 10;
  const groupCount = Math.ceil(ids.length / groupSize);

  await deleteGroupsForRound(supabase, challengeId, 1);

  for (let i = 0; i < groupCount; i++) {
    const slice = ids.slice(i * groupSize, (i + 1) * groupSize);
    const scheduledAt = groupScheduledAt(challenge.round_1_zoom_at, i);

    const { data: group, error } = await supabase
      .from("challenge_groups")
      .insert({
        challenge_id: challengeId,
        round: 1,
        group_number: i + 1,
        scheduled_at: scheduledAt,
      })
      .select("id")
      .single();

    if (error || !group) throw new Error(error?.message ?? "Could not create group.");

    const { error: memberError } = await supabase.from("challenge_group_members").insert(
      slice.map((participant_id) => ({
        group_id: group.id,
        participant_id,
        outcome: "pending",
      }))
    );

    if (memberError) throw new Error(memberError.message);
  }

  await supabase
    .from("challenges")
    .update({ current_phase: 1 })
    .eq("id", challengeId);

  revalidateBracketPaths(supabase, challengeId);
}

export async function startFlashChallenge(challengeId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challengeRow?.is_flash) {
    throw new Error("This action is only for flash challenges.");
  }

  const challenge = rowToChallenge(challengeRow);
  if (getChallengePhase(challenge) > 0) {
    throw new Error("This challenge has already started.");
  }

  const participantCount = await countChallengeParticipants(supabase, challengeId);
  if (participantCount < FLASH_MIN_PARTICIPANTS_TO_START) {
    throw new Error(
      `At least ${FLASH_MIN_PARTICIPANTS_TO_START} participants are required before starting.`
    );
  }

  const startedAt = new Date().toISOString();
  await supabase
    .from("challenges")
    .update({
      scheduled_at: startedAt,
      current_phase: 1,
    })
    .eq("id", challengeId);

  await generateFlashGroupsInternal(supabase, challengeId);
  revalidateBracketPaths(supabase, challengeId);
}

async function generateFlashGroupsInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: string
) {
  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("id, group_size, round_1_zoom_at, is_flash, max_participants")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challengeRow?.is_flash) return;

  const challenge = rowToChallenge(challengeRow);

  const { data: participants } = await supabase
    .from("challenge_participants")
    .select("id, created_at")
    .eq("challenge_id", challengeId)
    .in("status", ["registered", "active", "finalist"])
    .order("created_at", { ascending: true });

  const participantRows = participants ?? [];
  if (participantRows.length === 0) return;

  const ids = participantIdsByJoinOrder(
    participantRows.map((participant) => ({
      id: participant.id as string,
      created_at: participant.created_at as string,
    }))
  );

  const groupSize = flashGroupSize(challenge);
  const groupCount = Math.min(
    flashMaxGroupCount(challenge),
    Math.ceil(ids.length / groupSize)
  );

  await deleteGroupsForRound(supabase, challengeId, 1);

  for (let i = 0; i < groupCount; i++) {
    const slice = ids.slice(i * groupSize, (i + 1) * groupSize);
    if (slice.length === 0) continue;

    const scheduledAt = groupScheduledAt(challenge.round_1_zoom_at, i);

    const { data: group, error } = await supabase
      .from("challenge_groups")
      .insert({
        challenge_id: challengeId,
        round: 1,
        group_number: i + 1,
        scheduled_at: scheduledAt,
      })
      .select("id")
      .single();

    if (error || !group) throw new Error(error?.message ?? "Could not create group.");

    const { error: memberError } = await supabase.from("challenge_group_members").insert(
      slice.map((participant_id) => ({
        group_id: group.id,
        participant_id,
        outcome: "pending",
      }))
    );

    if (memberError) throw new Error(memberError.message);
  }
}

async function assignFlashParticipantToGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: string,
  participantId: string
) {
  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("group_size, max_participants, is_flash")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challengeRow?.is_flash) return;

  const challenge = rowToChallenge(challengeRow);
  const groupSize = flashGroupSize(challenge);

  const { data: existingMembership } = await supabase
    .from("challenge_group_members")
    .select("group_id")
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existingMembership) return;

  const { data: groups } = await supabase
    .from("challenge_groups")
    .select("id, group_number")
    .eq("challenge_id", challengeId)
    .eq("round", 1)
    .order("group_number", { ascending: true });

  const groupRows = groups ?? [];

  for (const group of groupRows) {
    const { count } = await supabase
      .from("challenge_group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id);

    if ((count ?? 0) < groupSize) {
      await supabase.from("challenge_group_members").insert({
        group_id: group.id,
        participant_id: participantId,
        outcome: "pending",
      });
      return;
    }
  }

  if (groupRows.length >= flashMaxGroupCount(challenge)) return;

  const { data: challengeZoom } = await supabase
    .from("challenges")
    .select("round_1_zoom_at")
    .eq("id", challengeId)
    .maybeSingle();

  const scheduledAt = groupScheduledAt(
    (challengeZoom?.round_1_zoom_at as string | null) ?? null,
    groupRows.length
  );

  const { data: newGroup, error } = await supabase
    .from("challenge_groups")
    .insert({
      challenge_id: challengeId,
      round: 1,
      group_number: groupRows.length + 1,
      scheduled_at: scheduledAt,
    })
    .select("id")
    .single();

  if (error || !newGroup) return;

  await supabase.from("challenge_group_members").insert({
    group_id: newGroup.id,
    participant_id: participantId,
    outcome: "pending",
  });
}

export async function generateFlashGroups(challengeId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await generateFlashGroupsInternal(supabase, challengeId);
  revalidateBracketPaths(supabase, challengeId);
}

export async function setFlashGroupWinner(
  groupId: string,
  participantId: string,
  performanceValue: number
) {
  await requireAdmin();
  if (!Number.isFinite(performanceValue) || performanceValue < 0) {
    throw new Error("Enter a valid performance score.");
  }

  const supabase = await createClient();

  const { data: group } = await supabase
    .from("challenge_groups")
    .select("id, challenge_id, round")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.round !== 1) throw new Error("Group not found.");

  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("is_flash")
    .eq("id", group.challenge_id)
    .maybeSingle();

  if (!challengeRow?.is_flash) {
    throw new Error("This action is only for flash challenge groups.");
  }

  const { data: memberRows } = await supabase
    .from("challenge_group_members")
    .select("participant_id")
    .eq("group_id", groupId);

  const memberIds = (memberRows ?? []).map((m) => m.participant_id);
  if (!memberIds.includes(participantId)) {
    throw new Error("Participant is not in this group.");
  }

  for (const memberId of memberIds) {
    const outcome = memberId === participantId ? "group_winner" : "eliminated";
    await supabase
      .from("challenge_group_members")
      .update({
        outcome,
        performance_value: memberId === participantId ? performanceValue : null,
      })
      .eq("group_id", groupId)
      .eq("participant_id", memberId);

    await supabase
      .from("challenge_participants")
      .update({
        status: outcome === "group_winner" ? "finalist" : "eliminated",
        eliminated_round: outcome === "eliminated" ? 1 : null,
      })
      .eq("id", memberId);
  }

  await supabase
    .from("challenge_groups")
    .update({ winner_participant_id: participantId })
    .eq("id", groupId);

  revalidateBracketPaths(supabase, group.challenge_id);
}

/** @deprecated use generateRound1Groups */
export async function generateChallengeGroups(challengeId: string) {
  return generateRound1Groups(challengeId);
}

export async function setRound1Advancers(groupId: string, participantIds: string[]) {
  await requireAdmin();
  if (participantIds.length !== ROUND1_ADVANCE_COUNT) {
    throw new Error(`Select exactly ${ROUND1_ADVANCE_COUNT} participants to advance.`);
  }

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("challenge_groups")
    .select("id, challenge_id, round")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.round !== 1) throw new Error("Group not found.");

  const { data: memberRows } = await supabase
    .from("challenge_group_members")
    .select("participant_id")
    .eq("group_id", groupId);

  const memberIds = new Set((memberRows ?? []).map((m) => m.participant_id));
  for (const id of participantIds) {
    if (!memberIds.has(id)) throw new Error("All advancers must be in this group.");
  }

  for (const memberId of memberIds) {
    const outcome = participantIds.includes(memberId) ? "advanced" : "eliminated";
    await supabase
      .from("challenge_group_members")
      .update({ outcome })
      .eq("group_id", groupId)
      .eq("participant_id", memberId);

    await supabase
      .from("challenge_participants")
      .update({
        status: outcome === "advanced" ? "active" : "eliminated",
        eliminated_round: outcome === "eliminated" ? 1 : null,
      })
      .eq("id", memberId);
  }

  revalidateBracketPaths(supabase, group.challenge_id);
}

export async function generateRound2Groups(challengeId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const bracket = await getChallengeBracket(challengeId);
  if (!bracket) throw new Error("Challenge not found.");

  if (!bracket.round1Groups.length) {
    throw new Error("Generate Round 1 groups first.");
  }

  const allAdvanced = bracket.round1Groups.every((g) => {
    const count = g.members.filter((m) => m.outcome === "advanced").length;
    return count === ROUND1_ADVANCE_COUNT;
  });

  if (!allAdvanced) {
    throw new Error("Mark 5 advancers in every Round 1 group before regrouping.");
  }

  const { data: challenge } = await supabase
    .from("challenges")
    .select("group_size, round_2_zoom_at")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge) throw new Error("Challenge not found.");

  const survivorIds = shuffle(
    bracket.round1Groups.flatMap((g) =>
      g.members.filter((m) => m.outcome === "advanced").map((m) => m.id)
    )
  );

  const groupSize = challenge.group_size || 10;
  const groupCount = Math.ceil(survivorIds.length / groupSize);

  await deleteGroupsForRound(supabase, challengeId, 2);

  for (let i = 0; i < groupCount; i++) {
    const slice = survivorIds.slice(i * groupSize, (i + 1) * groupSize);
    const scheduledAt = groupScheduledAt(challenge.round_2_zoom_at, i);

    const { data: group, error } = await supabase
      .from("challenge_groups")
      .insert({
        challenge_id: challengeId,
        round: 2,
        group_number: i + 1,
        scheduled_at: scheduledAt,
      })
      .select("id")
      .single();

    if (error || !group) throw new Error(error?.message ?? "Could not create group.");

    const { error: memberError } = await supabase.from("challenge_group_members").insert(
      slice.map((participant_id) => ({
        group_id: group.id,
        participant_id,
        outcome: "pending",
      }))
    );

    if (memberError) throw new Error(memberError.message);
  }

  await supabase
    .from("challenges")
    .update({ current_phase: 2 })
    .eq("id", challengeId);

  revalidateBracketPaths(supabase, challengeId);
}

export async function setRound2GroupWinner(groupId: string, participantId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("challenge_groups")
    .select("id, challenge_id, round")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.round !== 2) throw new Error("Group not found.");

  const { data: memberRows } = await supabase
    .from("challenge_group_members")
    .select("participant_id")
    .eq("group_id", groupId);

  const memberIds = (memberRows ?? []).map((m) => m.participant_id);
  if (!memberIds.includes(participantId)) {
    throw new Error("Participant is not in this group.");
  }

  for (const memberId of memberIds) {
    const outcome = memberId === participantId ? "group_winner" : "eliminated";
    await supabase
      .from("challenge_group_members")
      .update({ outcome })
      .eq("group_id", groupId)
      .eq("participant_id", memberId);

    await supabase
      .from("challenge_participants")
      .update({
        status: outcome === "group_winner" ? "finalist" : "eliminated",
        eliminated_round: outcome === "eliminated" ? 2 : null,
      })
      .eq("id", memberId);
  }

  await supabase
    .from("challenge_groups")
    .update({ winner_participant_id: participantId })
    .eq("id", groupId);

  revalidateBracketPaths(supabase, group.challenge_id);
}

export async function crownFlashChampionByHighestScore(challengeId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const bracket = await getChallengeBracket(challengeId);
  if (!bracket) throw new Error("Challenge not found.");
  if (!isFlashChallenge(bracket.challenge)) {
    throw new Error("This action is only for flash challenges.");
  }

  const groupWinners = bracket.round1Groups
    .map((group) => group.winner)
    .filter((winner): winner is NonNullable<typeof winner> => winner != null);

  if (groupWinners.length === 0) {
    throw new Error("Pick a group winner in every group first.");
  }

  const best = [...groupWinners].sort((a, b) => {
    const scoreA = typeof a.performance_value === "number" ? a.performance_value : -1;
    const scoreB = typeof b.performance_value === "number" ? b.performance_value : -1;
    return scoreB - scoreA;
  })[0];

  if (!best || typeof best.performance_value !== "number") {
    throw new Error("Every group winner needs a performance score before crowning.");
  }

  await setChampion(best.id);
}

/** @deprecated use setRound2GroupWinner */
export async function setGroupWinner(groupId: string, participantId: string) {
  const supabase = await createClient();
  const { data: group } = await supabase
    .from("challenge_groups")
    .select("round")
    .eq("id", groupId)
    .maybeSingle();

  if (group?.round === 1) {
    throw new Error("Use setRound1Advancers for Round 1 groups.");
  }
  if (group?.round === 2) {
    return setRound2GroupWinner(groupId, participantId);
  }
  if (group?.round === 3) {
    return setChampion(participantId);
  }
  throw new Error("Group not found.");
}

export async function createChampionFinal(challengeId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const bracket = await getChallengeBracket(challengeId);
  if (!bracket) throw new Error("Challenge not found.");

  if (!bracket.round2Groups.length) {
    throw new Error("Generate Round 2 groups first.");
  }

  const allWinners = bracket.round2Groups.every((g) =>
    g.members.some((m) => m.outcome === "group_winner")
  );
  if (!allWinners) {
    throw new Error("Pick one winner in every Round 2 group before the champion final.");
  }

  const { data: challenge } = await supabase
    .from("challenges")
    .select("round_3_zoom_at, final_zoom_url")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge) throw new Error("Challenge not found.");

  const finalistIds = bracket.round2Groups.flatMap((g) =>
    g.members.filter((m) => m.outcome === "group_winner").map((m) => m.id)
  );

  await deleteGroupsForRound(supabase, challengeId, 3);

  const { data: finalGroup, error } = await supabase
    .from("challenge_groups")
    .insert({
      challenge_id: challengeId,
      round: 3,
      group_number: 1,
      zoom_url: challenge.final_zoom_url,
      scheduled_at: challenge.round_3_zoom_at,
    })
    .select("id")
    .single();

  if (error || !finalGroup) throw new Error(error?.message ?? "Could not create champion final.");

  const { error: memberError } = await supabase.from("challenge_group_members").insert(
    finalistIds.map((participant_id) => ({
      group_id: finalGroup.id,
      participant_id,
      outcome: "pending",
    }))
  );

  if (memberError) throw new Error(memberError.message);

  await supabase
    .from("challenges")
    .update({ current_phase: 3, champion_participant_id: null })
    .eq("id", challengeId);

  revalidateBracketPaths(supabase, challengeId);
}

/** @deprecated use createChampionFinal */
export async function createFinalRound(challengeId: string) {
  return createChampionFinal(challengeId);
}

export async function setChampion(participantId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: participant } = await supabase
    .from("challenge_participants")
    .select("id, challenge_id")
    .eq("id", participantId)
    .maybeSingle();

  if (!participant) throw new Error("Participant not found.");

  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", participant.challenge_id)
    .maybeSingle();

  if (!challengeRow) throw new Error("Challenge not found.");

  if (isTransformationChallenge(challengeRow)) {
    await supabase
      .from("challenge_participants")
      .update({ status: "active", eliminated_round: null })
      .eq("challenge_id", participant.challenge_id)
      .eq("status", "champion");

    await supabase
      .from("challenge_participants")
      .update({ status: "champion", eliminated_round: null })
      .eq("id", participantId);

    await supabase
      .from("challenges")
      .update({
        champion_participant_id: participantId,
        current_phase: 4,
      })
      .eq("id", participant.challenge_id);

    revalidateBracketPaths(supabase, participant.challenge_id);
    return;
  }

  if (isFlashChallenge(challengeRow)) {
    const { data: participantRow } = await supabase
      .from("challenge_participants")
      .select("status")
      .eq("id", participantId)
      .maybeSingle();

    if (participantRow?.status !== "finalist") {
      throw new Error("Flash champion must be a group winner.");
    }

    await supabase
      .from("challenge_participants")
      .update({ status: "active", eliminated_round: null })
      .eq("challenge_id", participant.challenge_id)
      .eq("status", "champion");

    await supabase
      .from("challenge_participants")
      .update({ status: "champion", eliminated_round: null })
      .eq("id", participantId);

    await supabase
      .from("challenges")
      .update({
        champion_participant_id: participantId,
        current_phase: 4,
      })
      .eq("id", participant.challenge_id);

    revalidateBracketPaths(supabase, participant.challenge_id);
    return;
  }

  const { data: membership } = await supabase
    .from("challenge_group_members")
    .select("group_id, outcome")
    .eq("participant_id", participantId)
    .maybeSingle();

  const { data: group } = membership
    ? await supabase
        .from("challenge_groups")
        .select("id, round")
        .eq("id", membership.group_id)
        .maybeSingle()
    : { data: null };

  if (!group || group.round !== 3) {
    throw new Error("Champion must be picked from the final round group.");
  }

  const { data: finalMembers } = await supabase
    .from("challenge_group_members")
    .select("participant_id")
    .eq("group_id", group.id);

  for (const member of finalMembers ?? []) {
    const outcome = member.participant_id === participantId ? "champion" : "eliminated";
    await supabase
      .from("challenge_group_members")
      .update({ outcome })
      .eq("group_id", group.id)
      .eq("participant_id", member.participant_id);

    await supabase
      .from("challenge_participants")
      .update({
        status: outcome === "champion" ? "champion" : "eliminated",
        eliminated_round: outcome === "eliminated" ? 3 : null,
      })
      .eq("id", member.participant_id);
  }

  await supabase
    .from("challenge_groups")
    .update({ winner_participant_id: participantId })
    .eq("id", group.id);

  await supabase
    .from("challenges")
    .update({
      champion_participant_id: participantId,
      current_phase: 4,
    })
    .eq("id", participant.challenge_id);

  revalidateBracketPaths(supabase, participant.challenge_id);
}

export async function updateGroupSchedule(
  groupId: string,
  scheduledAt: string | null,
  zoomUrl: string | null
) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("challenge_groups")
    .select("challenge_id")
    .eq("id", groupId)
    .maybeSingle();

  const { error } = await supabase
    .from("challenge_groups")
    .update({
      scheduled_at: scheduledAt || null,
      zoom_url: zoomUrl?.trim() || null,
    })
    .eq("id", groupId);

  if (error) throw new Error(error.message);
  if (group) revalidateBracketPaths(supabase, group.challenge_id);
}

export async function updateGroupZoomUrl(groupId: string, zoomUrl: string) {
  return updateGroupSchedule(groupId, null, zoomUrl);
}

export async function setJudgmentDayInvite(participantId: string, invited: boolean) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: participant } = await supabase
    .from("challenge_participants")
    .select("id, challenge_id, status")
    .eq("id", participantId)
    .maybeSingle();

  if (!participant) throw new Error("Participant not found.");
  if (participant.status === "champion") {
    throw new Error("Cannot change judgment-day invite for the champion.");
  }

  const { error } = await supabase
    .from("challenge_participants")
    .update({
      status: invited ? "finalist" : "active",
      eliminated_round: null,
    })
    .eq("id", participantId);

  if (error) throw new Error(error.message);

  revalidateBracketPaths(supabase, participant.challenge_id);
}

export async function updateJudgmentDaySchedule(
  challengeId: string,
  scheduledAt: string | null,
  zoomUrl: string | null
) {
  await requireAdmin();
  const supabase = await createClient();
  const trimmed = zoomUrl?.trim() ?? "";

  const { error } = await supabase
    .from("challenges")
    .update({
      round_3_zoom_at: scheduledAt,
      final_zoom_url: trimmed || null,
    })
    .eq("id", challengeId);

  if (error) throw new Error(error.message);

  revalidateBracketPaths(supabase, challengeId);
}

export async function updateFinalZoomUrl(challengeId: string, zoomUrl: string) {
  await requireAdmin();
  const supabase = await createClient();
  const trimmed = zoomUrl.trim();

  const { error } = await supabase
    .from("challenges")
    .update({ final_zoom_url: trimmed || null })
    .eq("id", challengeId);

  if (error) throw new Error(error.message);

  await supabase
    .from("challenge_groups")
    .update({ zoom_url: trimmed || null })
    .eq("challenge_id", challengeId)
    .eq("round", 3);

  revalidateBracketPaths(supabase, challengeId);
}

export async function markPrizePaid(challengeId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("champion_participant_id")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge?.champion_participant_id) {
    throw new Error("Crown a champion before marking the prize as paid.");
  }

  const { error } = await supabase
    .from("challenges")
    .update({ prize_paid_at: new Date().toISOString() })
    .eq("id", challengeId);

  if (error) throw new Error(error.message);
  revalidateBracketPaths(supabase, challengeId);
}

export async function advanceChallengePhase(challengeId: string, phase: number) {
  await requireAdmin();
  if (phase < 0 || phase > 4) throw new Error("Invalid phase.");
  const supabase = await createClient();

  const { error } = await supabase
    .from("challenges")
    .update({ current_phase: phase })
    .eq("id", challengeId);

  if (error) throw new Error(error.message);
  revalidateBracketPaths(supabase, challengeId);
}

export async function onFlashChallengeParticipantJoined(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: string,
  participantId: string
) {
  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challengeRow?.is_flash) return;

  if (getChallengePhase(rowToChallenge(challengeRow)) > 0) {
    await assignFlashParticipantToGroup(supabase, challengeId, participantId);
  }

  revalidateBracketPaths(supabase, challengeId);
}

async function revalidateBracketPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: string
) {
  const { data } = await supabase
    .from("challenges")
    .select("slug")
    .eq("id", challengeId)
    .maybeSingle();

  revalidatePath(`/admin/challenges/${challengeId}/bracket`);
  if (data?.slug) {
    revalidatePath(`/dashboard/challenges/${data.slug}`);
  }
}
