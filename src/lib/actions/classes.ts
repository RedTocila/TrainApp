"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/actions/auth";
import { resolveCoverImageFromForm } from "@/lib/cover-image-upload";
import type { ClassCategory, FitnessClass } from "@/lib/types";

const DEMO_CLASS_SLUG = "demo-full-body-strength";

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

function isDemoClassSlug(slug: string): boolean {
  return slug === DEMO_CLASS_SLUG;
}

export async function getHasPublishedClasses(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("slug")
    .eq("published", true)
    .neq("slug", DEMO_CLASS_SLUG)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function getPublishedClasses(): Promise<FitnessClass[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("published", true)
    .order("scheduled_at", { ascending: false });

  if (error) return [];
  return (data ?? [])
    .map(rowToClass)
    .filter((c) => !isDemoClassSlug(c.slug));
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
  if (isDemoClassSlug(slug)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.published) return null;
  return rowToClass(data);
}

export type ClassFormState = { error: string | null };

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function readClassForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required.");
  const slug = slugify(String(formData.get("slug") ?? "")) || slugify(title);
  if (!slug) throw new Error("Add a slug using letters or numbers.");

  // The browser sends the local time as ISO so the server's UTC clock doesn't shift it.
  const scheduled_at = parseScheduledAt(
    formData.get("scheduled_at_iso") || formData.get("scheduled_at")
  );

  return {
    title,
    slug,
    description: String(formData.get("description") ?? "").trim(),
    category: parseCategory(formData.get("category")),
    scheduled_at,
    duration_minutes: parseDuration(formData.get("duration_minutes")),
    meeting_url: String(formData.get("meeting_url") ?? "").trim() || null,
    replay_url: String(formData.get("replay_url") ?? "").trim() || null,
    published: formData.get("published") === "on",
    cover_image: await resolveCoverImageFromForm(formData, "classes", slug),
  };
}

function classWriteError(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return "A class with this slug already exists. Change the slug and try again.";
  }
  return error.message;
}

/** Writes bypass RLS with the service role, so every caller must be verified as admin first. */
async function getAdminDb() {
  await requireAdmin();
  return createAdminClient();
}

function revalidateClassPaths() {
  revalidatePath("/admin/classes");
  revalidatePath("/dashboard/classes");
}

export async function createClass(
  _prev: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const db = await getAdminDb();
  try {
    const values = await readClassForm(formData);
    const { error } = await db.from("classes").insert(values);
    if (error) return { error: classWriteError(error) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the class." };
  }
  revalidateClassPaths();
  redirect("/admin/classes");
}

export async function deleteClass(id: string) {
  const db = await getAdminDb();
  const { error } = await db.from("classes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateClassPaths();
}

export async function updateClass(
  id: string,
  _prev: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const db = await getAdminDb();
  try {
    const values = await readClassForm(formData);
    const { error } = await db.from("classes").update(values).eq("id", id);
    if (error) return { error: classWriteError(error) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the class." };
  }
  revalidateClassPaths();
  redirect("/admin/classes");
}

export async function getClassById(id: string): Promise<FitnessClass | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return rowToClass(data);
}
