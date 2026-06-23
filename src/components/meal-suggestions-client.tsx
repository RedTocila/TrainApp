"use client";

import { useTransition } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { getMealSuggestionsAction } from "@/lib/actions/ai-coach";
import type { MacroGap, MealSuggestion } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

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
      <Card className="border-primary/20">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Remaining today
            </CardTitle>
            <p className="mt-2 text-sm font-medium">{headline}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
            <RefreshCw className={`mr-1 h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-secondary/60 p-2 text-center">
              <p className="text-muted-foreground">Calories</p>
              <p className="font-bold">{Math.round(gap.calories)}</p>
            </div>
            <div className="rounded-lg bg-secondary/60 p-2 text-center">
              <p className="text-muted-foreground">Protein</p>
              <p className="font-bold">{Math.round(gap.protein)}g</p>
            </div>
            <div className="rounded-lg bg-secondary/60 p-2 text-center">
              <p className="text-muted-foreground">Carbs</p>
              <p className="font-bold">{Math.round(gap.carbs)}g</p>
            </div>
            <div className="rounded-lg bg-secondary/60 p-2 text-center">
              <p className="text-muted-foreground">Fat</p>
              <p className="font-bold">{Math.round(gap.fat)}g</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-4">
              <p className="font-semibold">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.description}</p>
              <p className="text-xs text-primary">{s.reason}</p>
              {(s.protein_g > 0 || s.calories > 0) && (
                <p className="text-xs text-muted-foreground">
                  ~{s.calories} cal · {s.protein_g}g protein
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
