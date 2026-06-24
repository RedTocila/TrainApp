"use client";

import Link from "next/link";
import { CircleHelp } from "lucide-react";
import {
  BMI_CATEGORIES,
  calculateBmi,
  getBmiCategory,
  getBmiCategoryStyle,
  bmiToGaugePercent,
  resolveLatestWeightKg,
} from "@/lib/bmi-utils";
import type { BodyWeightLog } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function BmiCard({
  heightCm,
  intakeWeightKg,
  weightHistory,
}: {
  heightCm?: number | null;
  intakeWeightKg?: number | null;
  weightHistory: BodyWeightLog[];
}) {
  const weightKg = resolveLatestWeightKg(weightHistory, intakeWeightKg);
  const bmi =
    heightCm && weightKg ? calculateBmi(weightKg, heightCm) : null;
  const category = bmi != null ? getBmiCategory(bmi) : null;
  const gaugePercent = bmi != null ? bmiToGaugePercent(bmi) : null;
  const categoryStyle = category ? getBmiCategoryStyle(category) : null;

  const missingHeight = !heightCm;
  const missingWeight = !weightKg;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <CardTitle>Your BMI</CardTitle>
        <button
          type="button"
          className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Body Mass Index is calculated from your height and most recent weight log."
          aria-label="What is BMI?"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-5">
        {bmi != null && category && categoryStyle ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                {bmi.toFixed(1)}
              </span>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Your weight is</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                    categoryStyle.pill
                  )}
                >
                  {category}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative h-2.5 overflow-hidden rounded-full">
                <div className="flex h-full w-full">
                  {BMI_CATEGORIES.map((item) => (
                    <div key={item.key} className={cn("h-full flex-1", item.color)} />
                  ))}
                </div>
                {gaugePercent != null && (
                  <div
                    className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                    style={{ left: `calc(${gaugePercent}% - 1px)` }}
                    aria-hidden
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                {BMI_CATEGORIES.map((item) => (
                  <div key={item.key} className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", item.color)}
                        aria-hidden
                      />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <p className="pl-3.5 text-[11px] text-muted-foreground/80">{item.range}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Based on {weightKg} kg
              {heightCm ? ` and ${heightCm} cm height` : ""}.
              {weightHistory.length > 0
                ? ` Last logged ${weightHistory[weightHistory.length - 1]!.date}.`
                : " Using intake weight."}
            </p>
          </>
        ) : (
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              {missingHeight && missingWeight
                ? "Add your height and weight to see your BMI."
                : missingHeight
                  ? "Add your height in profile to calculate BMI."
                  : "Log your weight to calculate BMI."}
            </p>
            <Link
              href="/dashboard/profile"
              className="text-sm font-medium text-primary hover:underline"
            >
              Update profile →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
