"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

function slugToRoomName(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
}

export async function getPublishedChallenges(): Promise<Challenge[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("published", true)
    .order("scheduled_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map(rowToChallenge);
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
  const room_name =
    String(formData.get("room_name") ?? "").trim() || slugToRoomName(slug);
  const published = formData.get("published") === "on";

  if (!title || !slug) throw new Error("Title and slug are required.");

  const { error } = await supabase.from("challenges").insert({
    title,
    slug,
    description,
    scheduled_at,
    duration_minutes,
    room_name,
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
  const room_name =
    String(formData.get("room_name") ?? "").trim() || slugToRoomName(slug);
  const published = formData.get("published") === "on";

  if (!title || !slug) throw new Error("Title and slug are required.");

  const { error } = await supabase
    .from("challenges")
    .update({
      title,
      slug,
      description,
      scheduled_at,
      duration_minutes,
      room_name,
      published,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/challenges");
  revalidatePath("/dashboard/classes");
  redirect("/admin/challenges");
}

export async function deleteChallenge(id: string) {
  const supabase = await createClient();
  await supabase.from("challenges").delete().eq("id", id);
  revalidatePath("/admin/challenges");
  revalidatePath("/dashboard/classes");
}
