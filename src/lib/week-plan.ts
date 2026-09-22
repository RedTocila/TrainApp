/** One day inside a reusable week template. */
export type WeekPlanDayConfig = {
  focus: string;
  /** Preferred weekday 0=Sun…6=Sat when scheduling. */
  weekday: number;
  mainPlanId: string;
  mainDayId: string;
  warmupPlanId?: string | null;
  stretchPlanId?: string | null;
};

/** Stored on workout_plans.week_config when kind = "week". */
export type WeekPlanConfig = {
  includeExtras: boolean;
  days: WeekPlanDayConfig[];
  /** ISO timestamp of the last time this template was applied to the calendar. */
  lastScheduledAt?: string | null;
  /** Last calendar date (YYYY-MM-DD) covered by the current schedule. */
  scheduledUntil?: string | null;
  /** Anchor date (YYYY-MM-DD) used for the current schedule. */
  scheduledStartDate?: string | null;
  /** Number of weeks covered by the current schedule. */
  scheduledWeeks?: number | null;
};

export function normalizeWeekPlanConfig(raw: unknown): WeekPlanConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<WeekPlanConfig>;
  if (!Array.isArray(obj.days) || obj.days.length === 0) return null;
  const days: WeekPlanDayConfig[] = [];
  for (const day of obj.days) {
    if (!day || typeof day !== "object") continue;
    const mainPlanId =
      typeof day.mainPlanId === "string" ? day.mainPlanId.trim() : "";
    const mainDayId =
      typeof day.mainDayId === "string" ? day.mainDayId.trim() : "";
    if (!mainPlanId || !mainDayId) continue;
    const weekday = Number(day.weekday);
    days.push({
      focus:
        typeof day.focus === "string" && day.focus.trim()
          ? day.focus.trim()
          : "Training",
      weekday:
        Number.isFinite(weekday) && weekday >= 0 && weekday <= 6
          ? Math.round(weekday)
          : 1,
      mainPlanId,
      mainDayId,
      warmupPlanId:
        typeof day.warmupPlanId === "string" ? day.warmupPlanId : null,
      stretchPlanId:
        typeof day.stretchPlanId === "string" ? day.stretchPlanId : null,
    });
  }
  if (days.length === 0) return null;
  const lastScheduledAt =
    typeof obj.lastScheduledAt === "string" && obj.lastScheduledAt.trim()
      ? obj.lastScheduledAt.trim()
      : null;
  const scheduledUntil =
    typeof obj.scheduledUntil === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(obj.scheduledUntil.trim())
      ? obj.scheduledUntil.trim()
      : null;
  const scheduledStartDate =
    typeof obj.scheduledStartDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(obj.scheduledStartDate.trim())
      ? obj.scheduledStartDate.trim()
      : null;
  const scheduledWeeksRaw = Number(obj.scheduledWeeks);
  const scheduledWeeks =
    Number.isFinite(scheduledWeeksRaw) && scheduledWeeksRaw >= 1
      ? Math.min(52, Math.round(scheduledWeeksRaw))
      : null;
  return {
    includeExtras: obj.includeExtras !== false,
    days,
    lastScheduledAt,
    scheduledUntil,
    scheduledStartDate,
    scheduledWeeks,
  };
}

/** True while a week plan's last schedule still covers today or a future day. */
export function isWeekPlanScheduleActive(
  config: Pick<WeekPlanConfig, "scheduledUntil" | "lastScheduledAt">,
  todayKey = new Date().toISOString().split("T")[0]!
): boolean {
  if (config.scheduledUntil) {
    return config.scheduledUntil >= todayKey;
  }
  // Legacy: only lastScheduledAt — treat as active until edited/cleared.
  return Boolean(config.lastScheduledAt);
}

export function clearWeekPlanScheduleMeta(
  config: WeekPlanConfig
): WeekPlanConfig {
  return {
    ...config,
    lastScheduledAt: null,
    scheduledUntil: null,
    scheduledStartDate: null,
    scheduledWeeks: null,
  };
}
