"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { MacroOverageInsightButton } from "@/components/macro-overage-insight-button";
import { MiniProgressRing } from "@/components/nutrition-macro-rings";
import type { MealMacros } from "@/lib/meal-utils";
import { scrollElementIntoHorizontalView } from "@/lib/scroll-horizontal";
import {
  DAILY_MICRO_TARGETS,
  microExceededHighLimit,
  scoreDailyNutrition,
  type DailyMicros,
  type NutritionDayContext,
} from "@/lib/nutrition-day-utils";
import type { OverageNutrient } from "@/lib/macro-overage-local";
import { macroOverageSeverity } from "@/lib/macro-targets";
import type { DailyMealLog } from "@/lib/types";
import { cn } from "@/lib/utils";

const OVER_RING = "text-red-500";
const OVER_ICON = "text-red-400";

type MacroKey = keyof MealMacros;
type OverageTone = "ok" | "warn" | "alert";

function MacroVerticalCard({
  value,
  target,
  labelLeft,
  labelOver,
  unit = "g",
  icon,
  ringClass,
  iconClass,
  tone,
  insightAction,
}: {
  value: number;
  target: number;
  labelLeft: string;
  labelOver: string;
  unit?: string;
  icon: LucideIcon;
  ringClass: string;
  iconClass: string;
  tone: OverageTone;
  insightAction?: ReactNode;
}) {
  const over = tone !== "ok";
  const alert = tone === "alert";
  const remaining = Math.max(0, target - value);
  const display = over ? value - target : remaining;
  const progress = target > 0 ? Math.min(value / target, 1) : 0;

  return (
    <div className={cn(dashboard.metricTile, "relative justify-start gap-2")}>
      {alert && insightAction ? (
        <div className="pointer-events-auto absolute right-2 top-2 z-[2]">
          {insightAction}
        </div>
      ) : null}
      <div className="min-h-[2.75rem]">
        <p
          className={cn(
            "text-2xl font-black tabular-nums leading-none",
            alert
              ? "text-red-400"
              : tone === "warn"
                ? "text-amber-400"
                : "text-foreground"
          )}
        >
          {Math.round(display)}
          {unit}
        </p>
        <p className="mt-1 truncate whitespace-nowrap text-xs leading-4 text-muted-foreground">
          {over ? labelOver : labelLeft}
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <MiniProgressRing
          progress={progress}
          icon={icon}
          size={52}
          stroke={4}
          ringClass={alert ? OVER_RING : ringClass}
          iconClass={alert ? OVER_ICON : iconClass}
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
  caloriesOverLabel,
  insightAction,
}: {
  current: number;
  target: number;
  caloriesLeftLabel: string;
  caloriesOverLabel: string;
  insightAction?: ReactNode;
}) {
  const tone = macroOverageSeverity(current, target, "calories");
  const over = tone !== "ok";
  const alert = tone === "alert";
  const caloriesLeft = Math.max(0, target - current);
  const display = over ? current - target : caloriesLeft;
  const progress = target > 0 ? Math.min(current / target, 1) : 0;

  return (
    <div className={cn(dashboard.heroTile, "relative")}>
      {alert && insightAction ? (
        <div className="pointer-events-auto absolute left-2 top-2 z-[2] sm:left-3 sm:top-3">
          {insightAction}
        </div>
      ) : null}
      <div className="min-w-0 space-y-2">
        <div>
          <p
            className={cn(
              "text-4xl font-black tabular-nums tracking-tight sm:text-5xl",
              alert
                ? "text-red-400"
                : tone === "warn"
                  ? "text-amber-400"
                  : "text-foreground"
            )}
          >
            {Math.round(display)}
          </p>
          <p className="mt-0.5 truncate whitespace-nowrap text-sm text-muted-foreground">
            {over ? caloriesOverLabel : caloriesLeftLabel}
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
            className={alert ? "text-red-500" : "text-orange-500"}
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
  leftKey: "proteinStatusLeft" | "carbsStatusLeft" | "fatStatusLeft";
  overKey: "proteinStatusOver" | "carbsStatusOver" | "fatStatusOver";
}[] = [
  {
    key: "protein",
    icon: Beef,
    ringClass: "text-rose-500",
    iconClass: "text-rose-400",
    leftKey: "proteinStatusLeft",
    overKey: "proteinStatusOver",
  },
  {
    key: "carbs",
    icon: Wheat,
    ringClass: "text-amber-400",
    iconClass: "text-amber-300",
    leftKey: "carbsStatusLeft",
    overKey: "carbsStatusOver",
  },
  {
    key: "fat",
    icon: Egg,
    ringClass: "text-sky-500",
    iconClass: "text-sky-400",
    leftKey: "fatStatusLeft",
    overKey: "fatStatusOver",
  },
];

export function NutritionDetailView({
  current,
  targets,
  micros,
  context,
  meals = [],
  className,
}: {
  current: MealMacros;
  targets: MealMacros;
  micros: DailyMicros;
  context: NutritionDayContext;
  meals?: DailyMealLog[];
  className?: string;
}) {
  const platform = usePlatformCopy();
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [slide, setSlide] = useState(0);
  const health = scoreDailyNutrition({ ...context, micros });

  const insightButton = (
    nutrient: OverageNutrient,
    severity: "warn" | "alert"
  ) =>
    meals.length > 0 ? (
      <MacroOverageInsightButton
        nutrient={nutrient}
        dateKey={context.dateKey}
        current={current}
        targets={targets}
        meals={meals}
        severity={severity}
      />
    ) : null;

  const calorieTone = macroOverageSeverity(
    current.calories,
    targets.calories,
    "calories"
  );

  const scrollToSlide = useCallback((index: number) => {
    const node = slideRefs.current[index];
    if (node) {
      scrollElementIntoHorizontalView(node, {
        behavior: "smooth",
        inline: "start",
        scroller: scrollRef.current,
      });
    }
    setSlide(index);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const slides = slideRefs.current.filter((node): node is HTMLDivElement => node !== null);
      if (slides.length === 0) return;

      const scrollLeft = el.scrollLeft;
      let closest = 0;
      let minDistance = Infinity;

      slides.forEach((slideNode, index) => {
        const distance = Math.abs(slideNode.offsetLeft - scrollLeft);
        if (distance < minDistance) {
          minDistance = distance;
          closest = index;
        }
      });

      setSlide(closest);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

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
        <div
          ref={scrollRef}
          className={cn(
            "flex gap-3 overflow-x-auto snap-x snap-mandatory",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
          aria-label={platform.nutrition.macros}
        >
          <div
            ref={(node) => {
              slideRefs.current[0] = node;
            }}
            className="w-full shrink-0 snap-start space-y-3"
          >
            <CaloriesHeroCard
              current={current.calories}
              target={targets.calories}
              caloriesLeftLabel={platform.nutrition.caloriesLeft}
              caloriesOverLabel={platform.nutrition.caloriesStatusOver}
              insightAction={
                calorieTone === "alert"
                  ? insightButton("calories", "alert")
                  : null
              }
            />
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {SLIDE_ONE.map(
                ({ key, icon, ringClass, iconClass, leftKey, overKey }) => {
                const target = targets[key];
                const value = current[key];
                const tone = macroOverageSeverity(value, target, key);
                return (
                  <MacroVerticalCard
                    key={key}
                    value={value}
                    target={target}
                    labelLeft={platform.nutrition[leftKey]}
                    labelOver={platform.nutrition[overKey]}
                    icon={icon}
                    ringClass={ringClass}
                    iconClass={iconClass}
                    tone={tone}
                    insightAction={
                      tone === "alert" ? insightButton(key, "alert") : null
                    }
                  />
                );
              }
              )}
            </div>
          </div>

          <div
            ref={(node) => {
              slideRefs.current[1] = node;
            }}
            className="w-full shrink-0 snap-start space-y-3"
          >
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {microCells.map(({ key, icon, ringClass, iconClass, label, overWhenHigh, unit }) => {
                const target = DAILY_MICRO_TARGETS[key];
                const value = micros[key];
                const over = overWhenHigh
                  ? microExceededHighLimit(key, value, target)
                  : false;
                const tone: OverageTone = over ? "alert" : "ok";

                return (
                  <MacroVerticalCard
                    key={key}
                    value={value}
                    target={target}
                    labelLeft={`${label} left`}
                    labelOver={`${label} over`}
                    unit={unit ?? "g"}
                    icon={icon}
                    ringClass={ringClass}
                    iconClass={iconClass}
                    tone={tone}
                    insightAction={
                      over && (key === "sodium" || key === "sugar")
                        ? insightButton(key, "alert")
                        : null
                    }
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
        </div>

        <DashboardCarouselDots
          count={2}
          active={slide}
          onSelect={scrollToSlide}
          getLabel={(index) =>
            index === 0 ? platform.nutrition.macros : platform.nutrition.microNutrients
          }
        />
      </div>
    </div>
  );
}
