"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { PLATFORM_AI_PRO_NAME } from "@/lib/brand";
import { hasAiAccess } from "@/lib/subscription";
import { isAiConfigured } from "@/lib/ai/providers";
import { getCoachContext } from "@/lib/ai/coach-context";
import { loadMealSuggestions } from "@/lib/ai/load-meal-suggestions";
import { computeProgressPrediction } from "@/lib/ai/progress-prediction";
import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import type { MacroGap, MealSuggestion, WeeklyCoachReport } from "@/lib/ai/types";
import { formatExceededMacroSummary } from "@/lib/macro-targets";
import { formatDateKey } from "@/lib/utils";

async function requireAiCoachAccess(): Promise<
  { success: true; profile: Awaited<ReturnType<typeof getSubscriptionProfile>> & {} } | { success: false; error: string }
> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { success: false, error: "Not authenticated" };
  if (!hasAiAccess(profile)) {
    return { success: false, error: `Upgrade to ${PLATFORM_AI_PRO_NAME} to access AI Coach features.` };
  }
  return { success: true, profile };
}

export async function getMealSuggestionsAction(
  dateKey: string
): Promise<
  { error: string } | { headline: string; suggestions: MealSuggestion[]; gap: MacroGap }
> {
  const access = await requireAiCoachAccess();
  if (!access.success) return { error: access.error };

  const result = await loadMealSuggestions(access.profile.id, dateKey);
  revalidatePath("/dashboard/ai/meal-suggestions");
  return result;
}

export async function getProgressPredictionAction(): Promise<
  { error: string } | { prediction: import("@/lib/ai/types").ProgressPrediction; weightHistory: import("@/lib/types").BodyWeightLog[] }
> {
  const access = await requireAiCoachAccess();
  if (!access.success) return { error: access.error };

  const today = formatDateKey(new Date());
  const ctx = await getCoachContext(access.profile.id, today);
  const goalWeight = ctx.profile?.intake_weight_kg ?? null;
  const prediction = computeProgressPrediction(ctx.weightHistory, goalWeight);

  return { prediction, weightHistory: ctx.weightHistory.slice(-30) };
}

function scoreFromRatio(ratio: number): number {
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

export async function generateWeeklyCoachReportAction(): Promise<
  WeeklyCoachReport | { error: string }
> {
  const access = await requireAiCoachAccess();
  if (!access.success) return { error: access.error };

  const today = formatDateKey(new Date());
  const ctx = await getCoachContext(access.profile.id, today);

  const trainingScore = scoreFromRatio(Math.min(1, ctx.workoutsCompleted / 4));
  const nutritionScore = scoreFromRatio(
    ctx.daysTracked >= 5 && ctx.avgProtein >= ctx.targets.protein * 0.85 ? 1 : ctx.daysTracked / 7
  );
  const consistencyScore = scoreFromRatio(
    (ctx.workoutsCompleted / 4 + ctx.daysTracked / 7 + ctx.habitCompletions / 14) / 3
  );

  const periodEnd = today;
  const periodStartDate = new Date(today);
  periodStartDate.setDate(periodStartDate.getDate() - 6);
  const periodStart = formatDateKey(periodStartDate);

  let summary = `Training ${trainingScore}/100 · Nutrition ${nutritionScore}/100 · Consistency ${consistencyScore}/100.`;
  let highlights: string[] = [];
  let concerns: string[] = [];
  let recommendations: string[] = [];

  if (isAiConfigured()) {
    try {
      const raw = await runTextPrompt(
        `You are an expert fitness coach. Write a weekly report card based on:
- Workouts completed this week: ${ctx.workoutsCompleted}
- Days with meal tracking: ${ctx.daysTracked}/7
- Avg daily protein: ${ctx.avgProtein}g (target ${ctx.targets.protein}g)
- Habit completions: ${ctx.habitCompletions}
- Weight entries: ${ctx.weightHistory.length}
- User goal: ${ctx.profile?.goal ?? "general fitness"}

Scores: training ${trainingScore}, nutrition ${nutritionScore}, consistency ${consistencyScore}.

Respond with ONLY JSON:
{
  "summary": "2-3 sentence coach summary",
  "highlights": ["what improved"],
  "concerns": ["what slowed progress"],
  "recommendations": ["actionable next steps"]
}`,
        { maxTokens: 900, json: true }
      );
      const parsed = parseJsonObject<{
        summary?: string;
        highlights?: string[];
        concerns?: string[];
        recommendations?: string[];
      }>(raw);
      summary = parsed.summary ?? summary;
      highlights = parsed.highlights ?? [];
      concerns = parsed.concerns ?? [];
      recommendations = parsed.recommendations ?? [];
    } catch {
      // use defaults below
    }
  }

  if (highlights.length === 0) {
    if (ctx.workoutsCompleted >= 3) highlights.push("Solid workout consistency this week.");
    if (ctx.daysTracked >= 5) highlights.push("Good nutrition tracking habit.");
  }
  if (concerns.length === 0) {
    if (ctx.macroGap.overTolerance) {
      concerns.push("Daily macros exceeded your tolerance band — portions were too high.");
    }
    if (ctx.avgProtein < ctx.targets.protein * 0.8) {
      concerns.push("Protein intake averaged below target — muscle recovery may suffer.");
    }
    if (ctx.workoutsCompleted < 2) concerns.push("Few workouts completed — training stimulus was low.");
  }
  if (recommendations.length === 0) {
    if (ctx.macroGap.overTolerance) {
      recommendations.push(
        "You exceeded your macro ceiling — review today's meals and plan smaller portions tomorrow."
      );
    } else if (ctx.macroGap.protein > 20) {
      recommendations.push("Add a high-protein snack daily (Greek yogurt, chicken, or shake).");
    }
    recommendations.push("Schedule workouts at the same time each day to build consistency.");
  }

  const report: WeeklyCoachReport = {
    period_start: periodStart,
    period_end: periodEnd,
    scores: {
      training: trainingScore,
      nutrition: nutritionScore,
      consistency: consistencyScore,
    },
    summary,
    highlights,
    concerns,
    recommendations,
  };

  const supabase = await createClient();
  await supabase.from("ai_reports").upsert(
    {
      user_id: access.profile.id,
      report_type: "weekly",
      period_start: periodStart,
      period_end: periodEnd,
      training_score: trainingScore,
      nutrition_score: nutritionScore,
      consistency_score: consistencyScore,
      summary,
      highlights,
      concerns,
      recommendations,
      payload: { context: { workouts: ctx.workoutsCompleted, daysTracked: ctx.daysTracked } },
    },
    { onConflict: "user_id,report_type,period_start" }
  );

  revalidatePath("/dashboard/ai/reports");
  return report;
}

export async function getLatestWeeklyReport() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("ai_reports")
    .select("*")
    .eq("user_id", user.id)
    .eq("report_type", "weekly")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function getRecentAiInsights(limit = 5) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function getDashboardAiInsight(dateKey: string) {
  const access = await requireAiCoachAccess();
  if (!access.success) return { hasAi: false as const };

  const ctx = await getCoachContext(access.profile.id, dateKey);
  const gap = ctx.macroGap;

  let message = "You're on track with nutrition today.";
  if (gap.overTolerance) {
    const summary = formatExceededMacroSummary(gap.consumed, gap.targets);
    message = `You went over your macro limit today (${summary}). Don't add more food — review today's meals and eat lighter tomorrow.`;
  } else if (gap.protein > 25) {
    message = `You need about ${Math.round(gap.protein)}g more protein today. Try chicken, Greek yogurt, tuna, or protein oats.`;
  } else if (gap.calories > 400) {
    message = `~${Math.round(gap.calories)} calories left — plan a balanced meal with lean protein.`;
  } else if (gap.calories <= 0 && gap.protein <= 10) {
    message = "You're within your macro range today. Keep portions steady if you're still hungry.";
  }

  return {
    hasAi: true as const,
    message,
    gap,
    workoutsThisWeek: ctx.workoutsCompleted,
    daysTracked: ctx.daysTracked,
  };
}
