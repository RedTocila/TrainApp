import { createClient } from "@/lib/supabase/server";
import { hasPaidAccess } from "@/lib/subscription";
import { getDashboardAiInsight, getLatestWeeklyReport } from "@/lib/actions/ai-coach";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
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

  const aiAccess = hasPaidAccess(profile);
  const locale = parseCheckoutLocale(profile.preferred_locale);
  const platform = getPlatformCopy(locale);
  const today = formatDateKey(new Date());
  const [insight, report] = aiAccess
    ? await Promise.all([getDashboardAiInsight(today), getLatestWeeklyReport()])
    : [null, null];

  if (!aiAccess) {
    return <AiUpgradeGate />;
  }

  const message =
    insight && "message" in insight
      ? (insight.message ?? platform.ai.logMealsGuidance)
      : platform.ai.logMealsGuidance;
  const gap = insight && "gap" in insight ? (insight.gap ?? null) : null;
  const workoutsThisWeek =
    insight && "workoutsThisWeek" in insight ? (insight.workoutsThisWeek ?? 0) : 0;
  const daysTracked = insight && "daysTracked" in insight ? (insight.daysTracked ?? 0) : 0;

  return (
    <AiCoachOverviewClient
      insightMessage={message}
      gap={gap}
      workoutsThisWeek={workoutsThisWeek}
      daysTracked={daysTracked}
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
