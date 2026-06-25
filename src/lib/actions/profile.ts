"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/cached-profile";
import { parseCheckoutLocale, type CheckoutLocale } from "@/lib/checkout-i18n";

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

  const allowedGoals = new Set([
    "lose_weight",
    "build_muscle",
    "stay_fit",
    "improve_endurance",
    "general_health",
  ]);
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
