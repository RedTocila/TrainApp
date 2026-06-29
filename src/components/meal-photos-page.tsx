"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { format, parseISO } from "date-fns";
import { getMealPhotoGallery, getSignedMealPhotoUrls } from "@/lib/actions/meal-photos";
import { deleteDailyMealLog } from "@/lib/actions/daily-meals";
import { isActionError, runServerAction } from "@/lib/run-server-action";
import { mealFormFromMeal } from "@/lib/meal-utils";
import { DASHBOARD_DAY_NUTRITION_PATH } from "@/lib/dashboard-day-routes";
import { MEAL_PHOTO_RETENTION_DAYS } from "@/lib/meal-photo-utils";
import { DashboardDayDetailShell } from "@/components/dashboard-day-detail-shell";
import { MealLogPreviewDialog } from "@/components/meal-log-preview-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import type { DailyMealLog } from "@/lib/types";
import type { MacroTargets } from "@/lib/meal-score";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MealPhotosPage({
  clientId,
  targets,
  goal,
}: {
  clientId: string;
  targets: MacroTargets;
  goal?: string | null;
}) {
  const platform = usePlatformCopy();
  const router = useRouter();
  const [meals, setMeals] = useState<DailyMealLog[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState<DailyMealLog | null>(null);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);

  const loadGallery = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getMealPhotoGallery(clientId);
      setMeals(rows);
      const urls = await getSignedMealPhotoUrls(clientId, rows);
      setPhotoUrls(urls);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const selectedPhotoUrl = selectedMeal ? photoUrls[selectedMeal.id] ?? null : null;
  const previewMeal = useMemo(
    () => (selectedMeal ? mealFormFromMeal(selectedMeal) : null),
    [selectedMeal]
  );

  const handleDeleteSelected = () => {
    if (!selectedMeal) return;
    const meal = selectedMeal;
    setIsDeletingMeal(true);
    setMeals((prev) => prev.filter((row) => row.id !== meal.id));
    void runServerAction(() => deleteDailyMealLog(clientId, meal.date, meal.id)).then(
      (result) => {
        setIsDeletingMeal(false);
        if (isActionError(result) || ("error" in result && result.error)) {
          void loadGallery();
          return;
        }
        setSelectedMeal(null);
        setPhotoUrls((prev) => {
          const next = { ...prev };
          delete next[meal.id];
          return next;
        });
      }
    );
  };

  return (
    <DashboardDayDetailShell backHref={DASHBOARD_DAY_NUTRITION_PATH}>
      <div className="space-y-4 pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight">{platform.mealPhotos.title}</h1>
          <p className="text-sm text-muted-foreground">{platform.mealPhotos.subtitle}</p>
          <p className="text-xs text-muted-foreground">
            {platform.mealPhotos.retentionHint(MEAL_PHOTO_RETENTION_DAYS)}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{platform.common.loading}</p>
        ) : meals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-6 py-10 text-center">
            <Camera className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">{platform.mealPhotos.emptyTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{platform.mealPhotos.emptyBody}</p>
            <Button className="mt-4" onClick={() => router.push(DASHBOARD_DAY_NUTRITION_PATH)}>
              {platform.nutrition.logMeal}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {meals.map((meal) => {
              const url = photoUrls[meal.id];
              if (!url) return null;
              const loggedAt = parseISO(meal.logged_at);
              const dateLabel = Number.isNaN(loggedAt.getTime())
                ? meal.date
                : format(loggedAt, "MMM d · h:mm a");

              return (
                <button
                  key={meal.id}
                  type="button"
                  className={cn(
                    "group overflow-hidden rounded-2xl border border-border bg-card text-left",
                    "transition-colors hover:border-primary/40 hover:bg-card/90"
                  )}
                  onClick={() => setSelectedMeal(meal)}
                  aria-label={platform.aria.mealInsights(meal.name)}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-secondary/40">
                    <Image
                      src={url}
                      alt={meal.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-[1.02]"
                      unoptimized
                    />
                  </div>
                  <div className="space-y-0.5 p-3">
                    <p className="truncate text-sm font-semibold">{meal.name}</p>
                    <p className="text-xs text-muted-foreground">{dateLabel}</p>
                    <p className="text-xs font-medium tabular-nums">
                      {Math.round(meal.calories)} {platform.nutrition.caloriesUnit}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <MealLogPreviewDialog
        open={Boolean(selectedMeal)}
        meal={previewMeal}
        photoUrl={selectedPhotoUrl}
        targets={targets}
        goal={goal}
        variant="view"
        onClose={() => setSelectedMeal(null)}
        onDelete={handleDeleteSelected}
        isDeleting={isDeletingMeal}
      />
    </DashboardDayDetailShell>
  );
}
