"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireClient } from "@/lib/actions/auth";
import {
  getDemoChallengeBracket,
  isDemoChallengeId,
  isDemoChallengeSlug,
} from "@/lib/challenge-demo";
import type {
  Challenge,
  ChallengeBracketData,
  ChallengeBracketGroup,
  ChallengeBracketParticipant,
  ChallengeGroup,
  ChallengeParticipant,
} from "@/lib/types";

function rowToParticipant(row: Record<string, unknown>): ChallengeParticipant {
  return row as unknown as ChallengeParticipant;
}

function rowToGroup(row: Record<string, unknown>): ChallengeGroup {
  return row as unknown as ChallengeGroup;
}

export async function registerForChallenge(challengeId: string) {
  if (isDemoChallengeId(challengeId)) {
    return { error: "This is a preview challenge — registration is simulated in the bracket." };
  }
  const profile = await requireClient();
  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, slug, published")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge?.published) {
    return { error: "Challenge not found." };
  }

  const { error } = await supabase.from("challenge_participants").insert({
    challenge_id: challengeId,
    user_id: profile.id,
    display_name: profile.full_name?.trim() || "Participant",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You are already registered." };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/challenges/${challenge.slug}`);
  revalidatePath(`/admin/challenges/${challengeId}/bracket`);
  return { success: true };
}

export async function getChallengeBracket(
  challengeId: string,
  userId?: string | null
): Promise<ChallengeBracketData | null> {
  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge) return null;

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
  let members: { group_id: string; participant_id: string }[] = [];

  if (groupIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("challenge_group_members")
      .select("group_id, participant_id")
      .in("group_id", groupIds);
    members = memberRows ?? [];
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
    const memberIds = members
      .filter((m) => m.group_id === group.id)
      .map((m) => m.participant_id);

    const groupMembers: ChallengeBracketParticipant[] = memberIds
      .map((id) => participantById.get(id))
      .filter((p): p is ChallengeParticipant => !!p)
      .map((p) => ({
        ...p,
        is_champion: p.id === challenge.champion_participant_id,
        is_group_winner: p.id === group.winner_participant_id,
        group_id: group.id,
        group_number: group.group_number,
        round: group.round,
      }));

    const winner = group.winner_participant_id
      ? groupMembers.find((m) => m.id === group.winner_participant_id) ?? null
      : null;

    return {
      ...group,
      members: groupMembers,
      winner,
    };
  };

  const groupStage = (groups ?? [])
    .filter((g) => g.round === 1)
    .map((g) => buildGroup(rowToGroup(g)));

  const finalGroupRow = (groups ?? []).find((g) => g.round === 2);
  const finalRound = finalGroupRow ? buildGroup(rowToGroup(finalGroupRow)) : null;

  return {
    challenge: challenge as unknown as Challenge,
    participants: participantList,
    groupStage,
    finalRound,
    champion,
    currentUserParticipantId,
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

export async function generateChallengeGroups(challengeId: string) {
  if (isDemoChallengeId(challengeId)) {
    throw new Error("Demo challenge bracket is read-only.");
  }
  await requireAdmin();
  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, slug, group_size")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge) throw new Error("Challenge not found.");

  const { data: participants } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true });

  const ids = (participants ?? []).map((p) => p.id);
  if (ids.length === 0) throw new Error("Add participants before generating groups.");

  const groupSize = challenge.group_size || 10;
  const groupCount = Math.ceil(ids.length / groupSize);

  const { data: roundOneGroups } = await supabase
    .from("challenge_groups")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("round", 1);

  const roundOneIds = (roundOneGroups ?? []).map((g) => g.id);
  if (roundOneIds.length > 0) {
    await supabase.from("challenge_group_members").delete().in("group_id", roundOneIds);
    await supabase.from("challenge_groups").delete().in("id", roundOneIds);
  }

  for (let i = 0; i < groupCount; i++) {
    const slice = ids.slice(i * groupSize, (i + 1) * groupSize);
    const { data: group, error } = await supabase
      .from("challenge_groups")
      .insert({
        challenge_id: challengeId,
        round: 1,
        group_number: i + 1,
      })
      .select("id")
      .single();

    if (error || !group) throw new Error(error?.message ?? "Could not create group.");

    const { error: memberError } = await supabase.from("challenge_group_members").insert(
      slice.map((participant_id) => ({
        group_id: group.id,
        participant_id,
      }))
    );

    if (memberError) throw new Error(memberError.message);
  }

  revalidatePath(`/admin/challenges/${challengeId}/bracket`);
  revalidatePath(`/dashboard/challenges/${challenge.slug}`);
}

export async function updateGroupZoomUrl(groupId: string, zoomUrl: string) {
  await requireAdmin();
  const supabase = await createClient();
  const trimmed = zoomUrl.trim();

  const { data: group } = await supabase
    .from("challenge_groups")
    .select("challenge_id")
    .eq("id", groupId)
    .maybeSingle();

  const { error } = await supabase
    .from("challenge_groups")
    .update({ zoom_url: trimmed || null })
    .eq("id", groupId);

  if (error) throw new Error(error.message);
  if (group) {
    revalidateBracketPaths(supabase, group.challenge_id);
  }
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
  revalidateBracketPaths(supabase, challengeId);
}

export async function setGroupWinner(groupId: string, participantId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("challenge_groups")
    .select("id, challenge_id, round")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) throw new Error("Group not found.");

  const { data: membership } = await supabase
    .from("challenge_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (!membership) throw new Error("Participant is not in this group.");

  const { error } = await supabase
    .from("challenge_groups")
    .update({ winner_participant_id: participantId })
    .eq("id", groupId);

  if (error) throw new Error(error.message);

  if (group.round === 2) {
    await supabase
      .from("challenges")
      .update({ champion_participant_id: participantId })
      .eq("id", group.challenge_id);
  }

  revalidateBracketPaths(supabase, group.challenge_id);
}

export async function createFinalRound(challengeId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, slug")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge) throw new Error("Challenge not found.");

  const { data: groupStage } = await supabase
    .from("challenge_groups")
    .select("id, winner_participant_id, group_number")
    .eq("challenge_id", challengeId)
    .eq("round", 1)
    .order("group_number", { ascending: true });

  const winners = (groupStage ?? [])
    .map((g) => g.winner_participant_id)
    .filter((id): id is string => !!id);

  if (winners.length === 0) {
    throw new Error("Pick a winner in each group before creating the final round.");
  }

  if (winners.length !== (groupStage ?? []).length) {
    throw new Error("Every group needs a winner before the final round.");
  }

  await supabase
    .from("challenge_groups")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("round", 2);

  const { data: finalGroup, error } = await supabase
    .from("challenge_groups")
    .insert({
      challenge_id: challengeId,
      round: 2,
      group_number: 1,
      zoom_url: null,
    })
    .select("id")
    .single();

  if (error || !finalGroup) throw new Error(error?.message ?? "Could not create final round.");

  const { error: memberError } = await supabase.from("challenge_group_members").insert(
    winners.map((participant_id) => ({
      group_id: finalGroup.id,
      participant_id,
    }))
  );

  if (memberError) throw new Error(memberError.message);

  await supabase
    .from("challenges")
    .update({ champion_participant_id: null })
    .eq("id", challengeId);

  revalidatePath(`/admin/challenges/${challengeId}/bracket`);
  revalidatePath(`/dashboard/challenges/${challenge.slug}`);
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
