"use client";

import Link from "next/link";
import { Apple, Pencil } from "lucide-react";
import type { NutritionPlan } from "@/lib/types";
import { MacroSummary } from "@/components/programs/macro-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AllMealPlansPage({
  plans,
  activePlanId,
}: {
  plans: NutritionPlan[];
  activePlanId?: string | null;
}) {
  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <Apple className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No meal plans yet</p>
          <Link href="/dashboard/ai/plans/nutrition">
            <Button size="sm">Build with AI</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {plans.map((plan) => {
        const isActive = !!activePlanId && plan.id === activePlanId;
        return (
          <li key={plan.id}>
            <Card className={isActive ? "border-primary/25 bg-primary/5" : undefined}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{plan.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {isActive && (
                        <Badge className="bg-primary/15 text-[10px] text-primary">Active</Badge>
                      )}
                    </div>
                  </div>
                  <Link href={`/dashboard/nutrition/${plan.id}/edit`}>
                    <Button size="icon" variant="outline" className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>

                <MacroSummary
                  calories={plan.target_calories}
                  protein={plan.target_protein}
                  carbs={plan.target_carbs}
                  fat={plan.target_fat}
                />
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

