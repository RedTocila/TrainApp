"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/cached-profile";
import { applyIntakeToProfile } from "@/lib/actions/client-intake";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthEmailRedirectUrl } from "@/lib/app-url";
import { formatUserError, isEmailNotConfirmedError } from "@/lib/format-user-error";
import { IOS_WELCOME_PATH, safeNativeRedirect } from "@/lib/ios-routes";
import { NATIVE_APP_COOKIE, isNativeAppRequest } from "@/lib/native-app-request";
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

    const { data: rpcId, error: rpcError } = await admin.rpc(
      "find_auth_user_id_by_email",
      { p_email: normalized }
    );
    if (!rpcError && typeof rpcId === "string" && rpcId.length > 0) {
      return rpcId;
    }

    // Fallback if migration not applied yet (paginate further than before).
    for (let page = 1; page <= 100; page++) {
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
    process.env.ADMIN_EMAIL &&
    input.email.trim().toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase()
      ? "admin"
      : "client";

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
  if (
    process.env.ADMIN_EMAIL &&
    email === process.env.ADMIN_EMAIL.trim().toLowerCase()
  ) {
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

/** Create a free account on the website. No card. Plus and Pro are bought later. */
export async function registerFreeAccount(input: {
  fullName: string;
  email: string;
  phone: string | null;
  password: string;
  intakeJson?: string | null;
  referralCode?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const password = input.password;
  if (!email || !fullName) return { error: "Enter your name and email." };
  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const existing = await findAuthUserIdByEmail(email);
  if (existing) {
    return { error: "This email is already registered. Sign in to continue." };
  }

  const admin = createAdminClient();
  const userMetadata: Record<string, string> = { full_name: fullName };
  if (input.phone) userMetadata.phone = input.phone;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (createError || !created.user) {
    if (createError?.message?.toLowerCase().includes("already")) {
      return { error: "This email is already registered. Sign in to continue." };
    }
    return {
      error: formatUserError(createError?.message, "Could not create your account."),
    };
  }

  const finalized = await finalizeNewUserProfile(admin, created.user.id, userMetadata, {
    fullName,
    email,
    phone: input.phone,
    intakeJson: input.intakeJson,
  });
  if ("error" in finalized && finalized.error) return finalized;

  if (input.referralCode?.trim()) {
    try {
      const { applyReferralCodeForUser } = await import("@/lib/actions/referrals");
      await applyReferralCodeForUser(created.user.id, input.referralCode);
    } catch {
      // A bad invite code must not block the free account.
    }
  }

  const signedIn = await signInWithPasswordOnly(email, password);
  if (signedIn.error) return { error: signedIn.error };

  return { success: true as const, role: finalized.role ?? "client", email };
}

export async function signIn(formData: FormData) {
  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  if (typeof emailRaw !== "string" || typeof passwordRaw !== "string") {
    return { error: "Enter your email and password." };
  }
  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw;

  const result = await signInWithPasswordOnly(email, password);

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

  // Optional native funnel redirect (web login form does not send `next`).
  const next = safeNativeRedirect(formData.get("next"));
  redirect(next ?? "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  // Default scope is "global", which would revoke the user's sessions on every other device too.
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const nativeApp = isNativeAppRequest(
    cookieStore.get(NATIVE_APP_COOKIE)?.value,
    headerList.get("user-agent")
  );
  redirect(nativeApp ? IOS_WELCOME_PATH : "/login");
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
