"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import type { ChallengeAnnouncement } from "@/lib/types";

function rowToAnnouncement(row: Record<string, unknown>): ChallengeAnnouncement {
  return {
    id: String(row.id),
    challenge_id: String(row.challenge_id),
    title: String(row.title),
    body: String(row.body ?? ""),
    published: Boolean(row.published),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getChallengeAnnouncements(
  challengeId: string,
  { includeUnpublished = false }: { includeUnpublished?: boolean } = {}
): Promise<ChallengeAnnouncement[]> {
  const supabase = await createClient();
  let query = supabase
    .from("challenge_announcements")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: false });

  if (!includeUnpublished) {
    query = query.eq("published", true);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map(rowToAnnouncement);
}

export async function getChallengeAnnouncementsBySlug(
  slug: string
): Promise<ChallengeAnnouncement[]> {
  const supabase = await createClient();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!challenge?.id) return [];
  return getChallengeAnnouncements(challenge.id);
}

export async function createChallengeAnnouncement(
  challengeId: string,
  formData: FormData
): Promise<{ error?: string }> {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const published = formData.get("published") === "on";

  if (!title) return { error: "Title is required." };
  if (!body) return { error: "Message is required." };

  const supabase = await createClient();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("slug")
    .eq("id", challengeId)
    .maybeSingle();

  const { error } = await supabase.from("challenge_announcements").insert({
    challenge_id: challengeId,
    title,
    body,
    published,
  });

  if (error) return { error: error.message };

  revalidateChallengePaths(challengeId, challenge?.slug);
  return {};
}

export async function deleteChallengeAnnouncement(
  announcementId: string,
  challengeId: string
): Promise<{ error?: string }> {
  await requireAdmin();

  const supabase = await createClient();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("slug")
    .eq("id", challengeId)
    .maybeSingle();

  const { error } = await supabase
    .from("challenge_announcements")
    .delete()
    .eq("id", announcementId)
    .eq("challenge_id", challengeId);

  if (error) return { error: error.message };

  revalidateChallengePaths(challengeId, challenge?.slug);
  return {};
}

function revalidateChallengePaths(challengeId: string, slug?: string | null) {
  revalidatePath(`/admin/challenges/${challengeId}/edit`);
  if (slug) {
    revalidatePath(`/dashboard/challenges/${slug}`);
  }
}
