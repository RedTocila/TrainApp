"use client";

import { useTransition } from "react";
import { useState } from "react";
import { Flame, RefreshCw, Salad, Sparkles, Utensils } from "lucide-react";
import { getMealSuggestionsAction } from "@/lib/actions/ai-coach";
import type { MacroGap, MealSuggestion } from "@/lib/ai/types";
import { MacroRing } from "@/components/macro-ring";
import { macroExceededDailyUpperLimit } from "@/lib/macro-targets";
import {
  PremiumSurface,
  PremiumSurfaceHeader,
} from "@/components/premium-surface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MealSuggestionsClient({
  dateKey,
  initialHeadline,
  initialSuggestions,
  initialGap,
}: {
  dateKey: string;
  initialHeadline: string;
  initialSuggestions: MealSuggestion[];
  initialGap: MacroGap;
}) {
  const [headline, setHeadline] = useState(initialHeadline);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [gap, setGap] = useState(initialGap);
  const [isPending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      const result = await getMealSuggestionsAction(dateKey);
      if ("error" in result) return;
      setHeadline(result.headline);
      setSuggestions(result.suggestions);
      setGap(result.gap);
    });
  };

  return (
    <div className="space-y-4">
      <PremiumSurface accent="rose" rounded="3xl" className="p-4 sm:p-5">
        <PremiumSurfaceHeader
          icon={Sparkles}
          title={gap.overTolerance ? "Over limit today" : "Remaining today"}
          accent="rose"
          action={
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-border/60 bg-background/50"
              onClick={refresh}
              disabled={isPending}
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            </Button>
          }
        />

        <div className="grid grid-cols-4 gap-1">
          <MacroRing
            size="sm"
            value={gap.consumed.calories}
            target={gap.targets.calories}
            label="Cal"
            icon={Flame}
            accentClass="text-orange-400"
            ringClass="text-orange-400"
            exceededTolerance={macroExceededDailyUpperLimit(
              gap.consumed.calories,
              gap.targets.calories,
              "calories"
            )}
          />
          <MacroRing
            size="sm"
            value={gap.consumed.protein}
            target={gap.targets.protein}
            label="Protein"
            icon={Utensils}
            accentClass="text-blue-400"
            ringClass="text-blue-400"
            exceededTolerance={macroExceededDailyUpperLimit(
              gap.consumed.protein,
              gap.targets.protein,
              "protein"
            )}
          />
          <MacroRing
            size="sm"
            value={gap.consumed.carbs}
            target={gap.targets.carbs}
            label="Carbs"
            icon={Salad}
            accentClass="text-amber-400"
            ringClass="text-amber-400"
            exceededTolerance={macroExceededDailyUpperLimit(
              gap.consumed.carbs,
              gap.targets.carbs,
              "carbs"
            )}
          />
          <MacroRing
            size="sm"
            value={gap.consumed.fat}
            target={gap.targets.fat}
            label="Fat"
            icon={Flame}
            accentClass="text-sky-400"
            ringClass="text-sky-500"
            exceededTolerance={macroExceededDailyUpperLimit(
              gap.consumed.fat,
              gap.targets.fat,
              "fat"
            )}
          />
        </div>

        <p
          className={cn(
            "mt-4 rounded-2xl border px-3 py-2.5 text-center text-sm font-medium backdrop-blur-sm",
            gap.overTolerance
              ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
              : "border-primary/25 bg-primary/10 text-foreground"
          )}
        >
          {headline}
        </p>
      </PremiumSurface>

      <div className="space-y-2.5">
        {suggestions.map((s, i) => (
          <PremiumSurface key={i} accent="rose" className="p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
                <Salad className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.title}</p>
                {(s.calories > 0 || s.protein_g > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {s.calories > 0 && (
                      <span className="rounded-full border border-orange-500/25 bg-orange-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-orange-300">
                        {s.calories} cal
                      </span>
                    )}
                    {s.protein_g > 0 && (
                      <span className="rounded-full border border-blue-500/25 bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300">
                        {s.protein_g}g protein
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </PremiumSurface>
        ))}
      </div>
    </div>
  );
}
