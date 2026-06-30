import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/subscription";
import { getCoachContext } from "@/lib/ai/coach-context";
import { computeProgressPrediction } from "@/lib/ai/progress-prediction";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { formatDateKey } from "@/lib/utils";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { ProgressPredictionStats } from "@/components/progress-prediction-stats";
import { WeightChart } from "@/components/weight-chart";
import { Card, CardContent } from "@/components/ui/card";
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
    return <AiUpgradeGate title={copy.predictionsTitle} />;
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
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            <p className="font-bold">Your projection</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            {prediction.goal_progress_pct != null && (
              <ScoreGauge
                score={prediction.goal_progress_pct}
                label={copy.goalProgress}
                colorClass="text-primary"
                size="lg"
              />
            )}
          </div>

          <ProgressPredictionStats prediction={prediction} />

          {prediction.summary && (
            <p className="rounded-lg bg-secondary/40 px-3 py-2 text-center text-sm text-muted-foreground">
              {prediction.summary}
            </p>
          )}
        </CardContent>
      </Card>

      {weightHistory.length > 1 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              <p className="font-bold">Weight trend</p>
            </div>
            <WeightChart
              entries={weightHistory}
              startWeightKg={profile.intake_weight_kg}
              startDate={profile.created_at?.slice(0, 10) ?? null}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
