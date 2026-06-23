"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Apple, Calendar, Pencil, Trash2 } from "lucide-react";
import {
  deletePersonalNutritionPlan,
  type PersonalNutritionListItem,
} from "@/lib/actions/user-nutrition";
import { AddToNutritionFolderMenu } from "@/components/add-to-nutrition-folder-menu";
import { MoveNutritionButton } from "@/components/move-nutrition-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = (planId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This removes the day menu and its meals.`)) return;
    startTransition(async () => {
      await deletePersonalNutritionPlan(planId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link href="/dashboard/nutrition">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All folders
          </Button>
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black">{folderName}</h1>
            <p className="text-sm text-muted-foreground">
              Day menus in this folder — each has breakfast, 2 snacks, lunch & dinner
            </p>
          </div>
          <AddToNutritionFolderMenu
            folderId={folderId}
            folderName={folderName}
            availablePlans={availablePlans}
          />
        </div>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Apple className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No day menus in this folder</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a day menu, fill the 5 meal slots, then schedule it on your calendar.
              </p>
            </div>
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
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{plan.title}</p>
                        {scheduledCount > 0 && (
                          <Badge className="bg-primary/15 text-primary">
                            <Calendar className="mr-1 h-3 w-3" />
                            {scheduledCount} scheduled
                          </Badge>
                        )}
                      </div>
                      {plan.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {plan.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {slotSummary && (
                          <Badge variant="secondary">{slotSummary}</Badge>
                        )}
                        <Badge variant="outline">
                          {totals.calories} cal · {totals.protein}g protein
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link href={`/dashboard/nutrition/${plan.id}/edit`}>
                        <Button size="sm">
                          <Pencil className="mr-1 h-3 w-3" />
                          Edit & schedule
                        </Button>
                      </Link>
                      <MoveNutritionButton
                        planId={plan.id}
                        planTitle={plan.title}
                        currentFolderId={plan.folder_id}
                        folders={folders}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => handleDelete(plan.id, plan.title)}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
