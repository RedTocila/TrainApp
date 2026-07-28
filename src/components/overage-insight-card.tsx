"use client";

import {
  Beef,
  Candy,
  Egg,
  Flame,
  FlaskConical,
  Lightbulb,
  Loader2,
  Utensils,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  nutrientUnit,
  type MacroOverageInsight,
  type OverageNutrient,
} from "@/lib/macro-overage-local";
import { macroOverageSeverity } from "@/lib/macro-targets";
import type { MealMacros } from "@/lib/meal-utils";
import { cn } from "@/lib/utils";

const NUTRIENT_META: Record<
  OverageNutrient,
  { icon: LucideIcon; accent: string; soft: string }
> = {
  calories: {
    icon: Flame,
    accent: "text-orange-400",
    soft: "bg-orange-500/15 border-orange-500/30",
  },
  protein: {
    icon: Beef,
    accent: "text-rose-400",
    soft: "bg-rose-500/15 border-rose-500/30",
  },
  carbs: {
    icon: Wheat,
    accent: "text-amber-400",
    soft: "bg-amber-500/15 border-amber-500/30",
  },
  fat: {
    icon: Egg,
    accent: "text-sky-400",
    soft: "bg-sky-500/15 border-sky-500/30",
  },
  sodium: {
    icon: FlaskConical,
    accent: "text-indigo-300",
    soft: "bg-indigo-500/15 border-indigo-500/30",
  },
  sugar: {
    icon: Candy,
    accent: "text-pink-300",
    soft: "bg-pink-500/15 border-pink-500/30",
  },
};

function nutrientShortName(
  platform: ReturnType<typeof usePlatformCopy>,
  nutrient: OverageNutrient
): string {
  return platform.nutrition.nutrientShort[nutrient];
}

export function DayMacroStatusStrip({
  current,
  targets,
}: {
  current: MealMacros;
  targets: MealMacros;
}) {
  const platform = usePlatformCopy();
  const rows: {
    key: keyof MealMacros;
    label: string;
    unit: string;
    icon: LucideIcon;
  }[] = [
    {
      key: "calories",
      label: platform.nutrition.nutrientShort.calories,
      unit: "kcal",
      icon: Flame,
    },
    {
      key: "protein",
      label: platform.nutrition.nutrientShort.protein,
      unit: "g",
      icon: Beef,
    },
    {
      key: "carbs",
      label: platform.nutrition.nutrientShort.carbs,
      unit: "g",
      icon: Wheat,
    },
    {
      key: "fat",
      label: platform.nutrition.nutrientShort.fat,
      unit: "g",
      icon: Egg,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {rows.map(({ key, label, unit, icon: Icon }) => {
        const value = Math.round(current[key]);
        const target = Math.round(targets[key]);
        const tone = macroOverageSeverity(current[key], targets[key], key);
        const over = tone !== "ok";

        return (
          <div
            key={key}
            className={cn(
              "rounded-xl border px-2 py-2 text-center",
              tone === "alert"
                ? "border-red-500/35 bg-red-500/10"
                : tone === "warn"
                  ? "border-amber-500/35 bg-amber-500/10"
                  : "border-border/60 bg-secondary/40"
            )}
          >
            <Icon
              className={cn(
                "mx-auto h-3.5 w-3.5",
                tone === "alert"
                  ? "text-red-400"
                  : tone === "warn"
                    ? "text-amber-400"
                    : "text-muted-foreground"
              )}
            />
            <p
              className={cn(
                "mt-1 text-sm font-black tabular-nums leading-none",
                tone === "alert"
                  ? "text-red-400"
                  : tone === "warn"
                    ? "text-amber-400"
                    : "text-foreground"
              )}
            >
              {value}
            </p>
            <p className="mt-0.5 truncate text-[10px] capitalize text-muted-foreground">
              {label}
            </p>
            <p className="truncate text-[9px] text-muted-foreground/80">
              {over ? `+${Math.max(0, value - target)}${unit}` : `/${target}${unit}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function OverageInsightCard({
  insight,
  refining,
  compact,
}: {
  insight: MacroOverageInsight;
  refining?: boolean;
  compact?: boolean;
}) {
  const platform = usePlatformCopy();
  const meta = NUTRIENT_META[insight.nutrient];
  const Icon = meta.icon;
  const label = nutrientShortName(platform, insight.nutrient);
  const unit = nutrientUnit(insight.nutrient);

  return (
    <div className={cn("rounded-xl border px-3 py-3", meta.soft)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
            meta.soft,
            meta.accent
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wide",
                meta.accent
              )}
            >
              {platform.nutrition.extraNutrient(label)}
            </p>
            {refining ? (
              <Loader2 className={cn("h-3.5 w-3.5 animate-spin", meta.accent)} />
            ) : null}
          </div>
          {insight.amountFromMeal > 0 ? (
            <p className={cn("mt-0.5 text-2xl font-black tabular-nums leading-none", meta.accent)}>
              ~{insight.amountFromMeal}
              {unit}
            </p>
          ) : null}
          <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold leading-snug">
            <Utensils className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0">{insight.culpritMealName}</span>
          </p>
        </div>
      </div>

      {!compact ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-background/40 px-2.5 py-2">
          <Lightbulb className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", meta.accent)} />
          <p className="text-xs leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">
              {platform.nutrition.nextTimeLabel}:{" "}
            </span>
            {insight.avoidNextTime}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function OverageInsightCards({
  insights,
  refining,
}: {
  insights: MacroOverageInsight[];
  refining?: boolean;
}) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      {insights.map((insight) => (
        <OverageInsightCard
          key={insight.nutrient}
          insight={insight}
          refining={refining}
        />
      ))}
    </div>
  );
}
