"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireClient } from "@/lib/actions/auth";
import {
  getDemoChallengeBracket,
  isDemoChallengeId,
  isDemoChallengeSlug,
} from "@/lib/challenge-demo";
import {
  groupScheduledAt,
  ROUND1_ADVANCE_COUNT,
} from "@/lib/challenge-utils";
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
} from "@/lib/types";

function rowToParticipant(row: Record<string, unknown>): ChallengeParticipant {
  return {
    ...(row as unknown as ChallengeParticipant),
    status: (row.status as ChallengeParticipantStatus) ?? "registered",
    eliminated_round: (row.eliminated_round as 1 | 2 | 3 | null) ?? null,
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
    round_1_zoom_at: (row.round_1_zoom_at as string | null) ?? null,
    round_2_zoom_at: (row.round_2_zoom_at as string | null) ?? null,
    round_3_zoom_at: (row.round_3_zoom_at as string | null) ?? null,
    prize_paid_at: (row.prize_paid_at as string | null) ?? null,
    current_phase: (row.current_phase as Challenge["current_phase"]) ?? 0,
  };
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
  if (isDemoChallengeId(challengeId)) {
    return { error: "This is a preview challenge — registration is simulated in the bracket." };
  }
  const profile = await requireClient();
  if (!hasEliteAccess(profile)) {
    return { error: "Elite membership is required to join community challenges." };
  }

  const supabase = await createClient();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, slug, published, current_phase")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge?.published) {
    return { error: "Challenge not found." };
  }

  if ((challenge.current_phase ?? 0) > 0) {
    return { error: "Registration is closed — the tournament has already started." };
  }

  const { error } = await supabase.from("challenge_participants").insert({
    challenge_id: challengeId,
    user_id: profile.id,
    display_name: profile.full_name?.trim() || "Participant",
    status: "active",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You are already registered." };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/challenges/${challenge.slug}`);
  revalidatePath("/dashboard/classes");
  revalidatePath(`/admin/challenges/${challengeId}/bracket`);
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
  }[] = [];

  if (groupIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("challenge_group_members")
      .select("group_id, participant_id, outcome")
      .in("group_id", groupIds);
    members = (memberRows ?? []).map((m) => ({
      group_id: m.group_id,
      participant_id: m.participant_id,
      outcome: (m.outcome as ChallengeMemberOutcome) ?? "pending",
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
  if (isDemoChallengeSlug(slug)) {
    return getDemoChallengeBracket(userId);
  }

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
  if (isDemoChallengeId(challengeId)) {
    throw new Error("Demo challenge bracket is read-only.");
  }
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
    .select("id")
    .eq("challenge_id", challengeId)
    .in("status", ["registered", "active"])
    .order("created_at", { ascending: true });

  const ids = (participants ?? []).map((p) => p.id);
  if (ids.length === 0) throw new Error("Add participants before generating groups.");

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
  if (isDemoChallengeId(challengeId)) {
    throw new Error("Demo challenge bracket is read-only.");
  }
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
  if (isDemoChallengeId(challengeId)) {
    throw new Error("Demo challenge bracket is read-only.");
  }
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
