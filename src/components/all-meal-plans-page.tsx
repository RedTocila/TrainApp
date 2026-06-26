"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Apple,
  Calendar,
  Check,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  assignPersonalNutritionPlan,
  deletePersonalNutritionPlan,
  type PersonalNutritionListItem,
} from "@/lib/actions/user-nutrition";
import { MacroSummary } from "@/components/programs/macro-summary";
import { CreateMealPlanButton } from "@/components/programs/create-program-buttons";
import { NutritionSectionTabs } from "@/components/nutrition-section-tabs";
import { MoveNutritionButton } from "@/components/move-nutrition-dialog";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { useCoachCopy } from "@/components/locale-provider";
import { formatSlotSummary, sumDayMenuMacros } from "@/lib/meal-slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AllMealPlansPage({
  plans,
  activePlanId,
  scheduledDatesByPlan,
  folders,
}: {
  plans: PersonalNutritionListItem[];
  activePlanId?: string | null;
  scheduledDatesByPlan: Record<string, string[]>;
  folders: { id: string; name: string }[];
}) {
  const coachCopy = useCoachCopy();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  const handleDelete = (planId: string, title: string) => {
    confirmGiveUp({
      ...coachCopy.deleteMealPlan(title),
      onConfirm: () => {
        startTransition(async () => {
          await deletePersonalNutritionPlan(planId);
          router.refresh();
        });
      },
    });
  };

  const handleActivate = (planId: string) => {
    startTransition(async () => {
      const result = await assignPersonalNutritionPlan(planId);
      if (!result.error) router.refresh();
    });
  };

  if (plans.length === 0) {
    return (
      <>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-black">Day menus</h1>
          <div className="flex items-center gap-1">
            <NutritionSectionTabs />
            <CreateMealPlanButton iconOnly variant="outline" label="New day menu" />
          </div>
        </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
            <Apple className="h-7 w-7 text-emerald-400" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold">No day menus yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Create a day menu with meals for each slot, then schedule it on your calendar.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <CreateMealPlanButton />
            <Link href="/dashboard/ai/plans/nutrition">
              <Button size="sm" variant="secondary">
                <Sparkles className="mr-1.5 h-4 w-4" />
                Build with AI
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-black">Day menus</h1>
        <div className="flex items-center gap-1">
          <NutritionSectionTabs />
          <CreateMealPlanButton iconOnly variant="outline" label="New day menu" />
        </div>
      </div>
      <ul className="space-y-3">
        {plans.map(({ plan, meals }) => {
          const isActive = !!activePlanId && plan.id === activePlanId;
          const totals = sumDayMenuMacros(meals);
          const slotSummary = formatSlotSummary(meals);
          const scheduledCount = scheduledDatesByPlan[plan.id]?.length ?? 0;

          return (
            <li key={plan.id}>
              <Card
                className={cn(
                  "overflow-hidden",
                  isActive && "border-primary/25 bg-primary/5"
                )}
              >
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/nutrition/${plan.id}/edit`}
                          className="font-semibold hover:text-primary"
                        >
                          {plan.title}
                        </Link>
                        {isActive && (
                          <Badge className="bg-primary/15 text-[10px] text-primary">
                            Active
                          </Badge>
                        )}
                      </div>
                      {plan.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {plan.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {slotSummary && (
                          <Badge variant="secondary" className="text-[10px]">
                            {slotSummary}
                          </Badge>
                        )}
                        {scheduledCount > 0 && (
                          <Badge className="bg-emerald-500/15 text-[10px] text-emerald-400">
                            <Calendar className="mr-0.5 inline h-3 w-3" />
                            {scheduledCount} day{scheduledCount === 1 ? "" : "s"} scheduled
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0"
                        disabled={isPending}
                        onClick={() => handleActivate(plan.id)}
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Set active
                      </Button>
                    )}
                  </div>

                  <MacroSummary
                    calories={totals.calories || plan.target_calories}
                    protein={totals.protein || plan.target_protein}
                    carbs={totals.carbs || plan.target_carbs}
                    fat={totals.fat || plan.target_fat}
                    compact
                  />

                  <div className="flex flex-wrap items-center gap-1 border-t border-border pt-3">
                    <Link href={`/dashboard/nutrition/${plan.id}/edit`}>
                      <Button size="sm" variant="secondary" className="h-8">
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit meals
                      </Button>
                    </Link>
                    <Link href={`/dashboard/nutrition/${plan.id}/edit?tab=schedule`}>
                      <Button size="sm" variant="outline" className="h-8">
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        Schedule
                      </Button>
                    </Link>
                    {folders.length > 1 && (
                      <MoveNutritionButton
                        planId={plan.id}
                        planTitle={plan.title}
                        currentFolderId={plan.folder_id}
                        folders={folders}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-8"
                      disabled={isPending}
                      onClick={() => handleDelete(plan.id, plan.title)}
                      aria-label={`Delete ${plan.title}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
      {giveUpDialog}
    </>
  );
}
