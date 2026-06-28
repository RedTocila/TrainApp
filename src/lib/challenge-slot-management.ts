import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChallengeSeries } from "@/lib/challenge-series";
import { getChallengeMaxParticipants } from "@/lib/challenge-series";
import type { Challenge } from "@/lib/types";

type ChallengeRow = Pick<
  Challenge,
  "id" | "slug" | "max_participants" | "is_transformation" | "is_flash"
>;

function nestedChallenge(
  value: unknown
): {
  id: string;
  slug: string;
  max_participants?: number | null;
  is_transformation?: boolean;
  is_flash?: boolean;
} | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return (value[0] as {
      id: string;
      slug: string;
      max_participants?: number | null;
      is_transformation?: boolean;
      is_flash?: boolean;
    }) ?? null;
  }
  return value as {
    id: string;
    slug: string;
    max_participants?: number | null;
    is_transformation?: boolean;
    is_flash?: boolean;
  };
}

function matchesSeries(
  challenge: { is_transformation?: boolean; is_flash?: boolean },
  series: ChallengeSeries
): boolean {
  return series === "flash" ? challenge.is_flash === true : challenge.is_transformation === true;
}

export async function countChallengeParticipants(
  supabase: SupabaseClient,
  challengeId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("challenge_participants")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function promoteNextFromWaitlist(
  supabase: SupabaseClient,
  challenge: ChallengeRow
): Promise<{ promotedUserId: string | null }> {
  const max = getChallengeMaxParticipants(challenge);
  if (max == null) return { promotedUserId: null };

  const participantCount = await countChallengeParticipants(supabase, challenge.id);
  if (participantCount >= max) return { promotedUserId: null };

  const { data: nextWaiter } = await supabase
    .from("challenge_waitlist")
    .select("id, user_id")
    .eq("challenge_id", challenge.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextWaiter) return { promotedUserId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, subscription_plan, subscription_status, subscription_expires_at")
    .eq("id", nextWaiter.user_id)
    .maybeSingle();

  const hasActiveElite =
    profile?.subscription_plan === "elite" &&
    profile.subscription_status === "active" &&
    (profile.subscription_expires_at == null ||
      new Date(profile.subscription_expires_at) > new Date());

  await supabase.from("challenge_waitlist").delete().eq("id", nextWaiter.id);

  if (!hasActiveElite) {
    return promoteNextFromWaitlist(supabase, challenge);
  }

  const { error: insertError } = await supabase.from("challenge_participants").insert({
    challenge_id: challenge.id,
    user_id: nextWaiter.user_id,
    display_name: profile?.full_name?.trim() || "Participant",
    status: "active",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return promoteNextFromWaitlist(supabase, challenge);
    }
    throw new Error(insertError.message);
  }

  return { promotedUserId: nextWaiter.user_id };
}

export async function removeParticipantAndPromote(
  supabase: SupabaseClient,
  challenge: ChallengeRow,
  userId: string
): Promise<void> {
  await supabase
    .from("challenge_participants")
    .delete()
    .eq("challenge_id", challenge.id)
    .eq("user_id", userId);

  if (challenge.is_transformation || challenge.is_flash) {
    await promoteNextFromWaitlist(supabase, challenge);
  }
}

export async function leaveOtherSeriesChallenges(
  supabase: SupabaseClient,
  userId: string,
  series: ChallengeSeries,
  exceptChallengeId: string
): Promise<void> {
  const { data: memberships } = await supabase
    .from("challenge_participants")
    .select("challenge_id, challenges!inner(id, slug, max_participants, is_transformation, is_flash)")
    .eq("user_id", userId)
    .neq("challenge_id", exceptChallengeId);

  for (const row of memberships ?? []) {
    const challenge = nestedChallenge(row.challenges);
    if (!challenge || !matchesSeries(challenge, series)) continue;
    await removeParticipantAndPromote(
      supabase,
      {
        id: row.challenge_id,
        slug: challenge.slug,
        max_participants: challenge.max_participants ?? null,
        is_transformation: challenge.is_transformation === true,
        is_flash: challenge.is_flash === true,
      },
      userId
    );
  }

  const { data: waitlistRows } = await supabase
    .from("challenge_waitlist")
    .select(`id, challenge_id, challenges!inner(is_transformation, is_flash)`)
    .eq("user_id", userId)
    .neq("challenge_id", exceptChallengeId);

  for (const row of waitlistRows ?? []) {
    const challenge = nestedChallenge(row.challenges);
    if (!challenge || !matchesSeries(challenge, series)) continue;
    await supabase.from("challenge_waitlist").delete().eq("id", row.id);
  }
}

/** @deprecated use leaveOtherSeriesChallenges */
export async function leaveOtherTransformationChallenges(
  supabase: SupabaseClient,
  userId: string,
  exceptChallengeId: string
): Promise<void> {
  return leaveOtherSeriesChallenges(supabase, userId, "transformation", exceptChallengeId);
}

export async function removeIneligibleSeriesParticipants(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_plan, subscription_status, subscription_expires_at")
    .eq("id", userId)
    .maybeSingle();

  const hasActiveElite =
    profile?.subscription_plan === "elite" &&
    profile.subscription_status === "active" &&
    (profile.subscription_expires_at == null ||
      new Date(profile.subscription_expires_at) > new Date());

  if (hasActiveElite) return;

  const { data: memberships } = await supabase
    .from("challenge_participants")
    .select("challenge_id, challenges!inner(id, slug, max_participants, is_transformation, is_flash)")
    .eq("user_id", userId);

  for (const row of memberships ?? []) {
    const challenge = nestedChallenge(row.challenges);
    if (!challenge?.is_transformation && !challenge?.is_flash) continue;
    await removeParticipantAndPromote(
      supabase,
      {
        id: row.challenge_id,
        slug: challenge.slug,
        max_participants: challenge.max_participants ?? null,
        is_transformation: challenge.is_transformation === true,
        is_flash: challenge.is_flash === true,
      },
      userId
    );
  }

  await supabase.from("challenge_waitlist").delete().eq("user_id", userId);
}

/** @deprecated use removeIneligibleSeriesParticipants */
export async function removeIneligibleTransformationParticipants(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  return removeIneligibleSeriesParticipants(supabase, userId);
}
