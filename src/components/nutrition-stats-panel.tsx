"use client";

import { Beef, Egg, Flame, GlassWater, Wheat } from "lucide-react";
import { MacroRing } from "@/components/macro-ring";
import { dashboard } from "@/components/dashboard-ui";
import { DashboardStatusCheck } from "@/components/section-completed-badge";
import { macroExceededDailyUpperLimit, macroExceededAttentionMessage } from "@/lib/macro-targets";
import type { MealMacros } from "@/lib/meal-utils";
import { cn } from "@/lib/utils";

type MacroTotals = MealMacros;

export function NutritionStatsPanel({
  current,
  targets,
  waterMl,
  waterGoalMl,
  onAddWater,
  variant = "card",
}: {
  current: MacroTotals;
  targets: MacroTotals;
  waterMl: number;
  waterGoalMl: number;
  onAddWater?: (amount: number) => void;
  variant?: "card" | "flat";
}) {
  const caloriesLeft = Math.max(0, targets.calories - current.calories);
  const caloriesConsumed = current.calories;
  const calorieProgress =
    targets.calories > 0 ? Math.min(caloriesConsumed / targets.calories, 1) : 0;
  const caloriesOver = targets.calories > 0 && current.calories > targets.calories;
  const caloriesUnrecoverable = macroExceededDailyUpperLimit(
    current.calories,
    targets.calories,
    "calories"
  );
  const macrosExceededMessage = macroExceededAttentionMessage(current, targets);
  const waterCompleted = waterGoalMl > 0 && waterMl >= waterGoalMl;
  const flat = variant === "flat";

  return (
    <div className="space-y-4">
      {macrosExceededMessage && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-300">
          {macrosExceededMessage}
        </div>
      )}
      <div
        className={cn(
          flat ? "px-1" : dashboard.heroTile
        )}
      >
        <div className="min-w-0 space-y-1">
          <p className={dashboard.label}>Daily calories</p>
          <p
            className={cn(
              dashboard.heroValue,
              caloriesUnrecoverable
                ? "text-red-400"
                : caloriesOver && "text-amber-400"
            )}
          >
            {caloriesOver ? current.calories - targets.calories : caloriesLeft}
          </p>
          <p className="text-sm text-muted-foreground">
            {caloriesUnrecoverable
              ? "kcal over limit"
              : caloriesOver
                ? "kcal over goal"
                : "Calories left"}
            {!caloriesOver && (
              <span className="text-muted-foreground/70">
                {" "}
                · {caloriesConsumed} eaten
              </span>
            )}
          </p>
        </div>
        <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-secondary"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              className={cn(
                caloriesUnrecoverable
                  ? "text-red-500"
                  : caloriesOver
                    ? "text-amber-500"
                    : "text-primary"
              )}
              strokeDasharray={2 * Math.PI * 42}
              strokeDashoffset={2 * Math.PI * 42 * (1 - calorieProgress)}
              style={{ transition: "stroke-dashoffset 0.45s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 sm:h-16 sm:w-16">
              <Flame className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
            </div>
          </div>
        </div>
      </div>

      <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", flat ? "sm:gap-3" : "sm:gap-4")}>
        <div className={cn(flat ? "px-1" : dashboard.metricTile)}>
          <MacroRing
            size="sm"
            value={current.protein}
            target={targets.protein}
            label="Protein"
            icon={Beef}
            accentClass="text-red-400"
            ringClass="text-red-500"
            exceededTolerance={macroExceededDailyUpperLimit(
              current.protein,
              targets.protein,
              "protein"
            )}
          />
        </div>
        <div className={cn(flat ? "px-1" : dashboard.metricTile)}>
          <MacroRing
            size="sm"
            value={current.carbs}
            target={targets.carbs}
            label="Carbs"
            icon={Wheat}
            accentClass="text-amber-400"
            ringClass="text-amber-500"
            exceededTolerance={macroExceededDailyUpperLimit(
              current.carbs,
              targets.carbs,
              "carbs"
            )}
          />
        </div>
        <div className={cn(flat ? "px-1" : dashboard.metricTile)}>
          <MacroRing
            size="sm"
            value={current.fat}
            target={targets.fat}
            label="Fat"
            icon={Egg}
            accentClass="text-sky-400"
            ringClass="text-sky-500"
            exceededTolerance={macroExceededDailyUpperLimit(
              current.fat,
              targets.fat,
              "fat"
            )}
          />
        </div>
        <div
          className={cn(
            "relative flex flex-col items-center",
            flat ? "px-1" : dashboard.metricTile
          )}
        >
          {waterCompleted && (
            <div className="absolute right-2 top-2">
              <DashboardStatusCheck aria-label="Water goal reached" className="h-5 w-5" />
            </div>
          )}
          <MacroRing
            size="sm"
            value={waterMl}
            target={waterGoalMl}
            label="Water"
            unit="ml"
            icon={GlassWater}
            accentClass="text-cyan-400"
            ringClass="text-cyan-500"
          />
          {onAddWater && (
            <div className="mt-2 flex w-full gap-1.5">
              {[250, 500].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => onAddWater(amount)}
                  className={cn(dashboard.chipButton, "px-2 py-1.5 text-[11px] sm:text-xs")}
                >
                  <GlassWater className="h-3 w-3 shrink-0 text-cyan-400" />
                  +{amount}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
