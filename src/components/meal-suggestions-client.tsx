"use client";

import { useTransition } from "react";
import { useState } from "react";
import { Flame, RefreshCw, Salad, Sparkles, Utensils } from "lucide-react";
import { getMealSuggestionsAction } from "@/lib/actions/ai-coach";
import type { MacroGap, MealSuggestion } from "@/lib/ai/types";
import { MacroRing } from "@/components/macro-ring";
import { macroExceededDailyUpperLimit } from "@/lib/macro-targets";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="font-bold">{gap.overTolerance ? "Over limit today" : "Remaining today"}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refresh} disabled={isPending}>
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>

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
              accentClass="text-rose-400"
              ringClass="text-rose-400"
              exceededTolerance={macroExceededDailyUpperLimit(
                gap.consumed.fat,
                gap.targets.fat,
                "fat"
              )}
            />
          </div>

          <p
            className={cn(
              "rounded-lg px-3 py-2 text-center text-sm font-medium",
              gap.overTolerance ? "bg-orange-500/10 text-orange-300" : "bg-primary/5"
            )}
          >
            {headline}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <Card key={i}>
            <CardContent className="flex gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Salad className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.title}</p>
                {(s.calories > 0 || s.protein_g > 0) && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {s.calories > 0 && (
                      <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-300">
                        {s.calories} cal
                      </span>
                    )}
                    {s.protein_g > 0 && (
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                        {s.protein_g}g protein
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
