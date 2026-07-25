"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Activity, CircleHelp } from "lucide-react";
import { usePlatformCopy, useBodyUnits } from "@/components/locale-provider";
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
import { CardContent } from "@/components/ui/card";
import { dashboard, DashboardSectionHeader } from "@/components/dashboard-ui";
import { DashboardThemedShell } from "@/components/dashboard-themed-shell";
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
  const units = useBodyUnits();
  const weightKg = resolveLatestWeightKg(weightHistory, intakeWeightKg);
  const bmi =
    heightCm && weightKg ? calculateBmi(weightKg, heightCm) : null;
  const category = bmi != null ? getBmiCategory(bmi) : null;
  const gaugePercent = bmi != null ? bmiToGaugePercent(bmi) : null;
  const categoryStyle = category ? getBmiCategoryStyle(category) : null;

  const missingHeight = !heightCm;
  const missingWeight = !weightKg;
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width = 288; // w-72
    const left = Math.min(
      Math.max(8, rect.right - width),
      window.innerWidth - width - 8
    );
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const preferBelow = spaceBelow >= 280;
    setMenuStyle({
      position: "fixed",
      left,
      width,
      ...(preferBelow
        ? { top: rect.bottom + 6 }
        : { bottom: window.innerHeight - rect.top + 6 }),
      maxHeight: preferBelow
        ? Math.min(360, spaceBelow)
        : Math.min(360, rect.top - 12),
    });
  }, []);

  useLayoutEffect(() => {
    if (!helpOpen) return;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [helpOpen, updatePosition]);

  useEffect(() => {
    if (!helpOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setHelpOpen(false);
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

  const helpMenu =
    helpOpen &&
    createPortal(
      <div
        ref={menuRef}
        role="dialog"
        aria-label={platform.bmi.whatIsBmi}
        style={menuStyle}
        className="z-[200] overflow-y-auto rounded-xl border border-border bg-card p-3 text-foreground shadow-lg"
      >
        <p className="text-xs font-semibold text-foreground">
          {platform.bmi.bodyMassIndex}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {platform.bmi.helpText}
        </p>
        <p className="mt-3 text-[11px] font-semibold text-foreground">
          {platform.bmi.colorMapTitle}
        </p>
        <div className="mt-2 space-y-2">
          {BMI_CATEGORIES.map((item) => (
            <div key={item.key} className="flex items-start gap-2">
              <span
                className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", item.color)}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-foreground">
                  {bmiCategoryLabel(item.key, platform.bmi)}
                </p>
                <p className="text-[10px] text-muted-foreground">{item.range}</p>
              </div>
            </div>
          ))}
        </div>
      </div>,
      document.body
    );

  return (
    <DashboardThemedShell theme="bmi" className="relative z-0 overflow-hidden p-0">
      <CardContent className="relative z-10 space-y-4 bg-transparent p-4 shadow-none sm:space-y-5 sm:p-5">
        <DashboardSectionHeader
          icon={Activity}
          iconClassName="text-yellow-600 dark:text-yellow-300"
          title={platform.bmi.title}
          action={
            <button
              ref={buttonRef}
              type="button"
              className="rounded-full p-1 text-muted-foreground hover:bg-yellow-500/15 hover:text-foreground"
              onClick={() => setHelpOpen((value) => !value)}
              aria-label={platform.bmi.whatIsBmi}
              aria-expanded={helpOpen}
              aria-haspopup="dialog"
            >
              <CircleHelp className="h-4 w-4" />
            </button>
          }
        />
        {helpMenu}
        {bmi != null && category && categoryStyle ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span className={dashboard.heroValue}>{bmi.toFixed(1)}</span>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{platform.bmi.yourWeightIs}</span>
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

            <p className="text-xs text-muted-foreground">
              {platform.bmi.basedOn(
                units.formatWeightKgWithUnit(weightKg!),
                heightCm ? units.formatHeightCmWithUnit(heightCm) : null
              )}{" "}
              {weightHistory.length > 0
                ? platform.bmi.lastLogged(
                    weightHistory[weightHistory.length - 1]!.date
                  )
                : platform.bmi.usingIntakeWeight}
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
    </DashboardThemedShell>
  );
}
