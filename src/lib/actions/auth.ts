"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/cached-profile";
import { applyIntakeToProfile } from "@/lib/actions/client-intake";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthEmailRedirectUrl } from "@/lib/app-url";
import { formatUserError, isEmailNotConfirmedError } from "@/lib/format-user-error";
import type { IntakeResponses } from "@/lib/intake-questionnaire";
import type { SupabaseClient } from "@supabase/supabase-js";

type RegistrationInput = {
  fullName: string;
  email: string;
  phone: string | null;
  intakeJson?: string | null;
  referralCode?: string | null;
};

async function signInWithPasswordOnly(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    if (isEmailNotConfirmedError(error)) {
      return {
        error: formatUserError(
          error,
          "Confirm your email when you can — or tap continue below if you just signed up."
        ),
        code: "email_not_confirmed" as const,
      };
    }
    return {
      error: formatUserError(error, "Sign in failed. Check your email and password."),
      code: null as null,
    };
  }

  return { error: null as null, code: null as null };
}

/** Mark email confirmed so the user can enter the app immediately after signup. */
async function confirmEmailForAccess(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (error) {
      console.error("[confirmEmailForAccess] failed", error.message);
      return error.message;
    }
    return null;
  } catch (err) {
    console.error("[confirmEmailForAccess] threw", err);
    return err instanceof Error ? err.message : "Could not unlock account access.";
  }
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const normalized = email.trim().toLowerCase();
    // Avoid generateLink — it rotates tokens and breaks outstanding email links.
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        console.error("[findAuthUserIdByEmail] failed", error.message);
        return null;
      }
      const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
      if (match) return match.id;
      if (data.users.length < 200) break;
    }
    return null;
  } catch (err) {
    console.error("[findAuthUserIdByEmail] threw", err);
    return null;
  }
}

async function ensureProfileExists(
  supabase: SupabaseClient,
  userId: string,
  input: { fullName: string; email: string }
): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (data) return null;
    await new Promise((resolve) => setTimeout(resolve, 75 * (attempt + 1)));
  }

  const role =
    process.env.ADMIN_EMAIL && input.email === process.env.ADMIN_EMAIL ? "admin" : "client";

  const referralCode = Math.random().toString(36).slice(2, 10);

  const { error } = await supabase.from("profiles").insert({
    id: userId,
    full_name: input.fullName || input.email.split("@")[0] || "Member",
    role,
    referral_code: referralCode,
    subscription_status: "inactive",
  });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return error.message;
  }

  return null;
}

async function finalizeNewUserProfile(
  supabase: SupabaseClient,
  userId: string,
  _userMetadata: Record<string, unknown> | undefined,
  input: RegistrationInput
) {
  const email = input.email.trim().toLowerCase();

  const profileBootstrapError = await ensureProfileExists(supabase, userId, {
    fullName: input.fullName,
    email,
  });
  if (profileBootstrapError) {
    return {
      error: formatUserError(
        profileBootstrapError,
        "Could not create your profile. Please try signing in or contact support."
      ),
    };
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

  const { data: updatedRows, error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId)
    .select("id");

  if (profileError) {
    return {
      error: formatUserError(
        profileError.message,
        "Could not update your profile. Please try signing in or contact support."
      ),
    };
  }

  if (!updatedRows?.length) {
    return {
      error: "Could not update your profile. Please try signing in or contact support.",
    };
  }

  if (intakeResponses) {
    const intakeError = await applyIntakeToProfile(userId, supabase, intakeResponses);
    if (intakeError) {
      return {
        error: formatUserError(
          intakeError,
          "Could not save your health profile. You can update it later in your dashboard."
        ),
      };
    }
  }

  // AI Pro free trial is card-backed and starts from pricing — not auto-granted here.

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  // Referral codes are applied only at package checkout — not at signup.

  revalidatePath("/", "layout");
  return { success: true as const, role: profile?.role ?? "client" };
}

/** Apply profile + intake after the browser client has established an auth session. */
export async function completeRegistration(input: RegistrationInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session not established. Please try signing in." };
  }

  const metadata = user.user_metadata as Record<string, unknown> | undefined;

  return finalizeNewUserProfile(supabase, user.id, metadata, {
    ...input,
    email: input.email?.trim() || user.email || "",
    fullName:
      input.fullName?.trim() ||
      (typeof metadata?.full_name === "string" ? metadata.full_name : "") ||
      "",
    phone:
      input.phone ??
      (typeof metadata?.phone === "string" ? metadata.phone : null),
  });
}

export async function signIn(formData: FormData) {
  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = formData.get("password") as string;

  let result = await signInWithPasswordOnly(email, password);

  if (result.code === "email_not_confirmed") {
    const userId = await findAuthUserIdByEmail(email);
    if (userId) {
      await confirmEmailForAccess(userId);
      result = await signInWithPasswordOnly(email, password);
    }
  }

  if (result.error) return { error: result.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

/** Send a password-reset email. Always returns success to avoid email enumeration. */
export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  if (!email) {
    return { error: "Enter the email for your account." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthEmailRedirectUrl("/auth/callback", "/reset-password"),
  });

  if (error) {
    console.error("[requestPasswordReset] failed", error.message);
    // Still show a generic message — do not reveal whether the email exists.
  }

  return { success: true as const };
}

/** Set a new password after the user opens a recovery link (authenticated session). */
export async function resetPassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "This reset link is invalid or expired. Request a new one." };
  }

  const newPassword = formData.get("new_password") as string | null;
  const confirmPassword = formData.get("confirm_password") as string | null;

  if (!newPassword || newPassword.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { error: formatUserError(error, "Could not update your password. Try again.") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  revalidatePath("/", "layout");
  if (profile?.role === "admin") {
    redirect("/admin");
  }
  redirect("/dashboard");
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
