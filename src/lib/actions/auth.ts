"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/cached-profile";
import { applyIntakeToProfile } from "@/lib/actions/client-intake";
import { attachReferralOnSignup, normalizeReferralCode } from "@/lib/referral";
import { formatUserError } from "@/lib/format-user-error";
import type { IntakeResponses } from "@/lib/intake-questionnaire";

/** Apply profile + intake after the browser client has established an auth session. */
export async function completeRegistration(input: {
  fullName: string;
  email: string;
  phone: string | null;
  intakeJson?: string | null;
  referralCode?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session not established. Please try signing in." };
  }

  let intakeResponses: IntakeResponses | null = null;
  const intakeRaw = input.intakeJson?.trim();
  if (intakeRaw) {
    try {
      intakeResponses = JSON.parse(intakeRaw) as IntakeResponses;
    } catch {
      return { error: "Invalid health profile data. Please retake the questionnaire." };
    }
  }

  const profileUpdate: { role?: string; phone?: string; full_name: string } = {
    full_name: input.fullName,
  };
  if (input.phone) profileUpdate.phone = input.phone;
  if (process.env.ADMIN_EMAIL && input.email === process.env.ADMIN_EMAIL) {
    profileUpdate.role = "admin";
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (profileError) {
    return {
      error: formatUserError(
        profileError.message,
        "Could not update your profile. Please try signing in or contact support."
      ),
    };
  }

  if (intakeResponses) {
    const intakeError = await applyIntakeToProfile(user.id, supabase, intakeResponses);
    if (intakeError) {
      return {
        error: formatUserError(
          intakeError,
          "Could not save your health profile. You can update it later in your dashboard."
        ),
      };
    }
  }

  const referralCode =
    normalizeReferralCode(input.referralCode) ??
    normalizeReferralCode(
      typeof user.user_metadata?.referral_code === "string"
        ? user.user_metadata.referral_code
        : null
    );

  try {
    await attachReferralOnSignup(supabase, user.id, referralCode);
  } catch (referralError) {
    console.error("[completeRegistration] referral attach failed", referralError);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  revalidatePath("/", "layout");
  return { success: true as const, role: profile?.role ?? "client" };
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login failed" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function getProfile() {
  return getCachedProfile();
}

export async function requireAdmin() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }
  return profile;
}

export async function requireClient() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");
  return profile;
}
