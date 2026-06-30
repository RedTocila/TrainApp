"use client";

import { useBodyUnits } from "@/components/locale-provider";
import { kgToLb } from "@/lib/body-units";
import type { ProgressPrediction } from "@/lib/ai/types";
import { Scale, Target, TrendingDown, TrendingUp } from "lucide-react";

export function ProgressPredictionStats({
  prediction,
}: {
  prediction: ProgressPrediction;
}) {
  const units = useBodyUnits();
  const trendingUp = (prediction.weekly_change_kg ?? 0) > 0;
  const TrendIcon = trendingUp ? TrendingUp : TrendingDown;
  const weeklyChange =
    prediction.weekly_change_kg != null
      ? units.unitSystem === "imperial"
        ? kgToLb(prediction.weekly_change_kg)
        : prediction.weekly_change_kg
      : null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {prediction.current_weight_kg != null && (
        <div className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-lg font-black">
              {units.formatWeightKgWithUnit(prediction.current_weight_kg)}
            </p>
            <p className="text-[10px] text-muted-foreground">Current</p>
          </div>
        </div>
      )}
      {weeklyChange != null && (
        <div className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3">
          <TrendIcon
            className={`h-5 w-5 ${trendingUp ? "text-amber-400" : "text-green-400"}`}
          />
          <div>
            <p className="text-lg font-black">
              {weeklyChange > 0 ? "+" : ""}
              {weeklyChange.toFixed(1)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {units.weightUnit} / week
            </p>
          </div>
        </div>
      )}
      {prediction.estimated_goal_date && (
        <div className="col-span-2 flex items-center gap-3 rounded-xl bg-primary/10 p-3">
          <Target className="h-5 w-5 text-primary" />
          <div>
            <p className="font-bold">{prediction.estimated_goal_date}</p>
            <p className="text-[10px] text-muted-foreground">Estimated goal date</p>
          </div>
        </div>
      )}
    </div>
  );
}
