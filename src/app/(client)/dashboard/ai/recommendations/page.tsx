import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/subscription";
import { getCoachContext } from "@/lib/ai/coach-context";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateKey } from "@/lib/utils";

export default async function AiRecommendationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !hasAiAccess(profile)) {
    return <AiUpgradeGate title="AI recommendations" />;
  }

  const today = formatDateKey(new Date());
  const ctx = await getCoachContext(user.id, today);

  const recommendations: string[] = [];
  if (ctx.workoutsCompleted < 3) {
    recommendations.push("Schedule at least 3 workouts next week — consistency drives results.");
  }
  if (ctx.avgProtein < ctx.targets.protein * 0.85) {
    recommendations.push(
      `Average protein (${ctx.avgProtein}g) is below target (${ctx.targets.protein}g). Add a protein source to each meal.`
    );
  }
  if (ctx.daysTracked < 5) {
    recommendations.push("Track meals at least 5 days per week for better AI coaching accuracy.");
  }
  if (ctx.habitCompletions < 7) {
    recommendations.push("Complete daily habits — small wins compound into long-term adherence.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Strong week! Maintain protein intake and keep workout rhythm steady.");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Behavior patterns (last 7 days)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Workouts</p>
            <p className="text-2xl font-bold">{ctx.workoutsCompleted}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Days tracked</p>
            <p className="text-2xl font-bold">{ctx.daysTracked}/7</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground">Avg protein</p>
            <p className="text-2xl font-bold">{ctx.avgProtein}g</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actionable recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-primary">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
