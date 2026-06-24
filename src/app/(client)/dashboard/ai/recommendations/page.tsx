import { createClient } from "@/lib/supabase/server";
import { hasPaidAccess } from "@/lib/subscription";
import { getCoachContext } from "@/lib/ai/coach-context";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
import { StatBar } from "@/components/ai/stat-bar";
import { TipCard } from "@/components/ai/tip-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  Apple,
  CalendarCheck,
  Dumbbell,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { formatDateKey } from "@/lib/utils";

export default async function AiRecommendationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !hasPaidAccess(profile)) {
    return <AiUpgradeGate title="AI recommendations" />;
  }

  const today = formatDateKey(new Date());
  const ctx = await getCoachContext(user.id, today);

  const tips: {
    icon: typeof Dumbbell;
    title: string;
    body: string;
    tone: "default" | "success" | "warning" | "primary";
  }[] = [];

  if (ctx.workoutsCompleted < 3) {
    tips.push({
      icon: Dumbbell,
      title: "Train more often",
      body: `You completed ${ctx.workoutsCompleted}/4 workouts. Schedule 3+ sessions next week.`,
      tone: "warning",
    });
  } else {
    tips.push({
      icon: TrendingUp,
      title: "Solid training week",
      body: `${ctx.workoutsCompleted} workouts done — keep the rhythm going.`,
      tone: "success",
    });
  }

  if (ctx.avgProtein < ctx.targets.protein * 0.85) {
    tips.push({
      icon: Apple,
      title: "Boost protein",
      body: `Averaging ${ctx.avgProtein}g vs ${ctx.targets.protein}g target. Add protein to each meal.`,
      tone: "warning",
    });
  }

  if (ctx.daysTracked < 5) {
    tips.push({
      icon: CalendarCheck,
      title: "Track more days",
      body: `${ctx.daysTracked}/7 days logged. Aim for 5+ for better AI coaching.`,
      tone: "primary",
    });
  }

  if (ctx.habitCompletions < 7) {
    tips.push({
      icon: Activity,
      title: "Daily habits",
      body: "Small daily wins build long-term consistency.",
      tone: "default",
    });
  }

  if (tips.length === 0 || tips.every((t) => t.tone === "success")) {
    tips.push({
      icon: Sparkles,
      title: "Great week!",
      body: "Keep protein steady and maintain your workout schedule.",
      tone: "success",
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <p className="font-bold">Last 7 days</p>
          </div>
          <StatBar
            label="Workouts"
            value={ctx.workoutsCompleted}
            max={4}
            icon={Dumbbell}
            accentClass="bg-blue-500"
          />
          <StatBar
            label="Meals tracked"
            value={ctx.daysTracked}
            max={7}
            icon={CalendarCheck}
            accentClass="bg-green-500"
          />
          <StatBar
            label="Avg protein"
            value={ctx.avgProtein}
            max={ctx.targets.protein}
            unit="g"
            icon={Apple}
            accentClass="bg-amber-500"
          />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your tips
        </p>
        {tips.map((tip) => (
          <TipCard key={tip.title} icon={tip.icon} title={tip.title} tone={tip.tone}>
            {tip.body}
          </TipCard>
        ))}
      </div>
    </div>
  );
}
