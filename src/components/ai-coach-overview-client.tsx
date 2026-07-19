"use client";

import { usePlatformCopy } from "@/components/locale-provider";
import Link from "next/link";
import { OpenAiCoachChatButton } from "@/components/open-ai-coach-chat-button";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import {
  Dumbbell,
  FileText,
  Flame,
  LineChart,
  Salad,
  Sparkles,
  Target,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";
import { MacroRing } from "@/components/macro-ring";
import { macroExceededDailyUpperLimit } from "@/lib/macro-targets";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { Card, CardContent } from "@/components/ui/card";
import type { MacroGap } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type WeeklyReportPreview = {
  training_score: number | null;
  nutrition_score: number | null;
  consistency_score: number | null;
};

function QuickLink({
  href,
  icon: Icon,
  label,
  accentClass = "text-primary",
  bgClass = "bg-primary/10",
}: {
  href: string;
  icon: typeof Dumbbell;
  label: string;
  accentClass?: string;
  bgClass?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-3 transition-colors hover:border-primary/40 hover:bg-secondary/40"
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          bgClass
        )}
      >
        <Icon className={cn("h-5 w-5", accentClass)} />
      </span>
      <span className="min-w-0 text-sm font-semibold leading-snug">{label}</span>
    </Link>
  );
}

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
  const platform = usePlatformCopy();
  const hasGap = gap && gap.targets.calories > 0;

  return (
    <div className="space-y-6">
      {/* 1. Main action — talk to coach */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <AiCoachAvatar className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
          <div className="min-w-0">
            <h2 className="text-lg font-black tracking-tight">{platform.ai.askAlex}</h2>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {insightMessage}
            </p>
          </div>
        </div>
        <OpenAiCoachChatButton className="h-12 w-full text-base">
          {platform.ai.startChatting}
        </OpenAiCoachChatButton>
      </section>

      {/* 2. What you do next */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {platform.ai.buildPlan}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <QuickLink
            href="/dashboard/ai/plans/workout"
            icon={Dumbbell}
            label={platform.ai.buildWorkoutWithAi}
          />
          <QuickLink
            href="/dashboard/ai/plans/nutrition"
            icon={Salad}
            label={platform.ai.buildNutritionWithAi}
            accentClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
          />
        </div>
      </section>

      {/* 3. Today at a glance */}
      <section>
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold">{platform.ai.today}</p>
            </div>

            {hasGap ? (
              <div className="grid grid-cols-4 gap-1">
                <MacroRing
                  size="sm"
                  value={gap.consumed.calories}
                  target={gap.targets.calories}
                  label={platform.ai.cal}
                  icon={Flame}
                  accentClass="text-orange-400"
                  ringClass="text-orange-400"
                  exceededTolerance={macroExceededDailyUpperLimit(
                    gap.consumed.calories,
                    gap.targets.calories,
                    "calories"
                  )}
                />
                <MacroRing
                  size="sm"
                  value={gap.consumed.protein}
                  target={gap.targets.protein}
                  label={platform.ai.protein}
                  icon={Utensils}
                  accentClass="text-blue-400"
                  ringClass="text-blue-400"
                  exceededTolerance={macroExceededDailyUpperLimit(
                    gap.consumed.protein,
                    gap.targets.protein,
                    "protein"
                  )}
                />
                <MacroRing
                  size="sm"
                  value={gap.consumed.carbs}
                  target={gap.targets.carbs}
                  label={platform.ai.carbs}
                  icon={Salad}
                  accentClass="text-amber-400"
                  ringClass="text-amber-400"
                  exceededTolerance={macroExceededDailyUpperLimit(
                    gap.consumed.carbs,
                    gap.targets.carbs,
                    "carbs"
                  )}
                />
                <MacroRing
                  size="sm"
                  value={gap.consumed.fat}
                  target={gap.targets.fat}
                  label={platform.ai.fat}
                  icon={Flame}
                  accentClass="text-sky-400"
                  ringClass="text-sky-500"
                  exceededTolerance={macroExceededDailyUpperLimit(
                    gap.consumed.fat,
                    gap.targets.fat,
                    "fat"
                  )}
                />
              </div>
            ) : (
              <p className="rounded-lg bg-secondary/40 px-3 py-5 text-center text-sm text-muted-foreground">
                {platform.ai.logMealsForRings}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-secondary/40 px-3 py-2 text-center">
                <p className="text-lg font-black">{workoutsThisWeek}</p>
                <p className="text-[10px] text-muted-foreground">
                  {platform.ai.workoutsThisWeek}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/40 px-3 py-2 text-center">
                <p className="text-lg font-black">{daysTracked}/7</p>
                <p className="text-[10px] text-muted-foreground">
                  {platform.ai.daysTracked}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Extra tools */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {platform.ai.moreTools}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link
            href="/dashboard/ai/meal-suggestions"
            className="flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/60 px-2 py-3 text-center transition-colors hover:border-primary/40"
          >
            <UtensilsCrossed className="h-5 w-5 text-emerald-400" />
            <span className="text-[11px] font-semibold">{platform.ai.mealIdeas}</span>
          </Link>
          <Link
            href="/dashboard/ai/recommendations"
            className="flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/60 px-2 py-3 text-center transition-colors hover:border-primary/40"
          >
            <Sparkles className="h-5 w-5 text-amber-400" />
            <span className="text-[11px] font-semibold">{platform.ai.tips}</span>
          </Link>
          <Link
            href="/dashboard/ai/predictions"
            className="flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/60 px-2 py-3 text-center transition-colors hover:border-primary/40"
          >
            <LineChart className="h-5 w-5 text-blue-400" />
            <span className="text-[11px] font-semibold">{platform.ai.progress}</span>
          </Link>
          <Link
            href="/dashboard/ai/reports"
            className="flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/60 px-2 py-3 text-center transition-colors hover:border-primary/40"
          >
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-[11px] font-semibold">{platform.ai.weeklyScores}</span>
          </Link>
        </div>

        {report && (
          <Card className="mt-2">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">{platform.ai.weeklyScores}</p>
                <Link
                  href="/dashboard/ai/reports"
                  className="text-xs font-medium text-primary"
                >
                  {platform.ai.fullReport}
                </Link>
              </div>
              <div className="flex justify-around">
                <ScoreGauge
                  score={report.training_score}
                  label={platform.ai.training}
                  colorClass="text-blue-400"
                />
                <ScoreGauge
                  score={report.nutrition_score}
                  label={platform.ai.nutrition}
                  colorClass="text-green-400"
                />
                <ScoreGauge
                  score={report.consistency_score}
                  label={platform.ai.consistency}
                  colorClass="text-primary"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Space so content isn't hidden under the floating coach button */}
      <div className="h-16 lg:h-8" aria-hidden />
    </div>
  );
}
