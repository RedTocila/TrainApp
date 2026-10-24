import { createClient } from "@/lib/supabase/server";
import { hasAiAccess, hasPlusAccess } from "@/lib/subscription";
import { getDashboardAiInsight, getLatestWeeklyReport } from "@/lib/actions/ai-coach";
import { AiCoachOverviewClient } from "@/components/ai-coach-overview-client";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { formatDateKey } from "@/lib/utils";

export default async function AiCoachOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return null;

  const coachAccess = hasAiAccess(profile);
  const plusAccess = hasPlusAccess(profile);
  const locale = parseCheckoutLocale(profile.preferred_locale);
  const platform = getPlatformCopy(locale);
  const today = formatDateKey(new Date());
  const [insight, report] = plusAccess || coachAccess
    ? await Promise.all([
        coachAccess ? getDashboardAiInsight(today) : Promise.resolve(null),
        plusAccess ? getLatestWeeklyReport() : Promise.resolve(null),
      ])
    : [null, null];

  const message =
    insight && "message" in insight
      ? (insight.message ?? platform.ai.logMealsGuidance)
      : platform.ai.logMealsGuidance;
  const gap = insight && "gap" in insight ? (insight.gap ?? null) : null;
  const workoutsThisWeek =
    insight && "workoutsThisWeek" in insight ? (insight.workoutsThisWeek ?? 0) : 0;
  const daysTracked = insight && "daysTracked" in insight ? (insight.daysTracked ?? 0) : 0;
  const weekDaysCompleted =
    insight && "weekDaysCompleted" in insight && Array.isArray(insight.weekDaysCompleted)
      ? insight.weekDaysCompleted
      : [false, false, false, false, false, false, false];
  const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0] ?? "";

  return (
    <AiCoachOverviewClient
      firstName={firstName}
      insightMessage={message}
      gap={gap}
      workoutsThisWeek={workoutsThisWeek}
      daysTracked={daysTracked}
      weekDaysCompleted={weekDaysCompleted}
      plusLocked={!plusAccess}
      coachLocked={!coachAccess}
      report={
        report
          ? {
              training_score: report.training_score,
              nutrition_score: report.nutrition_score,
              consistency_score: report.consistency_score,
            }
          : null
      }
    />
  );
}
