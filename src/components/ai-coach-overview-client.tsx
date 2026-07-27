"use client";

import { usePlatformCopy } from "@/components/locale-provider";
import Link from "next/link";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import {
  ArrowUp,
  ChevronRight,
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
  accentClass,
  wellClass,
}: {
  href: string;
  icon: typeof Dumbbell;
  label: string;
  accentClass: string;
  wellClass: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3.5",
        "shadow-sm transition-[transform,border-color,background-color] duration-200",
        "hover:border-border hover:bg-secondary/40 active:scale-[0.98]"
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          wellClass
        )}
      >
        <Icon className={cn("h-5 w-5", accentClass)} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function ToolTile({
  href,
  icon: Icon,
  label,
  accentClass,
  wellClass,
}: {
  href: string;
  icon: typeof Dumbbell;
  label: string;
  accentClass: string;
  wellClass: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-2 py-4 text-center",
        "shadow-sm transition-[transform,border-color,background-color] duration-200",
        "hover:border-border hover:bg-secondary/40 active:scale-[0.98]"
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl",
          wellClass
        )}
      >
        <Icon className={cn("h-5 w-5", accentClass)} />
      </span>
      <span className="text-[11px] font-semibold leading-tight text-foreground">
        {label}
      </span>
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
  const { openChat } = useAiCoachChat();
  const hasGap = gap && gap.targets.calories > 0;

  return (
    <div className="space-y-6">
      {/* 1. Main action — talk to coach */}
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <AiCoachAvatar className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
            <div className="min-w-0">
              <h2 className="text-lg font-black tracking-tight">{platform.ai.askAlex}</h2>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {insightMessage}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openChat}
            aria-label={platform.ai.startChatting}
            className={cn(
              "chat-command-shell grid w-full max-w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-1 overflow-hidden",
              "rounded-full border border-border/70 bg-secondary/60 p-1 pl-1.5 shadow-sm backdrop-blur-sm transition-colors",
              "hover:border-border hover:bg-secondary/75 active:scale-[0.99]"
            )}
          >
            <span className="col-start-1 mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="col-start-2 row-start-1 min-w-0 truncate px-1 text-left text-sm text-foreground/75">
              {platform.ai.placeholder}
            </span>
            <span className="col-start-3 mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_14px_rgba(var(--primary-rgb),0.4)]">
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </span>
          </button>
        </div>
      </section>

      {/* 2. What you do next */}
      <section className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {platform.ai.buildPlan}
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <QuickLink
            href="/dashboard/ai/plans/workout"
            icon={Dumbbell}
            label={platform.ai.buildWorkoutWithAi}
            accentClass="text-primary"
            wellClass="bg-primary/10"
          />
          <QuickLink
            href="/dashboard/ai/plans/nutrition"
            icon={Salad}
            label={platform.ai.buildNutritionWithAi}
            accentClass="text-emerald-600 dark:text-emerald-400"
            wellClass="bg-emerald-500/12"
          />
        </div>
      </section>

      {/* 3. Today at a glance */}
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/12">
              <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </span>
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
                accentClass="text-orange-500 dark:text-orange-400"
                ringClass="text-orange-500 dark:text-orange-400"
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
                accentClass="text-blue-600 dark:text-blue-400"
                ringClass="text-blue-600 dark:text-blue-400"
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
                accentClass="text-amber-600 dark:text-amber-400"
                ringClass="text-amber-600 dark:text-amber-400"
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
                accentClass="text-sky-600 dark:text-sky-400"
                ringClass="text-sky-600 dark:text-sky-400"
                exceededTolerance={macroExceededDailyUpperLimit(
                  gap.consumed.fat,
                  gap.targets.fat,
                  "fat"
                )}
              />
            </div>
          ) : (
            <p className="rounded-2xl bg-secondary/50 px-3 py-5 text-center text-sm text-muted-foreground">
              {platform.ai.logMealsForRings}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-secondary/45 px-3 py-2.5 text-center">
              <p className="text-lg font-black tabular-nums">{workoutsThisWeek}</p>
              <p className="text-[10px] font-medium text-muted-foreground">
                {platform.ai.workoutsThisWeek}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/45 px-3 py-2.5 text-center">
              <p className="text-lg font-black tabular-nums">{daysTracked}/7</p>
              <p className="text-[10px] font-medium text-muted-foreground">
                {platform.ai.daysTracked}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Extra tools */}
      <section className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {platform.ai.moreTools}
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <ToolTile
            href="/dashboard/ai/meal-suggestions"
            icon={UtensilsCrossed}
            label={platform.ai.mealIdeas}
            accentClass="text-emerald-600 dark:text-emerald-400"
            wellClass="bg-emerald-500/12"
          />
          <ToolTile
            href="/dashboard/ai/recommendations"
            icon={Sparkles}
            label={platform.ai.tips}
            accentClass="text-amber-600 dark:text-amber-400"
            wellClass="bg-amber-500/12"
          />
          <ToolTile
            href="/dashboard/ai/predictions"
            icon={LineChart}
            label={platform.ai.progress}
            accentClass="text-sky-600 dark:text-sky-400"
            wellClass="bg-sky-500/12"
          />
          <ToolTile
            href="/dashboard/ai/reports"
            icon={FileText}
            label={platform.ai.weeklyScores}
            accentClass="text-primary"
            wellClass="bg-primary/10"
          />
        </div>

        {report && (
          <div className="mt-1 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
            <div className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">{platform.ai.weeklyScores}</p>
                <Link
                  href="/dashboard/ai/reports"
                  className="text-xs font-semibold text-primary"
                >
                  {platform.ai.fullReport}
                </Link>
              </div>
              <div className="flex justify-around">
                <ScoreGauge
                  score={report.training_score}
                  label={platform.ai.training}
                  colorClass="text-blue-500 dark:text-blue-400"
                />
                <ScoreGauge
                  score={report.nutrition_score}
                  label={platform.ai.nutrition}
                  colorClass="text-emerald-600 dark:text-emerald-400"
                />
                <ScoreGauge
                  score={report.consistency_score}
                  label={platform.ai.consistency}
                  colorClass="text-primary"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Space so content isn't hidden under the floating coach button */}
      <div className="h-16 lg:h-8" aria-hidden />
    </div>
  );
}
