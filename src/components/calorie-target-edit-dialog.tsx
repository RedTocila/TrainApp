"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Beef,
  ChevronDown,
  ChevronUp,
  Droplet,
  Flame,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppDialog } from "@/components/app-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";
import {
  adjustMacroSplit,
  formatMacroSplit,
  macroSplitPercents,
  targetsFromCaloriesAndSplit,
  type MacroSplitPct,
  type MacroTargets,
} from "@/lib/macro-calculator";

const SPLIT_KEYS: {
  key: "protein" | "carbs" | "fat";
  color: string;
  text: string;
  icon: LucideIcon;
}[] = [
  { key: "protein", color: "bg-rose-500", text: "text-rose-400", icon: Beef },
  { key: "carbs", color: "bg-amber-500", text: "text-amber-400", icon: Wheat },
  { key: "fat", color: "bg-sky-500", text: "text-sky-400", icon: Droplet },
];

export function CalorieTargetEditDialog({
  open,
  onClose,
  macros,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  macros: MacroTargets;
  onSave: (input: {
    calories: number;
    proteinPct: number;
    carbsPct: number;
    fatPct: number;
  }) => Promise<{ error?: string } | void>;
}) {
  const platform = usePlatformCopy();
  const [caloriesValue, setCaloriesValue] = useState(String(macros.calories));
  const [split, setSplit] = useState<MacroSplitPct>(() => macroSplitPercents(macros));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setCaloriesValue(String(Math.round(macros.calories)));
    setSplit(macroSplitPercents(macros));
    setError(null);
  }, [open, macros]);

  const calories = Number(caloriesValue);
  const preview = useMemo(() => {
    if (!Number.isFinite(calories) || calories <= 0) return null;
    return targetsFromCaloriesAndSplit(calories, split);
  }, [calories, split]);

  const nudgeSplit = (key: "protein" | "carbs" | "fat", delta: number) => {
    setSplit(adjustMacroSplit(split, key, split[key] + delta));
  };

  const handleSave = () => {
    if (!Number.isFinite(calories) || calories < 500 || calories > 10000) {
      setError(platform.settings.caloriesRangeError);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await onSave({
        calories: Math.round(calories),
        proteinPct: split.protein,
        carbsPct: split.carbs,
        fatPct: split.fat,
      });
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={platform.settings.editCalories}
      ariaLabel={platform.settings.editCalories}
      maxWidth="max-w-md"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            {platform.common.cancel}
          </Button>
          <Button type="button" className="flex-1" disabled={isPending} onClick={handleSave}>
            {isPending ? platform.common.saving : platform.common.save}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 px-5 pb-4 pt-1">
        <div className="space-y-1.5">
          <Label htmlFor="calorie-target" className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            {platform.settings.dailyCalories}
          </Label>
          <div className="relative">
            <Input
              id="calorie-target"
              type="number"
              min={500}
              max={10000}
              step={50}
              inputMode="numeric"
              value={caloriesValue}
              onChange={(e) => setCaloriesValue(e.target.value)}
              className="h-9 pr-12"
              autoFocus
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              kcal
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex h-5 items-center justify-between gap-2">
            <Label>{platform.settings.macroSplit}</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {platform.settings.macroSplitHint} · {formatMacroSplit(split)}
            </span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-secondary">
            {SPLIT_KEYS.map((item) => (
              <div
                key={item.key}
                className={item.color}
                style={{ width: `${split[item.key]}%` }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {SPLIT_KEYS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center gap-2 py-0.5">
                <div
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium",
                    item.text
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{platform.ai[item.key]}</span>
                </div>

                <span className="min-w-[2.75rem] shrink-0 text-right text-sm font-semibold tabular-nums text-muted-foreground">
                  {preview ? `${preview[item.key]}g` : "—"}
                </span>

                <div className="flex shrink-0 items-center rounded-lg border border-border/80 bg-background/60">
                  <button
                    type="button"
                    onClick={() => nudgeSplit(item.key, -1)}
                    className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={`Decrease ${platform.ai[item.key]} percent`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <div className="flex h-8 min-w-[4.5rem] items-center justify-center gap-0.5 border-x border-border/80 px-2">
                    <Input
                      id={`macro-split-${item.key}`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      inputMode="numeric"
                      value={split[item.key]}
                      onChange={(e) =>
                        setSplit(adjustMacroSplit(split, item.key, Number(e.target.value)))
                      }
                      className="h-8 w-10 min-w-0 flex-1 border-0 bg-transparent p-0 text-center text-sm tabular-nums shadow-none focus-visible:ring-0"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => nudgeSplit(item.key, 1)}
                    className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={`Increase ${platform.ai[item.key]} percent`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </AppDialog>
  );
}
