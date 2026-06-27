"use client";

import { useState } from "react";
import {
  Beef,
  Candy,
  Egg,
  Flame,
  FlaskConical,
  Heart,
  Leaf,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { dashboard, DashboardCarouselDots } from "@/components/dashboard-ui";
import { MiniProgressRing } from "@/components/nutrition-macro-rings";
import type { MealMacros } from "@/lib/meal-utils";
import {
  DAILY_MICRO_TARGETS,
  scoreDailyNutrition,
  type DailyMicros,
  type NutritionDayContext,
} from "@/lib/nutrition-day-utils";
import { macroExceededDailyUpperLimit } from "@/lib/macro-targets";
import { cn } from "@/lib/utils";

const OVER_RING = "text-red-500";
const OVER_ICON = "text-red-400";

type MacroKey = keyof MealMacros;

function MacroVerticalCard({
  value,
  target,
  label,
  unit = "g",
  icon,
  ringClass,
  iconClass,
  over,
}: {
  value: number;
  target: number;
  label: string;
  unit?: string;
  icon: LucideIcon;
  ringClass: string;
  iconClass: string;
  over: boolean;
}) {
  const remaining = Math.max(0, target - value);
  const display = over ? value - target : remaining;
  const progress = target > 0 ? Math.min(value / target, 1) : 0;

  return (
    <div className={dashboard.metricTile}>
      <div>
        <p
          className={cn(
            "text-2xl font-black tabular-nums leading-none",
            over ? "text-red-400" : "text-foreground"
          )}
        >
          {Math.round(display)}
          {unit}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {over ? `${label} over` : `${label} left`}
        </p>
      </div>
      <div className="flex justify-center pt-3">
        <MiniProgressRing
          progress={progress}
          icon={icon}
          size={52}
          stroke={4}
          ringClass={over ? OVER_RING : ringClass}
          iconClass={over ? OVER_ICON : iconClass}
        />
      </div>
    </div>
  );
}

function HealthScoreHeroCard({
  score,
  before,
  after,
}: {
  score: number;
  before: string;
  after: string;
}) {
  const progress = Math.min(Math.max(score, 0), 100) / 100;

  return (
    <div className={dashboard.heroTile}>
      <div className="min-w-0 space-y-2">
        <div>
          <p className="text-4xl font-black tabular-nums tracking-tight sm:text-5xl">
            {score}
          </p>
          <p className="mt-0.5 text-sm lowercase text-muted-foreground">
            {before} {after}
          </p>
        </div>
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
            className="text-secondary/80"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className="text-emerald-500"
            strokeDasharray={2 * Math.PI * 42}
            strokeDashoffset={2 * Math.PI * 42 * (1 - progress)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/80 sm:h-16 sm:w-16">
            <Heart className="h-7 w-7 text-emerald-400 sm:h-8 sm:w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CaloriesHeroCard({
  current,
  target,
  caloriesLeftLabel,
}: {
  current: number;
  target: number;
  caloriesLeftLabel: string;
}) {
  const over = target > 0 && current > target;
  const unrecoverable = macroExceededDailyUpperLimit(current, target, "calories");
  const caloriesLeft = Math.max(0, target - current);
  const display = over ? current - target : caloriesLeft;
  const progress = target > 0 ? Math.min(current / target, 1) : 0;

  return (
    <div className={dashboard.heroTile}>
      <div className="min-w-0 space-y-2">
        <div>
          <p
            className={cn(
              "text-4xl font-black tabular-nums tracking-tight sm:text-5xl",
              unrecoverable ? "text-red-400" : over && "text-amber-400"
            )}
          >
            {Math.round(display)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {over ? "kcal over" : caloriesLeftLabel}
          </p>
        </div>
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
            className="text-secondary/80"
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
              unrecoverable ? "text-red-500" : over ? "text-amber-500" : "text-orange-500"
            )}
            strokeDasharray={2 * Math.PI * 42}
            strokeDashoffset={2 * Math.PI * 42 * (1 - progress)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/80 sm:h-16 sm:w-16">
            <Flame className="h-7 w-7 text-orange-400 sm:h-8 sm:w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

const SLIDE_ONE: {
  key: MacroKey;
  icon: LucideIcon;
  ringClass: string;
  iconClass: string;
  labelKey: "proteinLeft" | "carbsLeft" | "fatLeft";
}[] = [
  {
    key: "protein",
    icon: Beef,
    ringClass: "text-rose-500",
    iconClass: "text-rose-400",
    labelKey: "proteinLeft",
  },
  {
    key: "carbs",
    icon: Wheat,
    ringClass: "text-amber-400",
    iconClass: "text-amber-300",
    labelKey: "carbsLeft",
  },
  {
    key: "fat",
    icon: Egg,
    ringClass: "text-yellow-400",
    iconClass: "text-yellow-300",
    labelKey: "fatLeft",
  },
];

export function NutritionDetailView({
  current,
  targets,
  micros,
  context,
  className,
}: {
  current: MealMacros;
  targets: MealMacros;
  micros: DailyMicros;
  context: NutritionDayContext;
  className?: string;
}) {
  const platform = usePlatformCopy();
  const [slide, setSlide] = useState(0);
  const health = scoreDailyNutrition({ ...context, micros });

  const microCells = [
    {
      key: "fiber" as const,
      icon: Leaf,
      ringClass: "text-lime-500",
      iconClass: "text-lime-400",
      label: platform.nutrition.fiber,
      overWhenHigh: false,
    },
    {
      key: "sugar" as const,
      icon: Candy,
      ringClass: "text-pink-400",
      iconClass: "text-pink-300",
      label: platform.nutrition.sugar,
      overWhenHigh: true,
    },
    {
      key: "sodium" as const,
      icon: FlaskConical,
      ringClass: "text-indigo-400",
      iconClass: "text-indigo-300",
      label: platform.nutrition.sodium,
      overWhenHigh: true,
      unit: "mg",
    },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-3">
        <div className="overflow-hidden">
          {slide === 0 ? (
            <div className="space-y-3">
              <CaloriesHeroCard
                current={current.calories}
                target={targets.calories}
                caloriesLeftLabel={platform.nutrition.caloriesLeft}
              />
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {SLIDE_ONE.map(({ key, icon, ringClass, iconClass, labelKey }) => {
                  const target = targets[key];
                  const value = current[key];
                  const over = target > 0 && value > target;
                  return (
                    <MacroVerticalCard
                      key={key}
                      value={value}
                      target={target}
                      label={platform.nutrition[labelKey]}
                      icon={icon}
                      ringClass={ringClass}
                      iconClass={iconClass}
                      over={over}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {microCells.map(({ key, icon, ringClass, iconClass, label, overWhenHigh, unit }) => {
                  const target = DAILY_MICRO_TARGETS[key];
                  const value = micros[key];
                  const over = overWhenHigh ? target > 0 && value > target : false;

                  return (
                    <MacroVerticalCard
                      key={key}
                      value={value}
                      target={target}
                      label={label}
                      unit={unit ?? "g"}
                      icon={icon}
                      ringClass={ringClass}
                      iconClass={iconClass}
                      over={over}
                    />
                  );
                })}
              </div>
              <HealthScoreHeroCard
                score={health.score}
                before={platform.nutrition.healthScoreInnerBefore}
                after={platform.nutrition.healthScoreInnerAfter}
              />
            </div>
          )}
        </div>

        <DashboardCarouselDots
          count={2}
          active={slide}
          onSelect={setSlide}
          getLabel={(index) =>
            index === 0 ? platform.nutrition.macros : platform.nutrition.microNutrients
          }
        />
      </div>
    </div>
  );
}
