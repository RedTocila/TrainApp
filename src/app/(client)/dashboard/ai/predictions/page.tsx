import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/subscription";
import { getCoachContext } from "@/lib/ai/coach-context";
import { computeProgressPrediction } from "@/lib/ai/progress-prediction";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { formatDateKey } from "@/lib/utils";
import { buildPricingHref } from "@/lib/pricing-nav";
import { redirect } from "next/navigation";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { ProgressPredictionStats } from "@/components/progress-prediction-stats";
import { WeightChart } from "@/components/weight-chart";
import {
  PremiumSurface,
  PremiumSurfaceHeader,
} from "@/components/premium-surface";
import { LineChart } from "lucide-react";

export default async function AiPredictionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const platform = getPlatformCopy(parseCheckoutLocale(profile?.preferred_locale));
  const copy = platform.aiPages;

  if (!profile || !hasAiAccess(profile)) {
    redirect(buildPricingHref("/dashboard/ai/predictions"));
  }

  const today = formatDateKey(new Date());
  const ctx = await getCoachContext(user.id, today);
  const weightHistory = ctx.weightHistory.map((entry) => ({
    ...entry,
    weight_kg: Number(entry.weight_kg),
  }));
  const prediction = computeProgressPrediction(
    weightHistory,
    ctx.profile?.intake_weight_kg ?? null
  );

  return (
    <div className="space-y-4">
      <PremiumSurface accent="amber" rounded="3xl" className="p-4 sm:p-5">
        <PremiumSurfaceHeader icon={LineChart} title="Your projection" accent="amber" />

        <div className="flex flex-wrap items-center justify-center gap-6">
          {prediction.goal_progress_pct != null && (
            <ScoreGauge
              score={prediction.goal_progress_pct}
              label={copy.goalProgress}
              colorClass="text-amber-400"
              size="lg"
            />
          )}
        </div>

        <div className="mt-4">
          <ProgressPredictionStats prediction={prediction} />
        </div>

        {prediction.summary ? (
          <p className="mt-4 rounded-2xl border border-border/50 bg-background/40 px-3 py-2.5 text-center text-sm text-muted-foreground backdrop-blur-sm">
            {prediction.summary}
          </p>
        ) : null}
      </PremiumSurface>

      {weightHistory.length > 1 ? (
        <PremiumSurface accent="primary" className="p-4 sm:p-5">
          <PremiumSurfaceHeader icon={LineChart} title="Weight trend" accent="primary" />
          <WeightChart
            entries={weightHistory}
            startWeightKg={profile.intake_weight_kg}
            startDate={profile.created_at?.slice(0, 10) ?? null}
          />
        </PremiumSurface>
      ) : null}
    </div>
  );
}
