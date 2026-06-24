"use client";

import { Beef, Egg, Flame, GlassWater, Wheat } from "lucide-react";
import { MacroRing } from "@/components/macro-ring";
import { cn } from "@/lib/utils";

type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function NutritionStatsPanel({
  current,
  targets,
  waterMl,
  waterGoalMl,
  onAddWater,
  waterLoading,
}: {
  current: MacroTotals;
  targets: MacroTotals;
  waterMl: number;
  waterGoalMl: number;
  onAddWater?: (amount: number) => void;
  waterLoading?: boolean;
}) {
  const caloriesLeft = Math.max(0, targets.calories - current.calories);
  const caloriesConsumed = current.calories;
  const calorieProgress =
    targets.calories > 0 ? Math.min(caloriesConsumed / targets.calories, 1) : 0;
  const caloriesOver = targets.calories > 0 && current.calories > targets.calories;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/30 p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Daily calories
          </p>
          <p
            className={cn(
              "text-4xl font-black tracking-tight sm:text-5xl",
              caloriesOver && "text-amber-400"
            )}
          >
            {caloriesOver ? current.calories - targets.calories : caloriesLeft}
          </p>
          <p className="text-sm text-muted-foreground">
            {caloriesOver ? "kcal over goal" : "Calories left"}
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
              className={cn(caloriesOver ? "text-amber-500" : "text-primary")}
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-border bg-card/80 p-3 sm:p-4">
          <MacroRing
            size="sm"
            value={current.protein}
            target={targets.protein}
            label="Protein"
            icon={Beef}
            accentClass="text-red-400"
            ringClass="text-red-500"
          />
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-3 sm:p-4">
          <MacroRing
            size="sm"
            value={current.carbs}
            target={targets.carbs}
            label="Carbs"
            icon={Wheat}
            accentClass="text-amber-400"
            ringClass="text-amber-500"
          />
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-3 sm:p-4">
          <MacroRing
            size="sm"
            value={current.fat}
            target={targets.fat}
            label="Fat"
            icon={Egg}
            accentClass="text-sky-400"
            ringClass="text-sky-500"
          />
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card/80 p-3 sm:p-4">
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
                  disabled={waterLoading}
                  onClick={() => onAddWater(amount)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-1.5 text-[11px] font-semibold transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10 disabled:opacity-50 sm:text-xs"
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
