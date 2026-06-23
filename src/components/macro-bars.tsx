"use client";

import { motion } from "framer-motion";

interface MacroBarsProps {
  current: { protein: number; carbs: number; fat: number; calories: number };
  targets: { protein: number; carbs: number; fat: number; calories: number };
}

function MacroBar({
  label,
  current,
  target,
  color,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
}) {
  const progress = target > 0 ? Math.min(current / target, 1) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {current}g / {target}g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function MacroBars({ current, targets }: MacroBarsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Calories</span>
        <span className="text-xl font-bold">
          {current.calories}
          <span className="text-sm font-normal text-muted-foreground"> / {targets.calories}</span>
        </span>
      </div>
      <MacroBar label="Protein" current={current.protein} target={targets.protein} color="bg-primary" />
      <MacroBar label="Carbs" current={current.carbs} target={targets.carbs} color="bg-red-400" />
      <MacroBar label="Fat" current={current.fat} target={targets.fat} color="bg-amber-500" />
    </div>
  );
}
