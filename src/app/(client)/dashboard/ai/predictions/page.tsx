import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/subscription";
import { getProgressPredictionAction } from "@/lib/actions/ai-coach";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
import { WeightChart } from "@/components/weight-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AiPredictionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !hasAiAccess(profile)) {
    return <AiUpgradeGate title="AI progress predictions" />;
  }

  const result = await getProgressPredictionAction();
  if ("error" in result && result.error) {
    return <p className="text-sm text-red-400">{result.error}</p>;
  }
  if (!("prediction" in result)) return null;

  const { prediction, weightHistory } = result;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress projection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{prediction.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {prediction.current_weight_kg != null && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Current weight</p>
                <p className="text-xl font-bold">{prediction.current_weight_kg} kg</p>
              </div>
            )}
            {prediction.weekly_change_kg != null && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Weekly trend</p>
                <p className="text-xl font-bold">
                  {prediction.weekly_change_kg > 0 ? "+" : ""}
                  {prediction.weekly_change_kg} kg/wk
                </p>
              </div>
            )}
            {prediction.estimated_goal_date && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Est. goal date</p>
                <p className="text-xl font-bold">{prediction.estimated_goal_date}</p>
              </div>
            )}
            {prediction.goal_progress_pct != null && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Goal progress</p>
                <p className="text-xl font-bold">{prediction.goal_progress_pct}%</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {weightHistory.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weight trend</CardTitle>
          </CardHeader>
          <CardContent>
            <WeightChart entries={weightHistory} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
