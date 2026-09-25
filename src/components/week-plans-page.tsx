"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  CalendarRange,
  Dumbbell,
  Flame,
  Footprints,
  Layers,
  Minus,
  Pencil,
  PersonStanding,
  Plus,
  StretchHorizontal,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import {
  deletePersonalWorkoutPlan,
  schedulePersonalWeekPlan,
  type PersonalWeekPlanListItem,
} from "@/lib/actions/user-workouts";
import {
  usePlatformCopy,
  useCoachCopy,
  useLocale,
} from "@/components/locale-provider";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { getWeekdayOptions } from "@/lib/locale-labels";
import {
  getWorkoutCategoryStyle,
  inferDayCategory,
  inferProgramCategory,
  type WorkoutCategory,
} from "@/lib/workout-visual-categories";
import { isWeekPlanScheduleActive } from "@/lib/week-plan";
import {
  PremiumSurface,
  type PremiumSurfaceAccent,
} from "@/components/premium-surface";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Mon → Sun board order for week templates. */
const WEEK_BOARD = [1, 2, 3, 4, 5, 6, 0] as const;

const PLAN_ACCENTS: Record<
  PremiumSurfaceAccent,
  { iconWell: string; icon: string; day: string }
> = {
  primary: {
    iconWell: "bg-primary/15",
    icon: "text-primary",
    day: "text-primary",
  },
  amber: {
    iconWell: "bg-amber-500/15",
    icon: "text-amber-500",
    day: "text-amber-400",
  },
  violet: {
    iconWell: "bg-violet-500/15",
    icon: "text-violet-400",
    day: "text-violet-300",
  },
  cyan: {
    iconWell: "bg-cyan-500/15",
    icon: "text-cyan-400",
    day: "text-cyan-300",
  },
  rose: {
    iconWell: "bg-rose-500/15",
    icon: "text-rose-400",
    day: "text-rose-300",
  },
  emerald: {
    iconWell: "bg-emerald-500/15",
    icon: "text-emerald-400",
    day: "text-emerald-300",
  },
  neutral: {
    iconWell: "bg-secondary",
    icon: "text-foreground",
    day: "text-muted-foreground",
  },
};

function accentForCategory(category: WorkoutCategory): PremiumSurfaceAccent {
  switch (category) {
    case "push":
      return "rose";
    case "pull":
      return "cyan";
    case "legs":
      return "emerald";
    case "full":
      return "violet";
    case "hiit":
    case "cardio":
    case "warmup":
      return "amber";
    case "stretch":
      return "cyan";
    case "core":
    case "upper":
      return "primary";
    default:
      return "primary";
  }
}

/** Title/style keywords first, then muscle-split category icons. */
const PLAN_STYLE_MATCHERS: {
  test: RegExp;
  accent: PremiumSurfaceAccent;
  Icon: LucideIcon;
}[] = [
  {
    test: /\b(hiit|tabata|emom|amrap|interval|intervals|circuit)\b/i,
    accent: "amber",
    Icon: Zap,
  },
  {
    test: /\b(volume|hypertrophy|bodybuilding|hipertrofi|pump)\b/i,
    accent: "violet",
    Icon: Layers,
  },
  {
    test: /\b(powerlifting|power\b|maximal|1\s*rm|olympic)\b/i,
    accent: "rose",
    Icon: Flame,
  },
  {
    test: /\b(endurance|conditioning|stamina|aerobic)\b/i,
    accent: "emerald",
    Icon: Footprints,
  },
  {
    test: /\b(cardio|running|cycling|rower)\b/i,
    accent: "amber",
    Icon: Flame,
  },
  {
    test: /\b(push[\s/-]*pull[\s/-]*legs|\bppl\b)\b/i,
    accent: "cyan",
    Icon: Layers,
  },
  {
    test: /\b(full[\s-]*body|total[\s-]*body|fbw)\b/i,
    accent: "violet",
    Icon: PersonStanding,
  },
  {
    test: /\b(mobility|stretch|stretching|yoga|flexibility|shtrirje)\b/i,
    accent: "cyan",
    Icon: StretchHorizontal,
  },
  {
    test: /\b(warm[\s-]*up|warmup|activation|ngrohje)\b/i,
    accent: "amber",
    Icon: Sun,
  },
  {
    test: /\b(strength|weights|resistance|gym|force)\b/i,
    accent: "primary",
    Icon: Dumbbell,
  },
];

function resolveWeekPlanVisual(
  title: string,
  dayFocuses: string[]
): { accent: PremiumSurfaceAccent; Icon: LucideIcon } {
  const haystack = [title, ...dayFocuses].join(" ");
  for (const style of PLAN_STYLE_MATCHERS) {
    if (style.test.test(haystack)) {
      return { accent: style.accent, Icon: style.Icon };
    }
  }

  const category = inferProgramCategory(
    title,
    dayFocuses.map((focus) => ({ title: focus })),
    "strength"
  );
  return {
    accent: accentForCategory(category),
    Icon: getWorkoutCategoryStyle(category).icon,
  };
}

function WeekPlanCard({
  plan,
  isScheduled,
  deleting,
  onDelete,
}: {
  plan: PersonalWeekPlanListItem;
  isScheduled?: boolean;
  deleting?: boolean;
  onDelete: (planId: string, title: string) => void;
}) {
  const platform = usePlatformCopy();
  const coachCopy = useCoachCopy();
  const locale = useLocale();
  const router = useRouter();
  const { setPendingHref } = useDashboardNavPending();
  const savedWeeks = plan.config.scheduledWeeks ?? 4;
  const [weeks, setWeeks] = useState(savedWeeks);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmSchedule, dialog: scheduleDialog } =
    useSarcasticConfirm();

  const weeksDirty = isScheduled && weeks !== savedWeeks;

  useEffect(() => {
    setWeeks(plan.config.scheduledWeeks ?? 4);
  }, [plan.id, plan.config.scheduledWeeks]);

  const weekdayLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (const opt of getWeekdayOptions(locale)) {
      map.set(opt.value, opt.label);
    }
    return map;
  }, [locale]);

  const byWeekday = useMemo(() => {
    const map = new Map(
      plan.config.days.map((d) => [d.weekday, d] as const)
    );
    return map;
  }, [plan.config.days]);

  const trainingDays = useMemo(
    () =>
      WEEK_BOARD.flatMap((weekday) => {
        const day = byWeekday.get(weekday);
        if (!day) return [];
        return [{ weekday, day }];
      }),
    [byWeekday]
  );

  const { accent, Icon } = useMemo(
    () =>
      resolveWeekPlanVisual(
        plan.title,
        plan.config.days.map((d) => d.focus)
      ),
    [plan.title, plan.config.days]
  );
  const accentUi = PLAN_ACCENTS[accent];

  const openPreview = () => {
    const href = `/dashboard/workout/plans/${plan.id}`;
    setPendingHref(href);
    router.push(href);
  };

  const nudgeWeeks = (delta: number) => {
    setWeeks((current) => Math.min(52, Math.max(1, current + delta)));
  };

  const runSchedule = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await schedulePersonalWeekPlan({
        weekPlanId: plan.id,
        weeks,
        startDate: isScheduled
          ? plan.config.scheduledStartDate ?? undefined
          : undefined,
      });
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (result && "success" in result && result.success) {
        setSuccess(
          platform.workout.weekPlanScheduled(
            result.count ?? 0,
            result.weeks ?? weeks
          )
        );
        router.refresh();
      }
    });
  };

  const handleSchedule = () => {
    const copy = weeksDirty
      ? coachCopy.updateWeekPlanSchedule(plan.title, weeks)
      : coachCopy.scheduleWeekPlan(plan.title, weeks);
    confirmSchedule({
      title: copy.title,
      message: copy.message,
      confirmLabel: copy.confirm,
      cancelLabel: copy.cancel,
      onConfirm: runSchedule,
    });
  };

  return (
    <>
      <PremiumSurface
        accent={accent}
        className="cursor-pointer transition-[transform,box-shadow,filter] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:brightness-[1.04] active:translate-y-0 active:shadow-sm"
      >
        <div
          className="space-y-3 p-3.5"
          role="link"
          tabIndex={0}
          onClick={openPreview}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPreview();
            }
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  accentUi.iconWell
                )}
              >
                <Icon className={cn("h-5 w-5", accentUi.icon)} />
              </span>
              <div className="min-w-0 space-y-0.5">
                <h2 className="truncate text-base font-bold leading-snug tracking-tight">
                  {plan.title}
                </h2>
                <p className="truncate text-[11px] leading-relaxed text-muted-foreground">
                  {platform.workout.weekPlanDays(plan.config.days.length)}
                  {plan.config.includeExtras
                    ? ` · ${platform.workout.weekPlanBuilderWarmup} + ${platform.workout.weekPlanBuilderStretch}`
                    : ""}
                </p>
              </div>
            </div>
            <div
              className="flex shrink-0 items-center"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Link href={`/dashboard/workout/plans/${plan.id}/edit`}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8", accentUi.icon)}
                  disabled={deleting || isPending}
                  aria-label={platform.common.edit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                disabled={deleting || isPending}
                onClick={() => onDelete(plan.id, plan.title)}
                aria-label="Delete plan"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <ul
            className="space-y-0.5"
            aria-label={platform.workout.weekPlanBuilderDays}
          >
            {trainingDays.map(({ weekday, day }) => {
              const dayAccent = accentForCategory(
                inferDayCategory({ title: day.focus })
              );
              const dayUi = PLAN_ACCENTS[dayAccent];
              const label = weekdayLabels.get(weekday) ?? "?";
              return (
                <li
                  key={`${weekday}-${day.mainDayId}`}
                  className="flex items-center gap-2.5 rounded-lg px-0.5 py-1"
                >
                  <span
                    className={cn(
                      "w-8 shrink-0 text-[11px] font-bold uppercase tracking-wide",
                      dayUi.day
                    )}
                  >
                    {label}
                  </span>
                  <span className="min-w-0 truncate text-xs font-medium leading-tight">
                    {day.focus}
                  </span>
                </li>
              );
            })}
          </ul>

          <div
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 pt-0.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <span className="col-start-1 row-start-1 justify-self-center text-[10px] font-medium leading-none text-muted-foreground">
              {platform.workout.weekPlanWeeksLabel}:
            </span>
            <div
              className="col-start-1 row-start-2 flex h-8 items-center overflow-hidden rounded-lg border border-border/70 bg-background/50"
              role="group"
              aria-label={platform.workout.weekPlanScheduleWeeks}
            >
              <button
                type="button"
                onClick={() => nudgeWeeks(-1)}
                disabled={isPending || weeks <= 1}
                className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                aria-label="Decrease weeks"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              <span className="flex h-full min-w-[2.25rem] items-center justify-center border-x border-border/70 px-1.5 text-sm font-semibold tabular-nums">
                {weeks}
              </span>
              <button
                type="button"
                onClick={() => nudgeWeeks(1)}
                disabled={isPending || weeks >= 52}
                className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                aria-label="Increase weeks"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>

            <Button
              type="button"
              size="sm"
              variant={
                isScheduled && !weeksDirty ? "secondary" : "default"
              }
              className={cn(
                "col-start-2 row-start-2 h-8 min-w-0 w-full",
                isScheduled && !weeksDirty && "pointer-events-none opacity-50"
              )}
              disabled={isPending || (isScheduled && !weeksDirty)}
              onClick={handleSchedule}
            >
              {isPending
                ? weeksDirty
                  ? platform.workout.weekPlanSavingSchedule
                  : platform.workout.weekPlanScheduling
                : weeksDirty
                  ? platform.workout.weekPlanSaveSchedule
                  : isScheduled
                    ? platform.workout.weekPlanScheduledButton
                    : platform.workout.weekPlanSchedule}
            </Button>
          </div>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-xs text-emerald-400" role="status">
              {success}
            </p>
          ) : null}
        </div>
      </PremiumSurface>
      {scheduleDialog}
    </>
  );
}

function CreatePlanButton({ className }: { className?: string }) {
  const platform = usePlatformCopy();
  return (
    <Link href="/dashboard/workout/plans/new" className={cn("block w-full", className)}>
      <Button type="button" variant="secondary" className="w-full gap-1.5">
        <Plus className="h-4 w-4" aria-hidden />
        {platform.workout.weekPlanCreate}
      </Button>
    </Link>
  );
}

export function WeekPlansPage({
  plans,
}: {
  plans: PersonalWeekPlanListItem[];
}) {
  const platform = usePlatformCopy();
  const coachCopy = useCoachCopy();
  const router = useRouter();
  const [items, setItems] = useState(plans);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  useEffect(() => {
    setItems(plans);
  }, [plans]);

  const handleDelete = (planId: string, title: string) => {
    const copy = coachCopy.deleteWorkoutPlan(title);
    confirmGiveUp({
      title: copy.title,
      message: copy.message,
      confirmLabel: copy.confirm,
      cancelLabel: copy.cancel,
      onConfirm: async () => {
        const previous = items;
        setDeletingId(planId);
        setItems((current) => current.filter((plan) => plan.id !== planId));
        try {
          const result = await deletePersonalWorkoutPlan(planId);
          if (result && "error" in result && result.error) {
            setItems(previous);
            return;
          }
          router.refresh();
        } catch {
          setItems(previous);
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  if (items.length === 0) {
    return (
      <>
        <PremiumSurface accent="primary">
          <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
              <CalendarRange className="h-6 w-6 text-primary" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-bold">
                {platform.workout.weekPlansEmpty}
              </p>
              <p className="max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                {platform.workout.weekPlansEmptyHint}
              </p>
            </div>
            <CreatePlanButton className="self-stretch" />
          </div>
        </PremiumSurface>
        {giveUpDialog}
      </>
    );
  }

  return (
    <>
      <CreatePlanButton />
      <div className="space-y-3">
        {items.map((plan) => (
          <WeekPlanCard
            key={plan.id}
            plan={plan}
            isScheduled={isWeekPlanScheduleActive(plan.config)}
            deleting={deletingId === plan.id}
            onDelete={handleDelete}
          />
        ))}
      </div>
      {giveUpDialog}
    </>
  );
}
