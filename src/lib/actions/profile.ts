"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getProfileWithEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    ...profile,
    email: user.email ?? "",
  };
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const fullName = (formData.get("full_name") as string)?.trim();
  const goal = (formData.get("goal") as string)?.trim() || null;
  const unitSystem = ((formData.get("unit_system") as string) || "metric").trim();

  if (!fullName) return { error: "Name is required" };
  if (unitSystem !== "metric" && unitSystem !== "imperial") {
    return { error: "Invalid unit system" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, goal, unit_system: unitSystem })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!newPassword || newPassword.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { success: true };
}
