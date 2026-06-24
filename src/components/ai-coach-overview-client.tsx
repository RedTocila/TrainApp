"use client";

import Link from "next/link";
import {
  Camera,
  Check,
  Dumbbell,
  FileText,
  Flame,
  LineChart,
  Salad,
  Sparkles,
  Target,
  UserRound,
  Utensils,
} from "lucide-react";
import { MacroRing } from "@/components/macro-ring";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { AiFeatureTile, FlowStep } from "@/components/ai/feature-tile";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MacroGap } from "@/lib/ai/types";

type WeeklyReportPreview = {
  training_score: number | null;
  nutrition_score: number | null;
  consistency_score: number | null;
};

export function AiCoachOverviewClient({
  insightMessage,
  gap,
  workoutsThisWeek,
  daysTracked,
  report,
}: {
  insightMessage: string;
  gap: MacroGap | null;
  workoutsThisWeek: number;
  daysTracked: number;
  report: WeeklyReportPreview | null;
}) {
  const hasGap = gap && gap.targets.calories > 0;

  return (
    <div className="space-y-5">
      {/* Plan builder flow */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <p className="font-bold">Build your plan</p>
          </div>
          <div className="flex items-center gap-1 px-1">
            <FlowStep icon={UserRound} label="Profile" active />
            <div className="h-px flex-1 bg-border" />
            <FlowStep icon={Sparkles} label="AI builds" active />
            <div className="h-px flex-1 bg-border" />
            <FlowStep icon={Check} label="Apply" active />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/dashboard/ai/plans/workout"
              className={buttonVariants({ variant: "secondary", className: "h-11" })}
            >
              <Dumbbell className="h-4 w-4" />
              Workout
            </Link>
            <Link
              href="/dashboard/ai/plans/nutrition"
              className={buttonVariants({ variant: "secondary", className: "h-11" })}
            >
              <Salad className="h-4 w-4" />
              Nutrition
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Today snapshot */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <p className="font-bold">Today</p>
          </div>

          {hasGap ? (
            <div className="grid grid-cols-4 gap-1">
              <MacroRing
                size="sm"
                value={gap.consumed.calories}
                target={gap.targets.calories}
                label="Cal"
                icon={Flame}
                accentClass="text-orange-400"
                ringClass="text-orange-400"
              />
              <MacroRing
                size="sm"
                value={gap.consumed.protein}
                target={gap.targets.protein}
                label="Protein"
                icon={Utensils}
                accentClass="text-blue-400"
                ringClass="text-blue-400"
              />
              <MacroRing
                size="sm"
                value={gap.consumed.carbs}
                target={gap.targets.carbs}
                label="Carbs"
                icon={Salad}
                accentClass="text-amber-400"
                ringClass="text-amber-400"
              />
              <MacroRing
                size="sm"
                value={gap.consumed.fat}
                target={gap.targets.fat}
                label="Fat"
                icon={Flame}
                accentClass="text-rose-400"
                ringClass="text-rose-400"
              />
            </div>
          ) : (
            <p className="rounded-lg bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
              Log meals to see macro rings
            </p>
          )}

          <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium">{insightMessage}</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-secondary/40 px-3 py-2 text-center">
              <p className="text-lg font-black">{workoutsThisWeek}</p>
              <p className="text-[10px] text-muted-foreground">Workouts this week</p>
            </div>
            <div className="rounded-xl bg-secondary/40 px-3 py-2 text-center">
              <p className="text-lg font-black">{daysTracked}/7</p>
              <p className="text-[10px] text-muted-foreground">Days tracked</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly scores */}
      {report && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <p className="font-bold">Weekly scores</p>
              </div>
              <Link href="/dashboard/ai/reports" className="text-xs font-medium text-primary">
                Full report →
              </Link>
            </div>
            <div className="flex justify-around">
              <ScoreGauge score={report.training_score} label="Training" colorClass="text-blue-400" />
              <ScoreGauge score={report.nutrition_score} label="Nutrition" colorClass="text-green-400" />
              <ScoreGauge
                score={report.consistency_score}
                label="Consistency"
                colorClass="text-primary"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log with AI - visual steps */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <p className="font-bold">Log meals with AI</p>
          </div>
          <div className="flex justify-between gap-2">
            <FlowStep icon={Camera} label="Photo / text" active />
            <div className="mt-5 h-px flex-1 bg-border" />
            <FlowStep icon={Sparkles} label="AI estimates" active />
            <div className="mt-5 h-px flex-1 bg-border" />
            <FlowStep icon={Check} label="Confirm" active />
          </div>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}>
            Go to dashboard
          </Link>
        </CardContent>
      </Card>

      {/* Feature grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
        <AiFeatureTile href="/dashboard/ai/meal-suggestions" icon={Salad} label="Meal ideas" />
        <AiFeatureTile
          href="/dashboard/ai/recommendations"
          icon={Sparkles}
          label="Tips"
          accentClass="text-amber-400"
          bgClass="bg-amber-500/10"
        />
        <AiFeatureTile
          href="/dashboard/ai/predictions"
          icon={LineChart}
          label="Progress"
          accentClass="text-blue-400"
          bgClass="bg-blue-500/10"
        />
      </div>
    </div>
  );
}
