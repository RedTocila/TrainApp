"use client";

import type { ReactNode } from "react";
import {
  Beef,
  Candy,
  Egg,
  Flame,
  FlaskConical,
  Leaf,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import type { MealMacros } from "@/lib/meal-utils";
import {
  DAILY_MICRO_TARGETS,
  type DailyMicros,
} from "@/lib/nutrition-day-utils";
import { cn } from "@/lib/utils";

const OVER_RING_CLASS = "text-red-500";
const OVER_ICON_CLASS = "text-red-400";
const OVER_AMOUNT_CLASS = "text-red-400";

export function MiniProgressRing({
  progress,
  icon: Icon,
  ringClass = "text-primary",
  iconClass = "text-primary",
  size = 44,
  stroke = 4,
}: {
  progress: number;
  icon: LucideIcon;
  ringClass?: string;
  iconClass?: string;
  size?: number;
  stroke?: number;
}) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - clamped * circumference;
  const center = size / 2;
  const iconSize = Math.max(14, Math.round(size * 0.36));

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-secondary/70"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={ringClass}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className={iconClass} style={{ width: iconSize, height: iconSize }} />
      </div>
    </div>
  );
}

function formatMacroAmount(key: keyof MealMacros, value: number): string {
  const rounded = Math.round(value);
  return key === "calories" ? String(rounded) : `${rounded}g`;
}

type MacroCell = {
  key: keyof MealMacros;
  icon: LucideIcon;
  ringClass: string;
  iconClass: string;
  size?: number;
};

type MicroCell = {
  key: keyof DailyMicros;
  icon: LucideIcon;
  ringClass: string;
  iconClass: string;
  overWhenHigh?: boolean;
  format: (value: number) => string;
};

const MACRO_CELLS: MacroCell[] = [
  {
    key: "calories",
    icon: Flame,
    ringClass: "text-orange-500",
    iconClass: "text-orange-400",
    size: 52,
  },
  {
    key: "protein",
    icon: Beef,
    ringClass: "text-rose-500",
    iconClass: "text-rose-400",
  },
  {
    key: "carbs",
    icon: Wheat,
    ringClass: "text-amber-400",
    iconClass: "text-amber-300",
  },
  {
    key: "fat",
    icon: Egg,
    ringClass: "text-sky-500",
    iconClass: "text-sky-400",
  },
];

const MICRO_CELLS: MicroCell[] = [
  {
    key: "fiber",
    icon: Leaf,
    ringClass: "text-lime-500",
    iconClass: "text-lime-400",
    format: (value) => `${Math.round(value)}g`,
  },
  {
    key: "sugar",
    icon: Candy,
    ringClass: "text-pink-400",
    iconClass: "text-pink-300",
    overWhenHigh: true,
    format: (value) => `${Math.round(value)}g`,
  },
  {
    key: "sodium",
    icon: FlaskConical,
    ringClass: "text-indigo-400",
    iconClass: "text-indigo-300",
    overWhenHigh: true,
    format: (value) => `${Math.round(value)}mg`,
  },
];

const COMPACT_RING_SIZE = 44;
const COMPACT_RING_STROKE = 3.5;
const COMPACT_CALORIES_STROKE = 4;

const DETAIL_RING_SIZE = 56;
const DETAIL_CALORIES_SIZE = 64;
const DETAIL_HERO_CALORIES_SIZE = 120;
const DETAIL_RING_STROKE = 4;
const DETAIL_CALORIES_STROKE = 4.5;
const DETAIL_HERO_CALORIES_STROKE = 6;

function RingCell({
  value,
  target,
  formattedValue,
  formattedTarget,
  icon,
  ringClass,
  iconClass,
  ringSize,
  stroke,
  over,
  amountClassName,
  targetClassName,
  spread = false,
}: {
  value: number;
  target: number;
  formattedValue: string;
  formattedTarget: string;
  icon: LucideIcon;
  ringClass: string;
  iconClass: string;
  ringSize: number;
  stroke: number;
  over: boolean;
  amountClassName?: string;
  targetClassName?: string;
  spread?: boolean;
}) {
  const progress = target > 0 ? Math.min(value / target, 1) : 0;
  const amountClass = over ? OVER_AMOUNT_CLASS : iconClass;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5",
        spread && "w-full"
      )}
    >
      <MiniProgressRing
        progress={progress}
        icon={icon}
        size={ringSize}
        stroke={stroke}
        ringClass={over ? OVER_RING_CLASS : ringClass}
        iconClass={over ? OVER_ICON_CLASS : iconClass}
      />
      <p
        className={cn(
          "text-center font-semibold leading-none tabular-nums",
          amountClassName,
          amountClass
        )}
      >
        {formattedValue}
      </p>
      <p
        className={cn(
          "text-center leading-none tabular-nums text-muted-foreground",
          targetClassName,
          over && "text-red-400/80"
        )}
      >
        /{formattedTarget}
      </p>
    </div>
  );
}

export function NutritionMacroRings({
  current,
  targets,
  micros,
  microTargets = DAILY_MICRO_TARGETS,
  variant = "compact",
  layout = "grid",
  spread = false,
  trailingSlot,
  showMicros = false,
  macroSectionTitle,
  microSectionTitle,
  className,
}: {
  current: MealMacros;
  targets: MealMacros;
  micros?: DailyMicros;
  microTargets?: DailyMicros;
  variant?: "compact" | "detail";
  layout?: "grid" | "hero";
  /** Compact only: spread macro rings across full row width. */
  spread?: boolean;
  /** Rendered as an extra equal column when `spread` is enabled (e.g. health score). */
  trailingSlot?: ReactNode;
  showMicros?: boolean;
  macroSectionTitle?: string;
  microSectionTitle?: string;
  className?: string;
}) {
  const isDetail = variant === "detail";
  const isHero = isDetail && layout === "hero";
  const defaultRingSize = isDetail ? DETAIL_RING_SIZE : COMPACT_RING_SIZE;
  const caloriesSize = isHero
    ? DETAIL_HERO_CALORIES_SIZE
    : isDetail
      ? DETAIL_CALORIES_SIZE
      : 52;
  const ringStroke = isDetail ? DETAIL_RING_STROKE : COMPACT_RING_STROKE;
  const caloriesStroke = isHero
    ? DETAIL_HERO_CALORIES_STROKE
    : isDetail
      ? DETAIL_CALORIES_STROKE
      : COMPACT_CALORIES_STROKE;
  const amountText = isHero ? "text-base" : isDetail ? "text-sm" : "text-[11px]";
  const targetText = isHero ? "text-sm" : isDetail ? "text-xs" : "text-[9px]";
  const heroAmountText = "text-xl";
  const heroTargetText = "text-sm";

  if (isHero && showMicros && micros) {
    const caloriesCell = MACRO_CELLS[0];
    const caloriesTarget = targets.calories;
    const caloriesValue = current.calories;
    const caloriesOver = caloriesTarget > 0 && caloriesValue > caloriesTarget;

    const secondaryCells: {
      key: string;
      value: number;
      target: number;
      formattedValue: string;
      formattedTarget: string;
      icon: LucideIcon;
      ringClass: string;
      iconClass: string;
      over: boolean;
    }[] = [
      ...MACRO_CELLS.slice(1).map(({ key, icon, ringClass, iconClass }) => {
        const target = targets[key];
        const value = current[key];
        return {
          key,
          value,
          target,
          formattedValue: formatMacroAmount(key, value),
          formattedTarget: formatMacroAmount(key, target),
          icon,
          ringClass,
          iconClass,
          over: target > 0 && value > target,
        };
      }),
      ...MICRO_CELLS.map(({ key, icon, ringClass, iconClass, overWhenHigh, format }) => {
        const target = microTargets[key];
        const value = micros[key];
        const formattedTarget =
          key === "sodium" ? `${Math.round(target)}mg` : `${Math.round(target)}g`;
        return {
          key,
          value,
          target,
          formattedValue: format(value),
          formattedTarget,
          icon,
          ringClass,
          iconClass,
          over: overWhenHigh ? target > 0 && value > target : false,
        };
      }),
    ];

    return (
      <div className={cn("space-y-5", className)}>
        <div className="flex flex-col items-center py-2">
          <RingCell
            value={caloriesValue}
            target={caloriesTarget}
            formattedValue={formatMacroAmount("calories", caloriesValue)}
            formattedTarget={formatMacroAmount("calories", caloriesTarget)}
            icon={caloriesCell.icon}
            ringClass={caloriesCell.ringClass}
            iconClass={caloriesCell.iconClass}
            ringSize={caloriesSize}
            stroke={caloriesStroke}
            over={caloriesOver}
            amountClassName={heroAmountText}
            targetClassName={heroTargetText}
          />
        </div>
        <div className="grid grid-cols-3 items-end gap-3 sm:gap-4">
          {secondaryCells.map((cell) => (
            <RingCell
              key={cell.key}
              value={cell.value}
              target={cell.target}
              formattedValue={cell.formattedValue}
              formattedTarget={cell.formattedTarget}
              icon={cell.icon}
              ringClass={cell.ringClass}
              iconClass={cell.iconClass}
              ringSize={defaultRingSize}
              stroke={ringStroke}
              over={cell.over}
              amountClassName={amountText}
              targetClassName={targetText}
            />
          ))}
        </div>
      </div>
    );
  }

  const macroGrid = (
    <div
      className={cn(
        "w-full items-end",
        !isDetail && spread
          ? cn(
              "grid justify-items-center",
              trailingSlot ? "grid-cols-5" : "grid-cols-4"
            )
          : cn("grid grid-cols-4", isDetail ? "gap-3 sm:gap-4" : "gap-2")
      )}
    >
      {MACRO_CELLS.map(({ key, icon, ringClass, iconClass, size }) => {
        const target = targets[key];
        const value = current[key];
        const over = target > 0 && value > target;
        const ringSize = size ?? defaultRingSize;
        const stroke = key === "calories" ? caloriesStroke : ringStroke;
        const resolvedSize =
          !isDetail && spread
            ? defaultRingSize
            : key === "calories"
              ? caloriesSize
              : ringSize;

        return (
          <RingCell
            key={key}
            value={value}
            target={target}
            formattedValue={formatMacroAmount(key, value)}
            formattedTarget={formatMacroAmount(key, target)}
            icon={icon}
            ringClass={ringClass}
            iconClass={iconClass}
            ringSize={resolvedSize}
            stroke={!isDetail && spread ? ringStroke : stroke}
            over={over}
            amountClassName={amountText}
            targetClassName={targetText}
            spread={!isDetail && spread}
          />
        );
      })}
      {trailingSlot ? (
        <div className="flex w-full flex-col items-center">{trailingSlot}</div>
      ) : null}
    </div>
  );

  const microGrid =
    showMicros && micros ? (
      <div
        className={cn(
          "grid grid-cols-3 items-end",
          isDetail ? "gap-3 sm:gap-4" : "gap-2"
        )}
      >
        {MICRO_CELLS.map(({ key, icon, ringClass, iconClass, overWhenHigh, format }) => {
          const target = microTargets[key];
          const value = micros[key];
          const over = overWhenHigh ? target > 0 && value > target : false;
          const formattedTarget =
            key === "sodium" ? `${Math.round(target)}mg` : `${Math.round(target)}g`;

          return (
            <RingCell
              key={key}
              value={value}
              target={target}
              formattedValue={format(value)}
              formattedTarget={formattedTarget}
              icon={icon}
              ringClass={ringClass}
              iconClass={iconClass}
              ringSize={defaultRingSize}
              stroke={ringStroke}
              over={over}
              amountClassName={amountText}
              targetClassName={targetText}
            />
          );
        })}
      </div>
    ) : null;

  if (!isDetail) {
    return (
      <div className={cn("pointer-events-none", className)}>
        {macroGrid}
        {microGrid ? <div className="mt-3">{microGrid}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-3">
        {macroSectionTitle ? (
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {macroSectionTitle}
          </h3>
        ) : null}
        {macroGrid}
      </div>
      {microGrid ? (
        <div className={cn("space-y-3", !isHero && "border-t border-border/60 pt-5")}>
          {microSectionTitle ? (
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {microSectionTitle}
            </h3>
          ) : null}
          {microGrid}
        </div>
      ) : null}
    </div>
  );
}
