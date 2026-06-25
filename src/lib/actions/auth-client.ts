import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthClientResult =
  | { error: string }
  | { user: { id: string }; admin: SupabaseClient };

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
