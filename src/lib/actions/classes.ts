"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDemoClassBySlug, getDemoClasses } from "@/lib/class-demo";
import type { ClassCategory, FitnessClass } from "@/lib/types";

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

function parseCategory(value: FormDataEntryValue | null): ClassCategory {
  const category = String(value ?? "Training") as ClassCategory;
  const allowed: ClassCategory[] = [
    "Training",
    "Nutrition",
    "Recovery",
    "Mindset",
    "Science",
  ];
  if (!allowed.includes(category)) return "Training";
  return category;
}

function rowToClass(row: Record<string, unknown>): FitnessClass {
  return row as unknown as FitnessClass;
}

function mergeWithDemoClasses(dbClasses: FitnessClass[]): FitnessClass[] {
  const dbSlugs = new Set(dbClasses.map((c) => c.slug));
  const demos = getDemoClasses().filter((d) => !dbSlugs.has(d.slug));
  return [...dbClasses, ...demos].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
  );
}

export async function getPublishedClasses(): Promise<FitnessClass[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("published", true)
    .order("scheduled_at", { ascending: false });

  if (error) return getDemoClasses();
  return mergeWithDemoClasses((data ?? []).map(rowToClass));
}

export async function getAllClasses(): Promise<FitnessClass[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("*")
    .order("scheduled_at", { ascending: false });

  return (data ?? []).map(rowToClass);
}

export async function getClassBySlug(slug: string): Promise<FitnessClass | null> {
  const demo = getDemoClassBySlug(slug);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return demo ?? null;
  if (!data.published) return null;
  return rowToClass(data);
}

export async function createClass(formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = parseCategory(formData.get("category"));
  const cover_image = String(formData.get("cover_image") ?? "").trim() || null;
  const scheduled_at = parseScheduledAt(formData.get("scheduled_at"));
  const duration_minutes = parseDuration(formData.get("duration_minutes"));
  const meeting_url = String(formData.get("meeting_url") ?? "").trim() || null;
  const replay_url = String(formData.get("replay_url") ?? "").trim() || null;
  const published = formData.get("published") === "on";

  if (!title || !slug) throw new Error("Title and slug are required.");

  const { error } = await supabase.from("classes").insert({
    title,
    slug,
    description,
    category,
    cover_image,
    scheduled_at,
    duration_minutes,
    meeting_url,
    replay_url,
    published,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/classes");
  revalidatePath("/dashboard/classes");
  redirect("/admin/classes");
}

export async function deleteClass(id: string) {
  const supabase = await createClient();
  await supabase.from("classes").delete().eq("id", id);
  revalidatePath("/admin/classes");
  revalidatePath("/dashboard/classes");
}

export async function updateClass(id: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = parseCategory(formData.get("category"));
  const cover_image = String(formData.get("cover_image") ?? "").trim() || null;
  const scheduled_at = parseScheduledAt(formData.get("scheduled_at"));
  const duration_minutes = parseDuration(formData.get("duration_minutes"));
  const meeting_url = String(formData.get("meeting_url") ?? "").trim() || null;
  const replay_url = String(formData.get("replay_url") ?? "").trim() || null;
  const published = formData.get("published") === "on";

  if (!title || !slug) throw new Error("Title and slug are required.");

  const { error } = await supabase
    .from("classes")
    .update({
      title,
      slug,
      description,
      category,
      cover_image,
      scheduled_at,
      duration_minutes,
      meeting_url,
      replay_url,
      published,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/classes");
  revalidatePath("/dashboard/classes");
  redirect("/admin/classes");
}

export async function getClassById(id: string): Promise<FitnessClass | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return rowToClass(data);
}
