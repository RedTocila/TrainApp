"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedProfile } from "@/lib/cached-profile";
import { applyIntakeToProfile } from "@/lib/actions/client-intake";
import { attachReferralOnSignup, normalizeReferralCode } from "@/lib/referral";
import { formatUserError, isEmailNotConfirmedError } from "@/lib/format-user-error";
import type { IntakeResponses } from "@/lib/intake-questionnaire";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type RegistrationInput = {
  fullName: string;
  email: string;
  phone: string | null;
  intakeJson?: string | null;
  referralCode?: string | null;
  deviceHash?: string | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;

async function findAuthUserByEmail(
  admin: AdminClient,
  email: string
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;

    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match;

    if (data.users.length < 200) break;
  }

  return null;
}

async function confirmAuthUserEmail(email: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const user = await findAuthUserByEmail(admin, email);
    if (!user) return false;

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    return !error;
  } catch (error) {
    console.error("[confirmAuthUserEmail] failed", error);
    return false;
  }
}

async function signInWithRecovery(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = await createClient();

  let { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error && isEmailNotConfirmedError(error)) {
    const confirmed = await confirmAuthUserEmail(normalizedEmail);
    if (confirmed) {
      ({ error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      }));
    }
  }

  if (error) {
    return { error: formatUserError(error, "Sign in failed. Check your email and password.") };
  }

  return { error: null as null };
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

  const referralCode = userId.replace(/-/g, "").slice(0, 8).toLowerCase();
  const role =
    process.env.ADMIN_EMAIL && input.email === process.env.ADMIN_EMAIL ? "admin" : "client";

  const { error } = await supabase.from("profiles").insert({
    id: userId,
    full_name: input.fullName || input.email.split("@")[0] || "Member",
    referral_code: referralCode,
    role,
  });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return error.message;
  }

  return null;
}

async function finalizeNewUserProfile(
  supabase: SupabaseClient,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
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

  const referralCode =
    normalizeReferralCode(input.referralCode) ??
    normalizeReferralCode(
      typeof userMetadata?.referral_code === "string" ? userMetadata.referral_code : null
    );
  const deviceHash =
    input.deviceHash?.trim() ||
    (typeof userMetadata?.device_hash === "string" ? userMetadata.device_hash : null);

  try {
    await attachReferralOnSignup(supabase, userId, referralCode, deviceHash);
  } catch (referralError) {
    console.error("[finalizeNewUserProfile] referral attach failed", referralError);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  revalidatePath("/", "layout");
  return { success: true as const, role: profile?.role ?? "client" };
}

/**
 * Create account server-side (auto-confirmed) so signup does not depend on Supabase SMTP.
 */
export async function signUpAccount(input: RegistrationInput & { password: string }) {
  const email = input.email.trim().toLowerCase();
  const admin = createAdminClient();

  const userMetadata: Record<string, string> = {
    full_name: input.fullName,
  };
  if (input.phone) {
    userMetadata.phone = input.phone;
  }
  if (input.referralCode) {
    const code = normalizeReferralCode(input.referralCode);
    if (code) userMetadata.referral_code = code;
  }
  if (input.deviceHash?.trim()) {
    userMetadata.device_hash = input.deviceHash.trim();
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (createError) {
    console.error("[signUpAccount] createUser failed", createError.message, createError);
    const message = createError.message.toLowerCase();
    if (
      (message.includes("already") && message.includes("registered")) ||
      message.includes("database error")
    ) {
      const recovered = await recoverExistingSignupUser(admin, email, input.password, userMetadata);
      if (recovered) {
        const finalized = await finalizeNewUserProfile(admin, recovered.id, recovered.user_metadata, {
          ...input,
          email,
        });
        if (finalized.error) {
          console.error("[signUpAccount] profile setup failed after recover", finalized.error);
          const { data: profile } = await admin
            .from("profiles")
            .select("role")
            .eq("id", recovered.id)
            .maybeSingle();
          return {
            success: true as const,
            role: profile?.role ?? "client",
            profileSetupDeferred: true,
          };
        }
        return finalized;
      }
      if (message.includes("already")) {
        return { error: "This email is already registered. Sign in instead." };
      }
    }
    return {
      error: formatUserError(createError.message, "Could not create account."),
    };
  }

  if (!created.user) {
    return { error: "Could not create account." };
  }

  const finalized = await finalizeNewUserProfile(admin, created.user.id, created.user.user_metadata, {
    ...input,
    email,
  });

  if (finalized.error) {
    console.error("[signUpAccount] profile setup failed after createUser", finalized.error);
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", created.user.id)
      .maybeSingle();
    return { success: true as const, role: profile?.role ?? "client", profileSetupDeferred: true };
  }

  return finalized;
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

async function recoverExistingSignupUser(
  admin: AdminClient,
  email: string,
  password: string,
  userMetadata: Record<string, string>
) {
  const existing = await findAuthUserByEmail(admin, email);
  if (!existing) return null;

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
    existing.id,
    {
      password,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, ...userMetadata },
    }
  );
  if (updateError) return null;
  return updated.user;
}

/** Sign in after registration — auto-confirms email if Supabase left it unverified. */
export async function signInAfterRegistration(email: string, password: string) {
  return signInWithRecovery(email, password);
}

/**
 * Finish signup without relying on Supabase SMTP — confirms via admin API, signs in, applies profile.
 */
export async function completePendingSignup(
  input: RegistrationInput & { password: string }
) {
  const email = input.email.trim().toLowerCase();

  const confirmed = await confirmAuthUserEmail(email);
  if (!confirmed) {
    const recovered = await recoverExistingSignupUser(
      createAdminClient(),
      email,
      input.password,
      {
        full_name: input.fullName,
        ...(input.phone ? { phone: input.phone } : {}),
      }
    );
    if (!recovered) {
      return {
        error:
          "We could not verify your account yet. Wait a minute and try again, or contact support.",
      };
    }
  }

  const { error: signInError } = await signInWithRecovery(email, input.password);
  if (signInError) {
    return { error: signInError };
  }

  return completeRegistration({ ...input, email });
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await signInWithRecovery(email, password);
  if (error) return { error };

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
