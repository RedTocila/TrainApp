"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, CircleHelp } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  BMI_CATEGORIES,
  calculateBmi,
  getBmiCategory,
  getBmiCategoryStyle,
  bmiToGaugePercent,
  resolveLatestWeightKg,
  type BmiCategory,
} from "@/lib/bmi-utils";
import type { BodyWeightLog } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { dashboard, DashboardSectionHeader } from "@/components/dashboard-ui";
import { cn } from "@/lib/utils";

function bmiCategoryLabel(
  category: BmiCategory,
  bmi: ReturnType<typeof usePlatformCopy>["bmi"]
) {
  switch (category) {
    case "underweight":
      return bmi.underweight;
    case "healthy":
      return bmi.normal;
    case "overweight":
      return bmi.overweight;
    case "obese":
      return bmi.obese;
  }
}

export function BmiCard({
  heightCm,
  intakeWeightKg,
  weightHistory,
}: {
  heightCm?: number | null;
  intakeWeightKg?: number | null;
  weightHistory: BodyWeightLog[];
}) {
  const platform = usePlatformCopy();
  const weightKg = resolveLatestWeightKg(weightHistory, intakeWeightKg);
  const bmi =
    heightCm && weightKg ? calculateBmi(weightKg, heightCm) : null;
  const category = bmi != null ? getBmiCategory(bmi) : null;
  const gaugePercent = bmi != null ? bmiToGaugePercent(bmi) : null;
  const categoryStyle = category ? getBmiCategoryStyle(category) : null;

  const missingHeight = !heightCm;
  const missingWeight = !weightKg;
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!helpOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [helpOpen]);

  return (
    <Card>
      <CardContent className="space-y-5 p-4">
        <DashboardSectionHeader
          icon={Activity}
          iconClassName="text-primary"
          title={platform.bmi.title}
          action={
            <div ref={helpRef} className="relative z-10 shrink-0">
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => setHelpOpen((value) => !value)}
                aria-label={platform.bmi.whatIsBmi}
                aria-expanded={helpOpen}
                aria-haspopup="dialog"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
              {helpOpen && (
                <div
                  role="dialog"
                  aria-label={platform.bmi.whatIsBmi}
                  className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-card p-3 shadow-lg"
                >
                  <p className="text-xs font-semibold text-foreground">{platform.bmi.bodyMassIndex}</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    {platform.bmi.helpText}
                  </p>
                </div>
              )}
            </div>
          }
        />
        {bmi != null && category && categoryStyle ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span className={dashboard.heroValue}>
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
                  {bmiCategoryLabel(category, platform.bmi)}
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
                      <span className="text-xs text-muted-foreground">
                        {bmiCategoryLabel(item.key, platform.bmi)}
                      </span>
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
                ? platform.bmi.addHeightWeight
                : missingHeight
                  ? platform.bmi.addHeight
                  : platform.bmi.logWeight}
            </p>
            <Link
              href="/dashboard/profile"
              className="text-sm font-medium text-primary hover:underline"
            >
              {platform.bmi.updateProfile} →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
