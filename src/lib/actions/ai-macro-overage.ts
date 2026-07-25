"use server";

import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { hasAiAccess } from "@/lib/subscription";
import { isAiConfigured } from "@/lib/ai/providers";
import { formatUserError } from "@/lib/format-user-error";
import {
  buildLocalDayOverageInsights,
  fallbackMacroOverageInsight,
  type MacroOverageInsight,
  type OverageNutrient,
} from "@/lib/macro-overage-local";
import {
  generateDayMacroOverageInsights,
  generateMacroOverageInsight,
} from "@/lib/ai/macro-overage-insight";
import type { MealMacros } from "@/lib/meal-utils";

const AI_TIMEOUT_MS = 8_000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function analyzeMacroOverageAction({
  dateKey,
  nutrient,
  current,
  targets,
}: {
  dateKey: string;
  nutrient: OverageNutrient;
  current: MealMacros;
  targets: MealMacros;
}): Promise<{ insight: MacroOverageInsight } | { error: string }> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { error: "Not authenticated" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { error: "Invalid date" };
  }

  try {
    const meals = await getDailyMealLogs(profile.id, dateKey);
    const local = fallbackMacroOverageInsight(meals, nutrient, targets);
    const canUseAi = hasAiAccess(profile) && isAiConfigured();

    if (!canUseAi) return { insight: local };

    const insight = await withTimeout(
      generateMacroOverageInsight({
        meals,
        nutrient,
        current,
        targets,
      }),
      AI_TIMEOUT_MS,
      local
    );

    return { insight };
  } catch (error) {
    return {
      error: formatUserError(error, "Failed to analyze today's meals"),
    };
  }
}

export async function analyzeDayMacroOverageAction({
  dateKey,
  current,
  targets,
  micros,
}: {
  dateKey: string;
  current: MealMacros;
  targets: MealMacros;
  micros?: { sodium?: number; sugar?: number } | null;
}): Promise<{ insights: MacroOverageInsight[] } | { error: string }> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { error: "Not authenticated" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { error: "Invalid date" };
  }

  try {
    const meals = await getDailyMealLogs(profile.id, dateKey);
    const local = buildLocalDayOverageInsights({
      meals,
      current,
      targets,
      micros,
    });
    const canUseAi = hasAiAccess(profile) && isAiConfigured();

    if (!canUseAi) return { insights: local };

    const insights = await withTimeout(
      generateDayMacroOverageInsights({
        meals,
        current,
        targets,
        micros,
      }),
      AI_TIMEOUT_MS,
      local
    );
    return { insights };
  } catch (error) {
    try {
      const meals = await getDailyMealLogs(profile.id, dateKey);
      return {
        insights: buildLocalDayOverageInsights({
          meals,
          current,
          targets,
          micros,
        }),
      };
    } catch {
      return {
        error: formatUserError(
          error,
          `Failed to analyze meals${hasAiAccess(profile) ? "" : ` — upgrade to ${PLATFORM_AI_NAME} for deeper AI review`}`
        ),
      };
    }
  }
}
