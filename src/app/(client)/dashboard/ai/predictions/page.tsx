import { createClient } from "@/lib/supabase/server";
import { hasPaidAccess } from "@/lib/subscription";
import { getProgressPredictionAction } from "@/lib/actions/ai-coach";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { WeightChart } from "@/components/weight-chart";
import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Scale, Target, TrendingDown, TrendingUp } from "lucide-react";

export default async function AiPredictionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !hasPaidAccess(profile)) {
    return <AiUpgradeGate title="AI progress predictions" />;
  }

  const result = await getProgressPredictionAction();
  if ("error" in result && result.error) {
    return <p className="text-sm text-red-400">{result.error}</p>;
  }
  if (!("prediction" in result)) return null;

  const { prediction, weightHistory } = result;
  const trendingUp = (prediction.weekly_change_kg ?? 0) > 0;
  const TrendIcon = trendingUp ? TrendingUp : TrendingDown;

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
                label="Goal progress"
                icon={Target}
                colorClass="text-primary"
                size="lg"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {prediction.current_weight_kg != null && (
              <div className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3">
                <Scale className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-lg font-black">{prediction.current_weight_kg} kg</p>
                  <p className="text-[10px] text-muted-foreground">Current</p>
                </div>
              </div>
            )}
            {prediction.weekly_change_kg != null && (
              <div className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3">
                <TrendIcon
                  className={`h-5 w-5 ${trendingUp ? "text-amber-400" : "text-green-400"}`}
                />
                <div>
                  <p className="text-lg font-black">
                    {prediction.weekly_change_kg > 0 ? "+" : ""}
                    {prediction.weekly_change_kg}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kg / week</p>
                </div>
              </div>
            )}
            {prediction.estimated_goal_date && (
              <div className="col-span-2 flex items-center gap-3 rounded-xl bg-primary/10 p-3">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-bold">{prediction.estimated_goal_date}</p>
                  <p className="text-[10px] text-muted-foreground">Estimated goal date</p>
                </div>
              </div>
            )}
          </div>

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
            <WeightChart entries={weightHistory} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
