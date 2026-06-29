import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChallengeSeries } from "@/lib/challenge-series";
import {
  getChallengeMaxParticipants,
  isFlashChallenge,
  isTransformationChallenge,
} from "@/lib/challenge-series";
import { getChallengeStatus } from "@/lib/challenge-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Challenge } from "@/lib/types";

export type ActiveSeriesMembership = {
  challenge_id: string;
  challenge_slug: string;
  challenge_title: string;
};

const SERIES_CHALLENGE_SELECT =
  "id, slug, title, scheduled_at, duration_months, duration_days, registration_closes_at, is_transformation, is_flash, max_participants";

type ChallengeRow = Pick<
  Challenge,
  "id" | "slug" | "max_participants" | "is_transformation" | "is_flash"
>;

type SeriesChallengeRow = {
  id: string;
  slug: string;
  title: string;
  scheduled_at?: string;
  duration_months?: number;
  duration_days?: number | null;
  registration_closes_at?: string | null;
  is_transformation?: boolean;
  is_flash?: boolean;
  max_participants?: number | null;
};

function matchesSeries(
  challenge: Pick<Challenge, "slug" | "is_transformation" | "is_flash">,
  series: ChallengeSeries
): boolean {
  return series === "flash"
    ? isFlashChallenge(challenge)
    : isTransformationChallenge(challenge);
}

function rowToSeriesChallenge(row: SeriesChallengeRow): Challenge {
  return {
    scheduled_at: row.scheduled_at ?? new Date(0).toISOString(),
    duration_months: typeof row.duration_months === "number" ? row.duration_months : 3,
    duration_days: typeof row.duration_days === "number" ? row.duration_days : null,
    is_transformation: isTransformationChallenge(row),
    is_flash: isFlashChallenge(row),
    registration_closes_at: row.registration_closes_at ?? null,
    slug: row.slug,
  } as Challenge;
}

function isActiveSeriesChallenge(challenge: Challenge): boolean {
  return getChallengeStatus(challenge) !== "ended";
}

function toActiveMembership(
  challengeId: string,
  challenge: { slug: string; title: string }
): ActiveSeriesMembership {
  return {
    challenge_id: challengeId,
    challenge_slug: challenge.slug,
    challenge_title: challenge.title,
  };
}

async function loadSeriesChallengesByIds(
  challengeIds: string[]
): Promise<SeriesChallengeRow[]> {
  if (challengeIds.length === 0) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("challenges")
    .select(SERIES_CHALLENGE_SELECT)
    .in("id", challengeIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as SeriesChallengeRow[];
}

export async function findActiveSeriesParticipant(
  supabase: SupabaseClient,
  userId: string,
  series: ChallengeSeries,
  exceptChallengeId?: string
): Promise<ActiveSeriesMembership | null> {
  void supabase;

  const admin = createAdminClient();
  const { data: memberships, error } = await admin
    .from("challenge_participants")
    .select("challenge_id")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const challengeIds = (memberships ?? [])
    .map((row) => row.challenge_id)
    .filter((id) => !exceptChallengeId || id !== exceptChallengeId);

  const challenges = await loadSeriesChallengesByIds(challengeIds);
  const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));

  for (const challengeId of challengeIds) {
    const nested = challengeById.get(challengeId);
    if (!nested || !matchesSeries(nested, series)) continue;
    const challenge = rowToSeriesChallenge(nested);
    if (!isActiveSeriesChallenge(challenge)) continue;
    return toActiveMembership(challengeId, nested);
  }

  return null;
}

export async function findActiveSeriesWaitlistEntry(
  supabase: SupabaseClient,
  userId: string,
  series: ChallengeSeries,
  exceptChallengeId?: string
): Promise<ActiveSeriesMembership | null> {
  void supabase;

  const admin = createAdminClient();
  const { data: waitlistRows, error } = await admin
    .from("challenge_waitlist")
    .select("challenge_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const challengeIds = (waitlistRows ?? [])
    .map((row) => row.challenge_id)
    .filter((id) => !exceptChallengeId || id !== exceptChallengeId);

  const challenges = await loadSeriesChallengesByIds(challengeIds);
  const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));

  for (const challengeId of challengeIds) {
    const nested = challengeById.get(challengeId);
    if (!nested || !matchesSeries(nested, series)) continue;
    const challenge = rowToSeriesChallenge(nested);
    if (!isActiveSeriesChallenge(challenge)) continue;
    return toActiveMembership(challengeId, nested);
  }

  return null;
}

export async function getLongChallengeJoinBlockReason(
  supabase: SupabaseClient,
  userId: string,
  targetChallengeId: string
): Promise<string | null> {
  const participant = await findActiveSeriesParticipant(
    supabase,
    userId,
    "transformation",
    targetChallengeId
  );
  if (participant) {
    return `You are already in ${participant.challenge_title}. Leave that challenge or wait until it finishes before joining another long challenge.`;
  }

  const waitlist = await findActiveSeriesWaitlistEntry(
    supabase,
    userId,
    "transformation",
    targetChallengeId
  );
  if (waitlist) {
    return `You are on the waitlist for ${waitlist.challenge_title}. Leave that waitlist before joining another long challenge.`;
  }

  return null;
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

  if (isTransformationChallenge(challenge)) {
    const blocking = await findActiveSeriesParticipant(
      supabase,
      nextWaiter.user_id,
      "transformation",
      challenge.id
    );
    if (blocking) {
      return promoteNextFromWaitlist(supabase, challenge);
    }
  }

  const { error: insertError } = await supabase.from("challenge_participants").insert({
    challenge_id: challenge.id,
    user_id: nextWaiter.user_id,
    display_name: profile?.full_name?.trim() || "Participant",
    status: "active",
    ...(isFlashChallenge(challenge) ? { entry_fee_paid_at: null } : {}),
  });

  if (insertError) {
    if (insertError.code === "23505" || insertError.code === "23514") {
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

  if (isTransformationChallenge(challenge) || isFlashChallenge(challenge)) {
    await promoteNextFromWaitlist(supabase, challenge);
  }
}

export async function leaveOtherSeriesChallenges(
  supabase: SupabaseClient,
  userId: string,
  series: ChallengeSeries,
  exceptChallengeId: string
): Promise<void> {
  const admin = createAdminClient();
  const { data: memberships, error } = await admin
    .from("challenge_participants")
    .select("challenge_id")
    .eq("user_id", userId)
    .neq("challenge_id", exceptChallengeId);

  if (error) throw new Error(error.message);

  const challengeIds = (memberships ?? []).map((row) => row.challenge_id);
  const challenges = await loadSeriesChallengesByIds(challengeIds);
  const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));

  for (const row of memberships ?? []) {
    const challenge = challengeById.get(row.challenge_id);
    if (!challenge || !matchesSeries(challenge, series)) continue;
    await removeParticipantAndPromote(
      supabase,
      {
        id: row.challenge_id,
        slug: challenge.slug,
        max_participants: challenge.max_participants ?? null,
        is_transformation: isTransformationChallenge(challenge),
        is_flash: isFlashChallenge(challenge),
      },
      userId
    );
  }

  const { data: waitlistRows, error: waitlistError } = await admin
    .from("challenge_waitlist")
    .select("id, challenge_id")
    .eq("user_id", userId)
    .neq("challenge_id", exceptChallengeId);

  if (waitlistError) throw new Error(waitlistError.message);

  const waitlistChallengeIds = (waitlistRows ?? []).map((row) => row.challenge_id);
  const waitlistChallenges = await loadSeriesChallengesByIds(waitlistChallengeIds);
  const waitlistChallengeById = new Map(
    waitlistChallenges.map((challenge) => [challenge.id, challenge])
  );

  for (const row of waitlistRows ?? []) {
    const challenge = waitlistChallengeById.get(row.challenge_id);
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

  const admin = createAdminClient();
  const { data: memberships, error } = await admin
    .from("challenge_participants")
    .select("challenge_id")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const challengeIds = (memberships ?? []).map((row) => row.challenge_id);
  const challenges = await loadSeriesChallengesByIds(challengeIds);
  const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));

  for (const row of memberships ?? []) {
    const challenge = challengeById.get(row.challenge_id);
    if (!challenge || !isTransformationChallenge(challenge) && !isFlashChallenge(challenge)) {
      continue;
    }
    await removeParticipantAndPromote(
      supabase,
      {
        id: row.challenge_id,
        slug: challenge.slug,
        max_participants: challenge.max_participants ?? null,
        is_transformation: isTransformationChallenge(challenge),
        is_flash: isFlashChallenge(challenge),
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
