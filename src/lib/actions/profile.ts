"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/cached-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCheckoutLocale, type CheckoutLocale } from "@/lib/checkout-i18n";
import { PROFILE_GOAL_KEYS } from "@/lib/goal-coaching";
import { targetsFromCaloriesAndSplit } from "@/lib/macro-calculator";

export async function getProfileWithEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getCachedProfile();
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
  const phone = (formData.get("phone") as string)?.trim() || null;
  const goal = (formData.get("goal") as string)?.trim() || null;
  const unitSystem = ((formData.get("unit_system") as string) || "metric").trim();
  const preferredLocale = parseCheckoutLocale(
    (formData.get("preferred_locale") as string)?.trim()
  );

  if (!fullName) return { error: "Name is required" };
  if (unitSystem !== "metric" && unitSystem !== "imperial") {
    return { error: "Invalid unit system" };
  }

  const allowedGoals = new Set<string>(PROFILE_GOAL_KEYS);
  const normalizedGoal =
    goal && allowedGoals.has(goal) ? goal : null;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("intake_responses")
    .eq("id", user.id)
    .single();

  const existingIntake =
    (existingProfile?.intake_responses as Record<string, unknown> | null) ?? {};
  const intakeResponses = { ...existingIntake };
  if (normalizedGoal) {
    intakeResponses.goal = normalizedGoal;
  } else {
    delete intakeResponses.goal;
  }

  const profileUpdate: {
    full_name: string;
    phone: string | null;
    goal: string | null;
    preferred_locale: CheckoutLocale;
    intake_responses: Record<string, unknown>;
    unit_system?: "metric" | "imperial";
  } = {
    full_name: fullName,
    phone,
    goal: normalizedGoal,
    preferred_locale: preferredLocale,
    intake_responses: intakeResponses,
    unit_system: unitSystem,
  };

  let { error } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (error?.message?.includes("unit_system")) {
    const { unit_system: _unitSystem, ...withoutUnits } = profileUpdate;
    ({ error } = await supabase
      .from("profiles")
      .update(withoutUnits)
      .eq("id", user.id));
  }

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function updateCalorieTarget(input: {
  calories: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const nextCalories = Math.round(input.calories);
  if (!Number.isFinite(nextCalories) || nextCalories < 500 || nextCalories > 10000) {
    return { error: "Calories must be between 500 and 10000" };
  }

  const targets = targetsFromCaloriesAndSplit(nextCalories, {
    protein: input.proteinPct,
    carbs: input.carbsPct,
    fat: input.fatPct,
  });

  const { error } = await supabase
    .from("profiles")
    .update({
      target_calories: targets.calories,
      target_protein: targets.protein,
      target_carbs: targets.carbs,
      target_fat: targets.fat,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/profile");
  return { success: true, targets };
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

export async function getPreferredLocale(): Promise<CheckoutLocale> {
  const profile = await getProfileWithEmail();
  return parseCheckoutLocale(profile?.preferred_locale);
}

const DELETE_CONFIRM_PHRASES = new Set(["I GIVE UP!", "JAP DOREHEQJE!"]);

/**
 * Client self-service account deletion. Requires exact confirmation phrase.
 * Cleans personal plans then deletes the auth user (cascade profile).
 */
export async function deleteOwnAccount(
  confirmation: string
): Promise<{ error: string } | void> {
  const phrase = confirmation.trim();
  if (!DELETE_CONFIRM_PHRASES.has(phrase)) {
    return { error: "confirmation_mismatch" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const profile = await getCachedProfile();
  if (!profile) return { error: "Not authenticated" };
  if (profile.role === "admin") {
    return { error: "Admin accounts cannot be deleted here." };
  }
  if (profile.id !== user.id) {
    return { error: "Not authenticated" };
  }

  const admin = createAdminClient();
  const userId = user.id;

  const { error: workoutPlansError } = await admin
    .from("workout_plans")
    .delete()
    .eq("created_by", userId);
  if (workoutPlansError) return { error: workoutPlansError.message };

  const { error: nutritionPlansError } = await admin
    .from("nutrition_plans")
    .delete()
    .eq("created_by", userId);
  if (nutritionPlansError) return { error: nutritionPlansError.message };

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return { error: deleteError.message };

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
