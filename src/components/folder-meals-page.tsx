"use client";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Apple, Calendar, Pencil, Trash2 } from "lucide-react";
import {
  deletePersonalNutritionPlan,
  type PersonalNutritionListItem,
} from "@/lib/actions/user-nutrition";
import { AddToNutritionFolderMenu } from "@/components/add-to-nutrition-folder-menu";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { MoveNutritionButton } from "@/components/move-nutrition-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MacroSummary } from "@/components/programs/macro-summary";
import { formatSlotSummary, sumDayMenuMacros } from "@/lib/meal-slots";

export function FolderMealsPage({
  folderId,
  folderName,
  plans,
  folders,
  availablePlans,
  scheduledDatesByPlan,
}: {
  folderId: string;
  folderName: string;
  plans: PersonalNutritionListItem[];
  folders: { id: string; name: string }[];
  availablePlans: { id: string; title: string; description: string | null; currentFolderName: string }[];
  scheduledDatesByPlan: Record<string, string[]>;
}) {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  const handleDelete = (planId: string, title: string) => {
    confirmGiveUp({
      ...coachCopy.deleteMealPlan(title),
      onConfirm: async () => {
        await deletePersonalNutritionPlan(planId);
        router.refresh();
      },
    });
  };

  return (
    <div className="space-y-5">
      <Link href="/dashboard/nutrition">
        <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {platform.workout.foldersNav}
        </Button>
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <Apple className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-black">{folderName}</h1>
            <p className="text-xs text-muted-foreground">
              {platform.common.dayMenus(plans.length)}
            </p>
          </div>
        </div>
        <AddToNutritionFolderMenu
          folderId={folderId}
          folderName={folderName}
          availablePlans={availablePlans}
        />
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Apple className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{coachLabels.emptyMealFolder}</p>
            <AddToNutritionFolderMenu
              folderId={folderId}
              folderName={folderName}
              availablePlans={availablePlans}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map(({ plan, meals }) => {
            const totals = sumDayMenuMacros(meals);
            const slotSummary = formatSlotSummary(meals);
            const scheduledCount = scheduledDatesByPlan[plan.id]?.length ?? 0;

            return (
              <Card key={plan.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{plan.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {slotSummary && (
                          <Badge variant="secondary" className="text-[10px]">
                            {slotSummary}
                          </Badge>
                        )}
                        {scheduledCount > 0 && (
                          <Badge className="bg-primary/15 text-[10px] text-primary">
                            <Calendar className="mr-0.5 inline h-3 w-3" />
                            {scheduledCount}
                          </Badge>
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
                    calories={totals.calories}
                    protein={totals.protein}
                    carbs={totals.carbs}
                    fat={totals.fat}
                    compact
                  />
                  <div className="flex gap-1 border-t border-border pt-2">
                      <MoveNutritionButton
                        planId={plan.id}
                        planTitle={plan.title}
                        currentFolderId={plan.folder_id}
                        folders={folders}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-8"
                        disabled={isPending}
                        onClick={() => handleDelete(plan.id, plan.title)}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {giveUpDialog}
    </div>
  );
}
