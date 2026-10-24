import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { hasAiAccess } from "@/lib/subscription";
import type { Profile } from "@/lib/types";

/** Photo and typed AI meal logs a free account can save on one calendar day. */
export const FREE_AI_MEALS_PER_DAY = 2;

function appCalendarDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "Europe/Tirane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function mealLogDateKey(date?: string | null): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return appCalendarDay();
}

export async function countAiAssistedMeals(
  admin: SupabaseClient,
  clientId: string,
  date: string
): Promise<number> {
  const { count, error } = await admin
    .from("daily_meal_logs")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("date", date)
    .eq("ai_assisted", true);

  if (error) return FREE_AI_MEALS_PER_DAY;
  return count ?? 0;
}

export async function freeAiMealSlotOpen(
  admin: SupabaseClient,
  profile: Pick<
    Profile,
    | "id"
    | "role"
    | "subscription_plan"
    | "subscription_status"
    | "subscription_expires_at"
    | "preferred_locale"
  >,
  date?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (hasAiAccess(profile)) return { ok: true };

  const used = await countAiAssistedMeals(admin, profile.id, mealLogDateKey(date));
  if (used >= FREE_AI_MEALS_PER_DAY) {
    return {
      ok: false,
      error: getPlatformCopy(parseCheckoutLocale(profile.preferred_locale)).mealLog
        .freeAiMealsUsed,
    };
  }
  return { ok: true };
}
