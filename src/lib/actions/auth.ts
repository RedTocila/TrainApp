"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedProfile } from "@/lib/cached-profile";
import { applyIntakeToProfile } from "@/lib/actions/client-intake";
import { attachReferralOnSignup, normalizeReferralCode } from "@/lib/referral";
import { formatUserError } from "@/lib/format-user-error";
import type { IntakeResponses } from "@/lib/intake-questionnaire";
import type { SupabaseClient } from "@supabase/supabase-js";

type RegistrationInput = {
  fullName: string;
  email: string;
  phone: string | null;
  intakeJson?: string | null;
  referralCode?: string | null;
  deviceHash?: string | null;
};

async function finalizeNewUserProfile(
  supabase: SupabaseClient,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
  input: RegistrationInput
) {
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
    .eq("id", userId);

  if (profileError) {
    return {
      error: formatUserError(
        profileError.message,
        "Could not update your profile. Please try signing in or contact support."
      ),
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

  const userMetadata: Record<string, string | null> = {
    full_name: input.fullName,
    phone: input.phone,
  };
  if (input.referralCode) {
    userMetadata.referral_code = normalizeReferralCode(input.referralCode);
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
    const message = createError.message.toLowerCase();
    if (message.includes("already") && message.includes("registered")) {
      const recovered = await recoverExistingSignupUser(admin, email, input.password, userMetadata);
      if (recovered) {
        return finalizeNewUserProfile(admin, recovered.id, recovered.user_metadata, {
          ...input,
          email,
        });
      }
      return { error: "This email is already registered. Sign in instead." };
    }
    return {
      error: formatUserError(createError.message, "Could not create account."),
    };
  }

  if (!created.user) {
    return { error: "Could not create account." };
  }

  return finalizeNewUserProfile(admin, created.user.id, created.user.user_metadata, {
    ...input,
    email,
  });
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
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  password: string,
  userMetadata: Record<string, string | null>
) {
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;

    const existing = data.users.find((user) => user.email?.toLowerCase() === email);
    if (existing) {
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

    if (data.users.length < 200) break;
  }

  return null;
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
