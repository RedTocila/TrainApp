"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDemoChallengeBySlug,
  getDemoChallenges,
  isDemoChallengeId,
} from "@/lib/challenge-demo";
import type { Challenge } from "@/lib/types";

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

function rowToChallenge(row: Record<string, unknown>): Challenge {
  return row as unknown as Challenge;
}

function mergeWithDemoChallenges(dbChallenges: Challenge[]): Challenge[] {
  const dbSlugs = new Set(dbChallenges.map((c) => c.slug));
  const demos = getDemoChallenges().filter((d) => !dbSlugs.has(d.slug));
  return [...dbChallenges, ...demos].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
  );
}

export async function getPublishedChallenges(): Promise<Challenge[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("published", true)
    .order("scheduled_at", { ascending: false });

  if (error) return getDemoChallenges();
  return mergeWithDemoChallenges((data ?? []).map(rowToChallenge));
}

export async function getAllChallenges(): Promise<Challenge[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("challenges")
    .select("*")
    .order("scheduled_at", { ascending: false });

  return (data ?? []).map(rowToChallenge);
}

export async function getChallengeBySlug(slug: string): Promise<Challenge | null> {
  const demo = getDemoChallengeBySlug(slug);
  if (demo) return demo;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.published) return null;
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
  const duration_minutes = parseDuration(formData.get("duration_minutes"));
  const group_size = Number.parseInt(String(formData.get("group_size") ?? "10"), 10);
  const final_zoom_url = String(formData.get("final_zoom_url") ?? "").trim() || null;
  const published = formData.get("published") === "on";

  if (!title || !slug) throw new Error("Title and slug are required.");
  if (!Number.isFinite(group_size) || group_size <= 0) {
    throw new Error("Group size must be a positive number.");
  }

  const { error } = await supabase.from("challenges").insert({
    title,
    slug,
    description,
    scheduled_at,
    duration_minutes,
    group_size,
    final_zoom_url,
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
  const duration_minutes = parseDuration(formData.get("duration_minutes"));
  const group_size = Number.parseInt(String(formData.get("group_size") ?? "10"), 10);
  const final_zoom_url = String(formData.get("final_zoom_url") ?? "").trim() || null;
  const published = formData.get("published") === "on";

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
      duration_minutes,
      group_size,
      final_zoom_url,
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
