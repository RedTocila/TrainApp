"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassWater, Pencil } from "lucide-react";
import { useSelectedDate, useIsPastSelectedDay } from "@/components/date-provider";
import {
  neverInEnrichmentRange,
  useOptionalDashboardEnrichment,
} from "@/components/dashboard-enrichment-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { dashboard } from "@/components/dashboard-ui";
import { DashboardStatusIcon } from "@/components/section-completed-badge";
import { MiniProgressRing } from "@/components/nutrition-macro-rings";
import { usePlatformCopy } from "@/components/locale-provider";
import { useCachedDashboardDate } from "@/hooks/use-cached-dashboard-date";
import { addWater, getDailyLog, updateWaterGoal } from "@/lib/actions/logs";
import {
  waterMetDailyMinimum,
  waterRemainingToMinimum,
} from "@/lib/water-targets";
import { formatDateKey } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { WaterGoalEditDialog } from "@/components/water-goal-edit-dialog";
import {
  DashboardCardNavBody,
  DashboardCardNavLink,
  dashboardInteractive,
} from "@/components/dashboard-card-nav-link";
import { DASHBOARD_DAY_NUTRITION_PATH } from "@/lib/dashboard-day-routes";

export function DashboardWaterCard({
  clientId,
  initialWaterMl,
  waterGoalMl: initialWaterGoalMl,
  variant = "compact",
}: {
  clientId: string;
  initialWaterMl: number;
  waterGoalMl: number;
  variant?: "full" | "compact";
}) {
  const platform = usePlatformCopy();
  const { selectedDate, todayKey } = useSelectedDate();
  const readOnly = useIsPastSelectedDay();
  const { patchDashboard } = useDashboardSync();
  const enrichmentCtx = useOptionalDashboardEnrichment();
  const enrichment = enrichmentCtx?.enrichment;
  const isInEnrichmentRange =
    enrichmentCtx?.isInEnrichmentRange ?? neverInEnrichmentRange;
  const dateKey = formatDateKey(selectedDate);
  const [waterGoalMl, setWaterGoalMl] = useState(initialWaterGoalMl);
  const [editOpen, setEditOpen] = useState(false);
  const compact = variant === "compact";

  const enrichmentWater = enrichment?.waterByDate[dateKey];
  const seedWater =
    enrichmentWater !== undefined
      ? enrichmentWater
      : dateKey === todayKey
        ? initialWaterMl
        : undefined;

  const { data: fetchedWater } = useCachedDashboardDate({
    clientId,
    dateKey,
    namespace: "water",
    seed: seedWater,
    skipFetch: isInEnrichmentRange(dateKey) && enrichmentWater !== undefined,
    fetcher: async () => {
      const log = await getDailyLog(clientId, dateKey);
      return log?.water_ml ?? 0;
    },
  });

  const waterMl = useMemo(() => {
    if (enrichmentWater !== undefined) return enrichmentWater;
    if (fetchedWater !== null) return fetchedWater;
    return seedWater ?? 0;
  }, [enrichmentWater, fetchedWater, seedWater]);

  useEffect(() => {
    setWaterGoalMl(initialWaterGoalMl);
  }, [initialWaterGoalMl]);

  const waterCompleted =
    waterGoalMl > 0 && waterMetDailyMinimum(waterMl, waterGoalMl);
  const progress = waterGoalMl > 0 ? Math.min(waterMl / waterGoalMl, 1) : 0;
  const remaining = waterRemainingToMinimum(waterMl, waterGoalMl);

  const waterVisual = (ringSize: number) => (
    <div className="flex flex-col items-center gap-1.5">
      <MiniProgressRing
        progress={progress}
        icon={GlassWater}
        size={ringSize}
        stroke={5}
        ringClass="text-cyan-500 transition-[stroke-dashoffset] duration-500 ease-out"
        iconClass="text-cyan-400"
      />
      <p className="text-2xl font-black tabular-nums leading-none">
        {Math.round(waterMl)}
        <span className="ml-0.5 text-sm font-semibold text-muted-foreground">ml</span>
      </p>
      <p className="text-[10px] text-muted-foreground sm:text-xs">/ {waterGoalMl} ml</p>
    </div>
  );

  const handleAddWater = (amount: number) => {
    const next = waterMl + amount;
    patchDashboard({ dateKey, waterMl: next });
    void addWater(clientId, dateKey, amount).catch(() => {
      patchDashboard({ dateKey, waterMl: waterMl });
    });
  };

  const handleUpdateWaterGoal = async (nextGoal: number) => {
    const previous = waterGoalMl;
    setWaterGoalMl(nextGoal);
    const result = await updateWaterGoal(clientId, nextGoal);
    if ("error" in result && result.error) {
      setWaterGoalMl(previous);
      return { error: result.error };
    }
  };

  const addButtons = (
    <div className={cn("flex gap-1.5", dashboardInteractive, compact ? "mt-auto pt-2" : "mt-4")}>
      {[250, 500].map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => handleAddWater(amount)}
          className={cn(
            dashboard.chipButton,
            compact
              ? "px-2 py-1.5 text-[11px] hover:border-cyan-500/40 hover:bg-cyan-500/10"
              : "hover:border-cyan-500/40 hover:bg-cyan-500/10"
          )}
        >
          {!compact && <GlassWater className="h-4 w-4 shrink-0 text-cyan-400" />}
          +{amount}
          {!compact && " ml"}
        </button>
      ))}
    </div>
  );

  const titleActions = readOnly ? (
    waterCompleted ? (
      <DashboardStatusIcon
        status="completed"
        aria-label={platform.nutrition.waterGoalReached}
      />
    ) : null
  ) : (
    <div className={cn("flex shrink-0 items-center gap-1", dashboardInteractive)}>
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
        aria-label="Edit water goal"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {waterCompleted ? (
        <DashboardStatusIcon
          status="completed"
          aria-label={platform.nutrition.waterGoalReached}
        />
      ) : null}
    </div>
  );

  const titleRow = (titleClassName: string) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <GlassWater className="h-5 w-5 shrink-0 text-cyan-400" />
        <p className={cn("truncate font-black", titleClassName)}>
          {platform.nutrition.water}
        </p>
      </div>
      {titleActions}
    </div>
  );

  const goalDialog = (
    <WaterGoalEditDialog
      open={editOpen}
      onClose={() => setEditOpen(false)}
      waterGoalMl={waterGoalMl}
      onSave={handleUpdateWaterGoal}
    />
  );

  if (compact) {
    return (
      <>
        <div id="dashboard-water" className={cn(dashboard.tile, dashboard.pairTile, "relative")}>
          <DashboardCardNavLink
            href={DASHBOARD_DAY_NUTRITION_PATH}
            ariaLabel={platform.nutrition.water}
          />
          <DashboardCardNavBody className="flex h-full flex-col">
          {titleRow("text-sm")}
          <div className="flex flex-1 flex-col items-center justify-center py-2">
            {waterVisual(80)}
            {!waterCompleted && remaining > 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {Math.round(remaining)} ml left
              </p>
            )}
          </div>
          {readOnly ? null : addButtons}
          </DashboardCardNavBody>
        </div>
        {goalDialog}
      </>
    );
  }

  return (
    <>
      <div id="dashboard-water" className={cn(dashboard.tile, "relative p-4")}>
        {titleRow("text-lg")}
        <div className="mt-4 flex flex-col items-center">
          {waterVisual(96)}
          {!waterCompleted && remaining > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {Math.round(remaining)} ml left
            </p>
          )}
          {waterCompleted && (
            <p className="mt-2 text-sm font-medium text-green-400">
              {platform.nutrition.waterGoalReached}
            </p>
          )}
        </div>
        {readOnly ? null : addButtons}
      </div>
      {goalDialog}
    </>
  );
}
