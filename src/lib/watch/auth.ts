import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPaidAccess } from "@/lib/subscription";
import { getSubscriptionRequiredMessage } from "@/lib/subscription-messages";
import type { Profile } from "@/lib/types";

export type WatchContext = {
  admin: SupabaseClient;
  userId: string;
  profile: Profile;
};

const PROFILE_COLUMNS =
  "id, role, full_name, preferred_locale, water_goal_ml, step_goal, target_calories, target_protein, target_carbs, target_fat, subscription_plan, subscription_status, subscription_interval, subscription_expires_at";

const PROFILE_COLUMNS_WITHOUT_STEP_GOAL =
  "id, role, full_name, preferred_locale, water_goal_ml, target_calories, target_protein, target_carbs, target_fat, subscription_plan, subscription_status, subscription_interval, subscription_expires_at";

export function watchDateKey(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}-${day}`;
}

async function loadProfile(
  admin: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const first = await admin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (!first.error && first.data) return first.data as Profile;

  if (first.error && /step_goal/i.test(first.error.message)) {
    const retry = await admin
      .from("profiles")
      .select(PROFILE_COLUMNS_WITHOUT_STEP_GOAL)
      .eq("id", userId)
      .maybeSingle();
    if (retry.data) {
      return { ...(retry.data as Profile), step_goal: 10000 };
    }
  }

  return null;
}

/** Bearer access token from the Watch, after the iPhone app has shared the session. */
export async function requireWatchUser(
  request: Request
): Promise<WatchContext | { error: string; status: number }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!token) {
    return { error: "Open RUTINA on your iPhone and sign in.", status: 401 };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return {
      error: "Session expired. Open RUTINA on your iPhone.",
      status: 401,
    };
  }

  const profile = await loadProfile(admin, data.user.id);
  if (!profile) return { error: "Profile not found.", status: 401 };

  if (!hasPaidAccess(profile)) {
    const locale = profile.preferred_locale === "en" ? "en" : "al";
    return { error: getSubscriptionRequiredMessage(locale), status: 403 };
  }

  return { admin, userId: data.user.id, profile };
}
