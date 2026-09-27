import { createAdminClient } from "@/lib/supabase/admin";
import { hasEliteAccess, isSubscriptionActive } from "@/lib/subscription";
import { APP_FREE_ACCESS_EXPIRES_AT, NATIVE_APP_FREE } from "@/lib/app-free-access";
import type { Profile } from "@/lib/types";

/**
 * Give a client full (Elite) access for the free native app.
 * Active paid subscriptions keep their billing period and are only lifted to Elite.
 * Returns true when the profile changed.
 */
export async function grantAppFreeAccess(userId: string): Promise<boolean> {
  if (!NATIVE_APP_FREE) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role, subscription_plan, subscription_status, subscription_expires_at")
    .eq("id", userId)
    .maybeSingle();

  const profile = data as Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  > | null;
  if (!profile || profile.role === "admin") return false;
  if (hasEliteAccess(profile)) return false;

  const update = isSubscriptionActive(profile)
    ? { subscription_plan: "elite" }
    : {
        subscription_plan: "elite",
        subscription_status: "active",
        subscription_interval: null,
        subscription_expires_at: APP_FREE_ACCESS_EXPIRES_AT,
      };

  const { error } = await admin.from("profiles").update(update).eq("id", userId);
  if (error) {
    console.error("[grantAppFreeAccess]", error.message);
    return false;
  }
  return true;
}
