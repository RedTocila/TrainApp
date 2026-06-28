"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isDemoChallengeId,
  isDemoChallengeSlug,
} from "@/lib/challenge-demo";
import { suggestChallengeZoomDates } from "@/lib/challenge-utils";
import {
  ensureFlashChallengesInDb,
  getFlashChallengeBySlug,
  mergeFlashChallenges,
} from "@/lib/flash-challenge-catalog";
import {
  ensureTransformationChallengesInDb,
  getTransformationChallengeBySlug,
  mergeTransformationChallenges,
} from "@/lib/transformation-challenge-catalog";

import type { Challenge } from "@/lib/types";

export async function ensureCatalogChallengesInDb(): Promise<void> {
  await Promise.all([ensureTransformationChallengesInDb(), ensureFlashChallengesInDb()]);
}

function parseScheduledAt(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Scheduled date and time are required.");
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid scheduled date.");
  return parsed.toISOString();
}

function parseDuration(value: FormDataEntryValue | null): number {
  const duration = Number.parseInt(String(value ?? "60"), 10);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Duration must be a positive number of minutes.");
  }
  return duration;
}

function parsePrizePoolCentsPerParticipant(value: FormDataEntryValue | null): number {
  const euros = Number.parseFloat(String(value ?? "10"));
  if (!Number.isFinite(euros) || euros < 0) {
    throw new Error("Prize pool contribution per participant must be zero or greater.");
  }
  return Math.round(euros * 100);
}

function parseDurationMonths(value: FormDataEntryValue | null): number {
  const months = Number.parseInt(String(value ?? "3"), 10);
  if (!Number.isFinite(months) || months < 1) {
    throw new Error("Tournament duration must be at least 1 month.");
  }
  if (months > 24) {
    throw new Error("Tournament duration cannot exceed 24 months.");
  }
  return months;
}

function parseOptionalScheduledAt(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid scheduled date.");
  return parsed.toISOString();
}

function parseRegistrationWindow(
  formData: FormData,
  scheduled_at: string
): { registration_opens_at: string | null; registration_closes_at: string | null } {
  const registration_opens_at = parseOptionalScheduledAt(formData.get("registration_opens_at"));
  const registration_closes_at =
    parseOptionalScheduledAt(formData.get("registration_closes_at")) ?? scheduled_at;

  if (registration_opens_at && registration_closes_at <= registration_opens_at) {
    throw new Error("Registration must close after it opens.");
  }

  if (registration_closes_at > scheduled_at) {
    throw new Error("Registration must close on or before the challenge start time.");
  }

  return { registration_opens_at, registration_closes_at };
}

function rowToChallenge(row: Record<string, unknown>): Challenge {
  return {
    ...(row as unknown as Challenge),
    prize_pool_cents_per_participant:
      typeof row.prize_pool_cents_per_participant === "number"
        ? row.prize_pool_cents_per_participant
        : 1000,
    duration_months:
      typeof row.duration_months === "number" ? row.duration_months : 3,
    duration_days: typeof row.duration_days === "number" ? row.duration_days : null,
    max_participants:
      typeof row.max_participants === "number" ? row.max_participants : null,
    is_transformation: row.is_transformation === true,
    is_flash: row.is_flash === true,
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

async function attachParticipantCounts(challenges: Challenge[]): Promise<Challenge[]> {
  if (challenges.length === 0) return challenges;

  const supabase = await createClient();
  const dbIds = challenges.map((c) => c.id);

  const counts = new Map<string, number>();
  if (dbIds.length > 0) {
    const { data } = await supabase
      .from("challenge_participants")
      .select("challenge_id")
      .in("challenge_id", dbIds);

    for (const row of data ?? []) {
      counts.set(row.challenge_id, (counts.get(row.challenge_id) ?? 0) + 1);
    }
  }

  return challenges.map((challenge) => ({
    ...challenge,
    participant_count: counts.get(challenge.id) ?? 0,
  }));
}

function mergeCatalogChallenges(dbChallenges: Challenge[]): Challenge[] {
  const filtered = dbChallenges.filter((c) => !isDemoChallengeSlug(c.slug));
  const transformation = mergeTransformationChallenges(filtered);
  const flash = mergeFlashChallenges(filtered);
  return [...transformation, ...flash];
}

export async function getPublishedChallenges(): Promise<Challenge[]> {
  await ensureCatalogChallengesInDb();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("published", true)
    .order("scheduled_at", { ascending: false });

  if (error) {
    return attachParticipantCounts(mergeCatalogChallenges([]));
  }
  const merged = mergeCatalogChallenges((data ?? []).map(rowToChallenge));
  return attachParticipantCounts(merged);
}

export async function getAllChallenges(): Promise<Challenge[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("challenges")
    .select("*")
    .order("scheduled_at", { ascending: false });

  return attachParticipantCounts((data ?? []).map(rowToChallenge));
}

export async function getChallengeBySlug(slug: string): Promise<Challenge | null> {
  if (isDemoChallengeSlug(slug)) return null;

  const catalog = getTransformationChallengeBySlug(slug) ?? getFlashChallengeBySlug(slug);

  await ensureCatalogChallengesInDb();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return catalog?.published ? catalog : null;
  }
  if (!data.published) return catalog?.published ? catalog : null;
  return rowToChallenge(data);
}

export async function getChallengeById(id: string): Promise<Challenge | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return rowToChallenge(data);
}

export async function createChallenge(formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const scheduled_at = parseScheduledAt(formData.get("scheduled_at"));
  const { registration_opens_at, registration_closes_at } = parseRegistrationWindow(
    formData,
    scheduled_at
  );
  const duration_minutes = parseDuration(formData.get("duration_minutes"));
  const duration_months = parseDurationMonths(formData.get("duration_months"));
  const group_size = Number.parseInt(String(formData.get("group_size") ?? "10"), 10);
  const final_zoom_url = String(formData.get("final_zoom_url") ?? "").trim() || null;
  const prize_pool_cents_per_participant = parsePrizePoolCentsPerParticipant(
    formData.get("prize_pool_euros_per_participant")
  );
  const published = formData.get("published") === "on";
  const suggested = suggestChallengeZoomDates(scheduled_at, duration_months);
  const round_1_zoom_at =
    parseOptionalScheduledAt(formData.get("round_1_zoom_at")) ?? suggested.round_1_zoom_at;
  const round_2_zoom_at =
    parseOptionalScheduledAt(formData.get("round_2_zoom_at")) ?? suggested.round_2_zoom_at;
  const round_3_zoom_at =
    parseOptionalScheduledAt(formData.get("round_3_zoom_at")) ?? suggested.round_3_zoom_at;

  if (!title || !slug) throw new Error("Title and slug are required.");
  if (!Number.isFinite(group_size) || group_size <= 0) {
    throw new Error("Group size must be a positive number.");
  }

  const { error } = await supabase.from("challenges").insert({
    title,
    slug,
    description,
    scheduled_at,
    registration_opens_at,
    registration_closes_at,
    duration_minutes,
    duration_months,
    group_size,
    final_zoom_url,
    prize_pool_cents_per_participant,
    round_1_zoom_at,
    round_2_zoom_at,
    round_3_zoom_at,
    published,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/challenges");
  revalidatePath("/dashboard/classes");
  redirect("/admin/challenges");
}

export async function updateChallenge(id: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const scheduled_at = parseScheduledAt(formData.get("scheduled_at"));
  const { registration_opens_at, registration_closes_at } = parseRegistrationWindow(
    formData,
    scheduled_at
  );
  const duration_minutes = parseDuration(formData.get("duration_minutes"));
  const duration_months = parseDurationMonths(formData.get("duration_months"));
  const group_size = Number.parseInt(String(formData.get("group_size") ?? "10"), 10);
  const final_zoom_url = String(formData.get("final_zoom_url") ?? "").trim() || null;
  const prize_pool_cents_per_participant = parsePrizePoolCentsPerParticipant(
    formData.get("prize_pool_euros_per_participant")
  );
  const published = formData.get("published") === "on";
  const round_1_zoom_at = parseOptionalScheduledAt(formData.get("round_1_zoom_at"));
  const round_2_zoom_at = parseOptionalScheduledAt(formData.get("round_2_zoom_at"));
  const round_3_zoom_at = parseOptionalScheduledAt(formData.get("round_3_zoom_at"));

  if (!title || !slug) throw new Error("Title and slug are required.");
  if (!Number.isFinite(group_size) || group_size <= 0) {
    throw new Error("Group size must be a positive number.");
  }

  const { error } = await supabase
    .from("challenges")
    .update({
      title,
      slug,
      description,
      scheduled_at,
      registration_opens_at,
      registration_closes_at,
      duration_minutes,
      duration_months,
      group_size,
      final_zoom_url,
      prize_pool_cents_per_participant,
      round_1_zoom_at,
      round_2_zoom_at,
      round_3_zoom_at,
      published,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/challenges");
  revalidatePath("/dashboard/classes");
  redirect("/admin/challenges");
}

export async function deleteChallenge(id: string) {
  if (isDemoChallengeId(id)) return;
  const supabase = await createClient();
  await supabase.from("challenges").delete().eq("id", id);
  revalidatePath("/admin/challenges");
  revalidatePath("/dashboard/classes");
}
