import { createClient } from "@/lib/supabase/server";
import { getCoachContext } from "@/lib/ai/coach-context";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { isAiConfigured, runTextPrompt } from "@/lib/ai/providers";
import type { WeeklyCoachReport } from "@/lib/ai/types";
import { formatDateKey } from "@/lib/utils";

function scoreFromRatio(ratio: number): number {
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

export async function buildWeeklyCoachReport(
  clientId: string,
  options?: { persist?: boolean }
): Promise<WeeklyCoachReport> {
  const today = formatDateKey(new Date());
  const ctx = await getCoachContext(clientId, today);

  const trainingScore = scoreFromRatio(Math.min(1, ctx.workoutsCompleted / 4));
  const nutritionScore = scoreFromRatio(
    ctx.daysTracked >= 5 && ctx.avgProtein >= ctx.targets.protein * 0.85
      ? 1
      : ctx.daysTracked / 7
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

Progress photos (Coach Alex vision analysis):
${ctx.progressPhotoContextText}

Scores: training ${trainingScore}, nutrition ${nutritionScore}, consistency ${consistencyScore}.

Include physique/progress photo insights when relevant (visual progress, focus areas, missing muscle groups, invalid photos to retake).

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
      // fall through to defaults
    }
  }

  if (highlights.length === 0) {
    if (ctx.workoutsCompleted >= 3) highlights.push("Solid workout consistency this week.");
    if (ctx.daysTracked >= 5) highlights.push("Good nutrition tracking habit.");
  }
  if (concerns.length === 0) {
    if (ctx.progressPhotoSummary.invalidCount > 0) {
      concerns.push("Some progress photos were rejected — retake front, back, and side check-ins properly.");
    }
    if (ctx.progressPhotoSummary.missingPoses.length > 0 && ctx.progressPhotoSummary.latestMonthKey) {
      concerns.push(
        `Missing progress photo poses this month: ${ctx.progressPhotoSummary.missingPoses.join(", ")}.`
      );
    }
    if (ctx.macroGap.overTolerance) {
      concerns.push("Daily macros exceeded your tolerance band — portions were too high.");
    }
    if (ctx.avgProtein < ctx.targets.protein * 0.8) {
      concerns.push("Protein intake averaged below target — muscle recovery may suffer.");
    }
    if (ctx.workoutsCompleted < 2) {
      concerns.push("Few workouts completed — training stimulus was low.");
    }
  }
  if (recommendations.length === 0) {
    if (ctx.progressPhotoSummary.focusAreas.length > 0) {
      recommendations.push(
        `From your progress photos, prioritize: ${ctx.progressPhotoSummary.focusAreas.slice(0, 3).join(", ")}.`
      );
    }
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

  if (options?.persist !== false) {
    const supabase = await createClient();
    await supabase.from("ai_reports").upsert(
      {
        user_id: clientId,
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
        payload: {
          context: { workouts: ctx.workoutsCompleted, daysTracked: ctx.daysTracked },
        },
      },
      { onConflict: "user_id,report_type,period_start" }
    );
  }

  return report;
}
