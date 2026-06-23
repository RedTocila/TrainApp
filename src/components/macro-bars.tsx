"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MacroBarsProps {
  current: { protein: number; carbs: number; fat: number; calories: number };
  targets: { protein: number; carbs: number; fat: number; calories: number };
}

function MacroBar({
  label,
  current,
  target,
  unit = "g",
}: {
  label: string;
  current: number;
  target: number;
  unit?: string;
}) {
  const overTarget = target > 0 && current > target;
  const progress = target > 0 ? Math.min(current / target, 1) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "text-muted-foreground",
            overTarget && "font-medium text-amber-400"
          )}
        >
          {current}
          {unit} / {target}
          {unit}
          {overTarget && " · over"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className={cn(
            "h-full rounded-full",
            overTarget ? "bg-amber-500" : "bg-primary"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function MacroBars({ current, targets }: MacroBarsProps) {
  const caloriesOver =
    targets.calories > 0 && current.calories > targets.calories;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Calories</span>
        <span
          className={cn(
            "text-xl font-bold",
            caloriesOver && "text-amber-400"
          )}
        >
          {current.calories}
          <span
            className={cn(
              "text-sm font-normal text-muted-foreground",
              caloriesOver && "text-amber-400/80"
            )}
          >
            {" "}
            / {targets.calories}
            {caloriesOver && " · over"}
          </span>
        </span>
      </div>
      <MacroBar label="Protein" current={current.protein} target={targets.protein} />
      <MacroBar label="Carbs" current={current.carbs} target={targets.carbs} />
      <MacroBar label="Fat" current={current.fat} target={targets.fat} />
    </div>
  );
}
