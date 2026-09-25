"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Flame, PersonStanding } from "lucide-react";
import {
  createPersonalWeekPlan,
  updatePersonalWeekPlan,
  type PersonalWeekPlanListItem,
  type PersonalWorkoutListItem,
  type WeekPlanBuilderExtraOption,
} from "@/lib/actions/user-workouts";
import type { WeekPlanConfig } from "@/lib/week-plan";
import {
  SelectableWorkoutCard,
  WeekPlanWorkoutPicker,
  type WeekPlanWorkoutPick,
} from "@/components/week-plan-workout-picker";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { value: 1, key: "mon" as const },
  { value: 2, key: "tue" as const },
  { value: 3, key: "wed" as const },
  { value: 4, key: "thu" as const },
  { value: 5, key: "fri" as const },
  { value: 6, key: "sat" as const },
  { value: 0, key: "sun" as const },
];

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "day",
  "days",
  "workout",
  "training",
  "session",
  "plan",
  "gym",
]);

type DayDraft = {
  enabled: boolean;
  planId: string;
  dayId: string;
  focus: string;
  planTitle: string;
  includeWarmup: boolean;
  includeStretch: boolean;
};

function emptyDraft(hasExtras: boolean): DayDraft {
  return {
    enabled: false,
    planId: "",
    dayId: "",
    focus: "",
    planTitle: "",
    includeWarmup: hasExtras,
    includeStretch: hasExtras,
  };
}

function draftsFromConfig(
  config: WeekPlanConfig | undefined,
  libraryWorkouts: PersonalWorkoutListItem[],
  hasAnyExtras: boolean
): Record<number, DayDraft> {
  const initial: Record<number, DayDraft> = {};
  for (const d of WEEKDAYS) initial[d.value] = emptyDraft(hasAnyExtras);
  if (!config) return initial;

  for (const day of config.days) {
    const workout = libraryWorkouts.find((w) => w.plan.id === day.mainPlanId);
    initial[day.weekday] = {
      enabled: true,
      planId: day.mainPlanId,
      dayId: day.mainDayId,
      focus: day.focus,
      planTitle: workout?.plan.title ?? day.focus,
      includeWarmup: Boolean(day.warmupPlanId),
      includeStretch: Boolean(day.stretchPlanId),
    };
  }
  return initial;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function pickMatchingExtra(
  extras: WeekPlanBuilderExtraOption[],
  focus: string,
  workoutTitle: string
): string | null {
  if (extras.length === 0) return null;
  if (extras.length === 1) return extras[0]!.planId;

  const query = new Set(tokens(`${focus} ${workoutTitle}`));
  let bestId = extras[0]!.planId;
  let bestScore = -1;

  for (const extra of extras) {
    const hay = tokens(extra.title);
    let score = 0;
    for (const t of hay) {
      if (query.has(t)) score += 3;
      else if ([...query].some((q) => q.includes(t) || t.includes(q))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = extra.planId;
    }
  }

  return bestId;
}

function DayCheckToggle({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
        checked
          ? "border-border bg-secondary/50"
          : "border-border/70 bg-background/40 hover:bg-secondary/40",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          checked
            ? "border-foreground bg-foreground text-background"
            : "border-muted-foreground/40 bg-background"
        )}
        aria-hidden
      >
        {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </span>
      <span className="text-sm font-black tracking-tight">{label}</span>
    </button>
  );
}

function ExtraCheckToggle({
  checked,
  onCheckedChange,
  disabled,
  label,
  hint,
  kind,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
  kind: "warmup" | "stretch";
}) {
  const Icon = kind === "warmup" ? Flame : PersonStanding;
  const accent =
    kind === "warmup"
      ? {
          on: "border-orange-500/40 bg-orange-500/10",
          box: "border-orange-400 bg-orange-500 text-white",
          icon: "text-orange-300",
        }
      : {
          on: "border-sky-500/40 bg-sky-500/10",
          box: "border-sky-400 bg-sky-500 text-white",
          icon: "text-sky-300",
        };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-colors",
        checked
          ? accent.on
          : "border-border/50 bg-secondary/20 hover:bg-secondary/35",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked ? accent.box : "border-muted-foreground/35 bg-background"
        )}
        aria-hidden
      >
        {checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
      </span>
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          checked ? accent.icon : "text-muted-foreground"
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold leading-none">
        {label}
        {hint ? (
          <span className="font-normal text-muted-foreground"> · {hint}</span>
        ) : null}
      </span>
    </button>
  );
}

export function WeekPlanBuilderClient({
  libraryWorkouts,
  warmups,
  stretches,
  gender,
  initialPlan,
}: {
  libraryWorkouts: PersonalWorkoutListItem[];
  warmups: WeekPlanBuilderExtraOption[];
  stretches: WeekPlanBuilderExtraOption[];
  gender?: string | null;
  initialPlan?: PersonalWeekPlanListItem | null;
}) {
  const platform = usePlatformCopy();
  const router = useRouter();
  const hasWarmups = warmups.length > 0;
  const hasStretches = stretches.length > 0;
  const hasAnyExtras = hasWarmups || hasStretches;
  const editingId = initialPlan?.id ?? null;

  const [title, setTitle] = useState(initialPlan?.title ?? "");
  const [description, setDescription] = useState(
    initialPlan?.description ?? ""
  );
  const [days, setDays] = useState<Record<number, DayDraft>>(() =>
    draftsFromConfig(initialPlan?.config, libraryWorkouts, hasAnyExtras)
  );
  const [pickerWeekday, setPickerWeekday] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const weekdayLabel = (key: (typeof WEEKDAYS)[number]["key"]) =>
    platform.workout.weekPlanWeekday[key];

  const enabledCount = useMemo(
    () => Object.values(days).filter((d) => d.enabled).length,
    [days]
  );

  const updateDay = (weekday: number, patch: Partial<DayDraft>) => {
    setDays((prev) => ({
      ...prev,
      [weekday]: { ...(prev[weekday] ?? emptyDraft(hasAnyExtras)), ...patch },
    }));
  };

  const resolvedExtraName = (
    extras: WeekPlanBuilderExtraOption[],
    focus: string,
    workoutTitle: string
  ) => {
    const id = pickMatchingExtra(extras, focus, workoutTitle);
    return extras.find((e) => e.planId === id)?.title ?? null;
  };

  const applyPick = (weekday: number, pick: WeekPlanWorkoutPick) => {
    updateDay(weekday, {
      enabled: true,
      planId: pick.planId,
      dayId: pick.dayId,
      focus: pick.focus,
      planTitle: pick.planTitle,
      includeWarmup: hasWarmups,
      includeStretch: hasStretches,
    });
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const selected = WEEKDAYS.flatMap(({ value }) => {
        const draft = days[value];
        if (!draft?.enabled || !draft.planId || !draft.dayId) return [];
        return [
          {
            weekday: value,
            mainPlanId: draft.planId,
            mainDayId: draft.dayId,
            focus: draft.focus,
            warmupPlanId:
              draft.includeWarmup && hasWarmups
                ? pickMatchingExtra(warmups, draft.focus, draft.planTitle)
                : null,
            stretchPlanId:
              draft.includeStretch && hasStretches
                ? pickMatchingExtra(stretches, draft.focus, draft.planTitle)
                : null,
          },
        ];
      });

      const payload = {
        title,
        description,
        days: selected,
      };
      const result = editingId
        ? await updatePersonalWeekPlan({ planId: editingId, ...payload })
        : await createPersonalWeekPlan(payload);

      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (result && "success" in result) {
        router.push("/dashboard/workout/plans");
        router.refresh();
      }
    });
  };

  if (libraryWorkouts.length === 0) {
    return (
      <Card className="overflow-hidden border-dashed p-6 text-center">
        <p className="text-sm font-semibold">
          {platform.workout.weekPlanBuilderNoWorkouts}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {platform.workout.weekPlanBuilderNoWorkoutsHint}
        </p>
        <Link href="/dashboard/workout/new" className="mt-4 inline-block">
          <Button type="button" size="sm">
            {platform.workout.newWorkout}
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 border-border/60 p-4">
        <div className="space-y-2">
          <Label htmlFor="week-plan-title">
            {platform.workout.weekPlanBuilderTitle}
          </Label>
          <Input
            id="week-plan-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={platform.workout.weekPlanBuilderTitlePlaceholder}
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="week-plan-desc">
            {platform.workout.weekPlanBuilderDescription}
          </Label>
          <Input
            id="week-plan-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={platform.workout.weekPlanBuilderDescriptionPlaceholder}
            disabled={isPending}
          />
        </div>
      </Card>

      <div className="space-y-2">
        <p className="text-sm font-semibold">
          {platform.workout.weekPlanBuilderDays}
        </p>
        <ul className="space-y-2.5">
          {WEEKDAYS.map(({ value, key }) => {
            const draft = days[value] ?? emptyDraft(hasAnyExtras);
            const matchedWarmup =
              draft.includeWarmup && hasWarmups
                ? resolvedExtraName(warmups, draft.focus, draft.planTitle)
                : null;
            const matchedStretch =
              draft.includeStretch && hasStretches
                ? resolvedExtraName(stretches, draft.focus, draft.planTitle)
                : null;

            return (
              <li key={value}>
                <Card
                  className={cn(
                    "min-w-0 space-y-3 overflow-hidden border-border/60 p-3 transition-colors",
                    draft.enabled && "bg-secondary/20"
                  )}
                >
                  <DayCheckToggle
                    checked={draft.enabled}
                    disabled={isPending}
                    label={weekdayLabel(key)}
                    onCheckedChange={(enabled) => {
                      updateDay(value, {
                        enabled,
                        ...(enabled
                          ? {
                              includeWarmup: hasWarmups,
                              includeStretch: hasStretches,
                            }
                          : {}),
                      });
                    }}
                  />

                  {draft.enabled ? (
                    <div className="min-w-0 space-y-3">
                      {draft.planId ? (
                        <div className="space-y-1.5">
                          {(() => {
                            const selectedItem = libraryWorkouts.find(
                              (w) => w.plan.id === draft.planId
                            );
                            if (!selectedItem) return null;
                            const dayLabel =
                              selectedItem.days.length > 1
                                ? selectedItem.days.find(
                                    (d) => d.id === draft.dayId
                                  )?.title
                                : null;
                            return (
                              <SelectableWorkoutCard
                                item={selectedItem}
                                gender={gender}
                                dayLabel={dayLabel}
                                onSelect={() => setPickerWeekday(value)}
                              />
                            );
                          })()}
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => setPickerWeekday(value)}
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                          >
                            {platform.workout.weekPlanBuilderChangeWorkout}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setPickerWeekday(value)}
                          className={cn(
                            "flex h-[var(--control-height)] w-full items-center justify-between gap-2 rounded-xl border border-dashed border-border/80 bg-background/50 px-3 text-left text-sm transition-colors",
                            "hover:border-border focus-visible:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            "disabled:cursor-not-allowed disabled:opacity-50"
                          )}
                        >
                          <span className="text-muted-foreground">
                            {platform.workout.weekPlanBuilderChooseWorkout}
                          </span>
                          <ChevronRight
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        </button>
                      )}

                      {draft.planId && hasAnyExtras ? (
                        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                          {hasWarmups ? (
                            <ExtraCheckToggle
                              kind="warmup"
                              checked={draft.includeWarmup}
                              disabled={isPending}
                              label={platform.workout.weekPlanBuilderWarmup}
                              hint={
                                matchedWarmup
                                  ? platform.workout.weekPlanBuilderAutoPick(
                                      matchedWarmup
                                    )
                                  : platform.workout.weekPlanBuilderNoExtras
                              }
                              onCheckedChange={(includeWarmup) =>
                                updateDay(value, { includeWarmup })
                              }
                            />
                          ) : null}
                          {hasStretches ? (
                            <ExtraCheckToggle
                              kind="stretch"
                              checked={draft.includeStretch}
                              disabled={isPending}
                              label={platform.workout.weekPlanBuilderStretch}
                              hint={
                                matchedStretch
                                  ? platform.workout.weekPlanBuilderAutoPick(
                                      matchedStretch
                                    )
                                  : platform.workout.weekPlanBuilderNoExtras
                              }
                              onCheckedChange={(includeStretch) =>
                                updateDay(value, { includeStretch })
                              }
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={isPending || enabledCount === 0 || !title.trim()}
        onClick={handleSave}
      >
        {isPending
          ? platform.workout.weekPlanBuilderSaving
          : platform.workout.weekPlanBuilderSave}
      </Button>

      <WeekPlanWorkoutPicker
        open={pickerWeekday != null}
        onClose={() => setPickerWeekday(null)}
        workouts={libraryWorkouts}
        gender={gender}
        selectedPlanId={
          pickerWeekday != null ? days[pickerWeekday]?.planId : undefined
        }
        onPick={(pick) => {
          if (pickerWeekday == null) return;
          applyPick(pickerWeekday, pick);
        }}
      />
    </div>
  );
}
