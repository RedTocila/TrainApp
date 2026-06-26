import { getCoachContext } from "@/lib/ai/coach-context";
import type { CoachChatRichBlock } from "@/lib/ai/coach-chat-block-types";
import { buildWeeklyCoachReport } from "@/lib/ai/generate-weekly-report";
import { generateMealSuggestions } from "@/lib/ai/meal-suggestions";
import { computeProgressPrediction } from "@/lib/ai/progress-prediction";
import { formatExceededMacroSummary } from "@/lib/macro-targets";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { formatDateKey } from "@/lib/utils";
import type { Profile } from "@/lib/types";

function buildInsightMessage(
  gap: Awaited<ReturnType<typeof getCoachContext>>["macroGap"]
): string {
  if (gap.overTolerance) {
    const summary = formatExceededMacroSummary(gap.consumed, gap.targets);
    return `You went over your macro limit today (${summary}). Eat lighter tomorrow and review today's meals.`;
  }
  if (gap.protein > 25) {
    return `You need about ${Math.round(gap.protein)}g more protein today. Try chicken, Greek yogurt, tuna, or protein oats.`;
  }
  if (gap.calories > 400) {
    return `~${Math.round(gap.calories)} calories left — plan a balanced meal with lean protein.`;
  }
  if (gap.calories <= 0 && gap.protein <= 10) {
    return "You're within your macro range today. Keep portions steady if you're still hungry.";
  }
  return "You're on track with nutrition today.";
}

export async function buildTodaySnapshotBlocks(
  clientId: string,
  profile: Profile
): Promise<CoachChatRichBlock[]> {
  const today = formatDateKey(new Date());
  const ctx = await getCoachContext(clientId, today);
  const insight = buildInsightMessage(ctx.macroGap);

  const blocks: CoachChatRichBlock[] = [
    { type: "section_header", title: "Today", subtitle: "Macros & activity" },
    { type: "macro_rings", gap: ctx.macroGap },
    {
      type: "insight_banner",
      text: insight,
      tone: ctx.macroGap.overTolerance ? "warning" : "default",
    },
    {
      type: "stat_tiles",
      tiles: [
        { label: "Workouts this week", value: String(ctx.workoutsCompleted) },
        { label: "Days tracked", value: `${ctx.daysTracked}/7` },
      ],
    },
  ];

  const supabase = await import("@/lib/supabase/server").then((m) => m.createClient());
  const { data: latestReport } = await supabase
    .from("ai_reports")
    .select("training_score, nutrition_score, consistency_score")
    .eq("user_id", clientId)
    .eq("report_type", "weekly")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestReport) {
    blocks.push({
      type: "score_gauges",
      gauges: [
        {
          score: latestReport.training_score,
          label: "Training",
          colorClass: "text-blue-400",
        },
        {
          score: latestReport.nutrition_score,
          label: "Nutrition",
          colorClass: "text-green-400",
        },
        {
          score: latestReport.consistency_score,
          label: "Consistency",
          colorClass: "text-primary",
        },
      ],
    });
  }

  return blocks;
}

export async function buildWeeklyReportBlocks(
  clientId: string
): Promise<CoachChatRichBlock[]> {
  const report = await buildWeeklyCoachReport(clientId);
  return [
    {
      type: "section_header",
      title: "Weekly report",
      subtitle: `${report.period_start} → ${report.period_end}`,
    },
    { type: "weekly_report", report },
  ];
}

export async function buildMealIdeasBlocks(clientId: string): Promise<CoachChatRichBlock[]> {
  const today = formatDateKey(new Date());
  const ctx = await getCoachContext(clientId, today);
  const { headline, suggestions } = await generateMealSuggestions(ctx.macroGap);

  return [
    {
      type: "section_header",
      title: ctx.macroGap.overTolerance ? "Over limit today" : "Meal ideas",
      subtitle: "Based on your remaining macros",
    },
    { type: "macro_rings", gap: ctx.macroGap },
    { type: "meal_suggestions", headline, gap: ctx.macroGap, suggestions },
  ];
}

export async function buildWeightTrendBlocks(
  clientId: string,
  profile: Profile
): Promise<CoachChatRichBlock[]> {
  const today = formatDateKey(new Date());
  const ctx = await getCoachContext(clientId, today);
  const weightHistory = ctx.weightHistory.map((entry) => ({
    ...entry,
    weight_kg: Number(entry.weight_kg),
  }));
  const prediction = computeProgressPrediction(
    weightHistory,
    profile.intake_weight_kg ?? null
  );

  return [
    { type: "section_header", title: "Weight trend", subtitle: "Projection & history" },
    {
      type: "weight_trend",
      prediction,
      weightHistory,
      startWeightKg: profile.intake_weight_kg,
      startDate: profile.created_at?.slice(0, 10) ?? null,
    },
  ];
}

export async function buildCoachingTipsBlocks(
  clientId: string,
  profile: Profile
): Promise<CoachChatRichBlock[]> {
  const today = formatDateKey(new Date());
  const ctx = await getCoachContext(clientId, today);
  const copy = getPlatformCopy(parseCheckoutLocale(profile.preferred_locale)).aiPages;

  const tipList: Extract<CoachChatRichBlock, { type: "tip_cards" }>["tips"] = [];

  if (ctx.workoutsCompleted < 3) {
    tipList.push({
      icon: "dumbbell",
      title: copy.trainMoreOften,
      body: copy.trainMoreOftenBody,
      tone: "warning",
    });
  } else {
    tipList.push({
      icon: "trending-up",
      title: copy.solidTrainingWeek,
      body: copy.solidTrainingWeekBody,
      tone: "success",
    });
  }

  if (ctx.avgProtein < ctx.targets.protein * 0.85) {
    tipList.push({
      icon: "apple",
      title: copy.boostProtein,
      body: copy.boostProteinBody,
      tone: "warning",
    });
  }

  if (ctx.daysTracked < 5) {
    tipList.push({
      icon: "calendar",
      title: copy.trackMoreDays,
      body: copy.trackMoreDaysBody,
      tone: "primary",
    });
  }

  if (ctx.habitCompletions < 7) {
    tipList.push({
      icon: "activity",
      title: copy.dailyHabits,
      body: copy.dailyHabitsBody,
      tone: "default",
    });
  }

  if (tipList.length === 0 || tipList.every((t) => t.tone === "success")) {
    tipList.push({
      icon: "sparkles",
      title: copy.greatWeek,
      body: copy.greatWeekBody,
      tone: "success",
    });
  }

  return [
    { type: "section_header", title: "Last 7 days", subtitle: "Stats & coaching tips" },
    {
      type: "stat_bars",
      bars: [
        {
          label: copy.workouts,
          value: ctx.workoutsCompleted,
          max: 4,
          accentClass: "bg-blue-500",
        },
        {
          label: copy.mealsTracked,
          value: ctx.daysTracked,
          max: 7,
          accentClass: "bg-green-500",
        },
        {
          label: copy.avgProtein,
          value: ctx.avgProtein,
          max: ctx.targets.protein,
          unit: "g",
          accentClass: "bg-amber-500",
        },
      ],
    },
    { type: "tip_cards", tips: tipList },
  ];
}
