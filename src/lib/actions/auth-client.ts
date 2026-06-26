import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureSubscribedMutation } from "@/lib/actions/subscriptions";
import type { Profile } from "@/lib/types";

export type AuthClientResult =
  | { error: string }
  | { user: { id: string }; admin: SupabaseClient };

export type MutationAdminResult =
  | { error: string }
  | { admin: SupabaseClient; userId: string; profile: Profile };

/** Verify the caller owns clientId; return service-role client for mutations. */
export async function requireOwnedClient(clientId: string): Promise<AuthClientResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id !== clientId) return { error: "Not authorized" };
  return { user, admin: createAdminClient() };
}

/** Subscribed user mutations — bypasses RLS after auth + ownership checks. */
export async function requireSubscribedMutationAdmin(
  clientId?: string
): Promise<MutationAdminResult> {
  const access = await ensureSubscribedMutation();
  if ("error" in access) return { error: access.error };
  if (clientId && clientId !== access.profile.id) return { error: "Not authorized" };
  const auth = await requireOwnedClient(access.profile.id);
  if ("error" in auth) return { error: auth.error };
  return { admin: auth.admin, userId: access.profile.id, profile: access.profile };
}

/** Map raw Postgres/Supabase errors to short user-facing messages. */
export function formatDbError(message: string, locale: "en" | "al" = "al"): string {
  const lower = message.toLowerCase();
  if (lower.includes("row-level security")) {
    return locale === "al"
      ? "Nuk u ruajt — provoni të dilni dhe të hyni përsëri."
      : "Could not save — try signing out and back in.";
  }
  if (lower.includes("not authenticated") || lower.includes("jwt")) {
    return locale === "al" ? "Sesioni skadoi. Hyni përsëri." : "Session expired. Sign in again.";
  }
  return message;
}
