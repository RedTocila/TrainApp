"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/cached-profile";
import { applyIntakeToProfile } from "@/lib/actions/client-intake";
import { getAppBaseUrl } from "@/lib/app-url";
import { formatUserError, isEmailNotConfirmedError } from "@/lib/format-user-error";
import type { IntakeResponses } from "@/lib/intake-questionnaire";
import type { SupabaseClient } from "@supabase/supabase-js";

type RegistrationInput = {
  fullName: string;
  email: string;
  phone: string | null;
  intakeJson?: string | null;
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
          "Confirm your email before signing in. Check your inbox for the verification link."
        ),
      };
    }
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

  const role =
    process.env.ADMIN_EMAIL && input.email === process.env.ADMIN_EMAIL ? "admin" : "client";

  const { error } = await supabase.from("profiles").insert({
    id: userId,
    full_name: input.fullName || input.email.split("@")[0] || "Member",
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  revalidatePath("/", "layout");
  return { success: true as const, role: profile?.role ?? "client" };
}

/**
 * Create account via Supabase Auth signUp so confirmation emails go through SMTP (Resend).
 * Do NOT use admin.createUser with email_confirm: true — that skips the confirmation email.
 */
export async function signUpAccount(input: RegistrationInput & { password: string }) {
  const email = input.email.trim().toLowerCase();
  const supabase = await createClient();
  const emailRedirectTo = `${getAppBaseUrl()}/auth/callback`;

  const userMetadata: Record<string, string> = {
    full_name: input.fullName,
  };
  if (input.phone) {
    userMetadata.phone = input.phone;
  }

  const requestPayload = {
    email,
    fullName: input.fullName,
    hasPhone: Boolean(input.phone),
    emailRedirectTo,
    hasIntake: Boolean(input.intakeJson?.trim()),
  };
  console.log("[signUpAccount] request", requestPayload);

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo,
      data: userMetadata,
    },
  });

  console.log("[signUpAccount] response", {
    error: error
      ? { message: error.message, status: error.status, code: (error as { code?: string }).code }
      : null,
    user: data.user
      ? {
          id: data.user.id,
          email: data.user.email,
          emailConfirmedAt: data.user.email_confirmed_at,
          identitiesCount: data.user.identities?.length ?? 0,
        }
      : null,
    session: data.session
      ? { userId: data.session.user.id, expiresAt: data.session.expires_at }
      : null,
  });

  if (error) {
    console.error("[signUpAccount] signUp failed", error.message, error);
    return {
      error: formatUserError(error.message, "Could not create account."),
    };
  }

  if (!data.user) {
    console.error("[signUpAccount] signUp returned no user and no error");
    return { error: "Could not create account." };
  }

  // Supabase returns a user with empty identities when the email is already registered
  // (anti-enumeration). Treat that as an existing account.
  if ((data.user.identities?.length ?? 0) === 0) {
    return { error: "This email is already registered. Sign in instead." };
  }

  // Confirm-email enabled: SMTP sends the message; no session until the link is clicked.
  if (!data.session) {
    console.log("[signUpAccount] awaiting email confirmation", {
      userId: data.user.id,
      email,
    });
    return {
      success: true as const,
      needsEmailConfirmation: true as const,
      role: "client" as const,
    };
  }

  // Confirm-email disabled in Supabase: session is immediate — finish profile now.
  const finalized = await finalizeNewUserProfile(supabase, data.user.id, data.user.user_metadata, {
    ...input,
    email,
  });

  if (finalized.error) {
    console.error("[signUpAccount] profile setup failed after signUp", finalized.error);
    return {
      success: true as const,
      needsEmailConfirmation: false as const,
      role: "client" as const,
      profileSetupDeferred: true as const,
    };
  }

  return {
    ...finalized,
    needsEmailConfirmation: false as const,
  };
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

/** Sign in after registration when Supabase returned a session (confirm email off). */
export async function signInAfterRegistration(email: string, password: string) {
  return signInWithPasswordOnly(email, password);
}

/**
 * After the user confirms email (or already has a session), sign in and apply profile/intake.
 */
export async function completePendingSignup(
  input: RegistrationInput & { password: string }
) {
  const email = input.email.trim().toLowerCase();

  const { error: signInError } = await signInWithPasswordOnly(email, input.password);
  if (signInError) {
    return { error: signInError };
  }

  return completeRegistration({ ...input, email });
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await signInWithPasswordOnly(email, password);
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
