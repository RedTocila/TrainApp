"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Info, Plus, Trash2 } from "lucide-react";
import {
  createNutritionPlan,
  updateNutritionPlan,
  saveMeal,
  deleteMeal,
} from "@/lib/actions/plans";
import { sendTrainerPlanToClient, findDeliverablePlanRequest } from "@/lib/actions/custom-plans";
import { ClientInformationDialog } from "@/components/client-information-dialog";
import { MealDetailsFields } from "@/components/meal-details-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  emptyMealForm,
  mealFormFromMeal,
  mealPayloadFromForm,
  type MealFormData,
} from "@/lib/meal-utils";
import {
  MEAL_SLOTS,
  mealTypeForSlot,
} from "@/lib/meal-slots";
import { buildSlotScheduleDates } from "@/lib/nutrition-schedule-utils";
import {
  WEEKDAY_OPTIONS,
  describeSchedulePreview,
  formatScheduleAnchorLabel,
  getScheduleAnchorDate,
  type ScheduleStartMode,
} from "@/lib/schedule-utils";
import { cn, formatDateKey } from "@/lib/utils";
import type { ClientIntakeInfo } from "@/lib/actions/client-intake";
import type { Meal, MealSlot, NutritionScheduleConfig, SlotScheduleConfig } from "@/lib/types";

type MealForm = MealFormData & { id?: string };

type SlotScheduleState = {
  enabled: boolean;
  weekdays: number[];
  weeks: number;
  extraDates: string[];
};

function initSlotSchedules(
  initialSchedule?: NutritionScheduleConfig | null
): Record<MealSlot, SlotScheduleState> {
  const defaults: SlotScheduleState = {
    enabled: false,
    weekdays: [1, 2, 3, 4, 5],
    weeks: 4,
    extraDates: [],
  };
  const result = {} as Record<MealSlot, SlotScheduleState>;
  for (const { slot } of MEAL_SLOTS) {
    const fromConfig = initialSchedule?.slots?.[slot];
    result[slot] = fromConfig
      ? {
          enabled: fromConfig.enabled,
          weekdays: fromConfig.weekdays,
          weeks: fromConfig.weeks,
          extraDates: fromConfig.extraDates ?? [],
        }
      : { ...defaults };
  }
  return result;
}

const MAX_MEALS_PER_SLOT = 3;

function emptySlotMeals(): Record<MealSlot, MealForm[]> {
  const grouped = {} as Record<MealSlot, MealForm[]>;
  for (const { slot } of MEAL_SLOTS) {
    grouped[slot] = [];
  }
  return grouped;
}

function mealsFromInitial(initialMeals: Meal[]): Record<MealSlot, MealForm[]> {
  const grouped = emptySlotMeals();
  for (const meal of initialMeals) {
    const slot = (meal.slot as MealSlot) ?? inferSlot(meal, initialMeals);
    if (slot && grouped[slot].length < MAX_MEALS_PER_SLOT) {
      grouped[slot].push({ id: meal.id, ...mealFormFromMeal(meal) });
    }
  }
  return grouped;
}

function inferSlot(meal: Meal, all: Meal[]): MealSlot | null {
  if (meal.slot) return meal.slot as MealSlot;
  if (meal.meal_type === "breakfast") return "breakfast";
  if (meal.meal_type === "lunch") return "lunch";
  if (meal.meal_type === "dinner") return "dinner";
  if (meal.meal_type === "snack") {
    const snacks = all.filter((m) => m.meal_type === "snack");
    const idx = snacks.findIndex((m) => m.id === meal.id);
    return idx <= 0 ? "snack_1" : "snack_2";
  }
  return null;
}

export function AdminNutritionWizard({
  clientId,
  requestId,
  clientIntake,
  requestPreferences,
  initialPlanId,
  initialTitle = "",
  initialMacros = {
    target_calories: 2000,
    target_protein: 150,
    target_carbs: 200,
    target_fat: 65,
  },
  initialMeals = [],
  initialSchedule,
}: {
  clientId: string;
  requestId?: string;
  clientIntake: ClientIntakeInfo | null;
  requestPreferences?: string | null;
  initialPlanId?: string;
  initialTitle?: string;
  initialMacros?: {
    target_calories: number;
    target_protein: number;
    target_carbs: number;
    target_fat: number;
  };
  initialMeals?: Meal[];
  initialSchedule?: NutritionScheduleConfig | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [planId, setPlanId] = useState(initialPlanId);
  const [title, setTitle] = useState(initialTitle);
  const [macros, setMacros] = useState(initialMacros);
  const [slotMeals, setSlotMeals] = useState(() => mealsFromInitial(initialMeals));
  const [infoOpen, setInfoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [slotSchedules, setSlotSchedules] = useState(() =>
    initSlotSchedules(initialSchedule ?? undefined)
  );
  const [startMode, setStartMode] = useState<ScheduleStartMode>("now");

  const anchor = getScheduleAnchorDate(startMode);

  const addMealToSlot = (slot: MealSlot) => {
    if (slotMeals[slot].length >= MAX_MEALS_PER_SLOT) return;
    setSlotMeals({
      ...slotMeals,
      [slot]: [
        ...slotMeals[slot],
        { ...emptyMealForm(mealTypeForSlot(slot)), name: MEAL_SLOTS.find((s) => s.slot === slot)!.label },
      ],
    });
  };

  const updateSlotMeal = (slot: MealSlot, idx: number, next: MealFormData) => {
    const updated = [...slotMeals[slot]];
    updated[idx] = { ...updated[idx], ...next };
    setSlotMeals({ ...slotMeals, [slot]: updated });
  };

  const removeSlotMeal = (slot: MealSlot, idx: number) => {
    const meal = slotMeals[slot][idx];
    if (meal.id && planId) {
      startTransition(async () => {
        await deleteMeal(meal.id!, planId);
      });
    }
    setSlotMeals({
      ...slotMeals,
      [slot]: slotMeals[slot].filter((_, i) => i !== idx),
    });
  };

  const savePhase1 = async (): Promise<string | null> => {
    if (!title.trim()) {
      setError("Plan name is required");
      return null;
    }
    if (planId) {
      const result = await updateNutritionPlan(planId, { title, ...macros });
      if (result.error) {
        setError(result.error);
        return null;
      }
      return planId;
    }
    const result = await createNutritionPlan({ title, ...macros });
    if (result.error || !result.data) {
      setError(result.error ?? "Failed to create plan");
      return null;
    }
    setPlanId(result.data.id);
    return result.data.id;
  };

  const savePhase2 = async (currentPlanId: string) => {
    let orderIndex = 0;
    for (const { slot } of MEAL_SLOTS) {
      for (const meal of slotMeals[slot]) {
        if (!meal.name.trim()) continue;
        const saveResult = await saveMeal(
          currentPlanId,
          {
            ...mealPayloadFromForm(meal),
            slot,
            order_index: orderIndex++,
          },
          meal.id
        );
        if (saveResult.error) return saveResult.error;
      }
    }
    return null;
  };

  const handleNext = () => {
    setError(null);
    startTransition(async () => {
      if (step === 1) {
        const id = await savePhase1();
        if (id) setStep(2);
        return;
      }
      if (step === 2) {
        if (!planId) {
          setError("Save plan details first");
          return;
        }
        const mealError = await savePhase2(planId);
        if (mealError) {
          setError(mealError);
          return;
        }
        setSlotSchedules((prev) => {
          const next = { ...prev };
          for (const { slot } of MEAL_SLOTS) {
            if (slotMeals[slot].length > 0) {
              next[slot] = { ...next[slot], enabled: true };
            }
          }
          return next;
        });
        setStep(3);
      }
    });
  };

  const handleSend = () => {
    if (!planId) {
      setError("Save plan details first");
      return;
    }
    setError(null);

    const startDate = formatDateKey(anchor);
    const slots: Partial<Record<MealSlot, SlotScheduleConfig>> = {};
    let anyEnabled = false;

    for (const { slot, label } of MEAL_SLOTS) {
      if (slotMeals[slot].length === 0) continue;
      const s = slotSchedules[slot];
      if (!s.enabled) continue;
      if (s.weekdays.length === 0) {
        setError(`Pick weekdays for ${label}`);
        return;
      }
      anyEnabled = true;
      slots[slot] = {
        enabled: true,
        startDate,
        weekdays: s.weekdays,
        weeks: s.weeks,
        extraDates: s.extraDates.length > 0 ? s.extraDates : undefined,
      };
    }

    if (!anyEnabled) {
      setError("Enable at least one meal type to schedule");
      return;
    }

    const scheduleConfig: NutritionScheduleConfig = { slots };

    startTransition(async () => {
      const mealError = await savePhase2(planId);
      if (mealError) {
        setError(mealError);
        return;
      }

      if (requestId) {
        const result = await sendTrainerPlanToClient(
          requestId,
          planId,
          "nutrition",
          scheduleConfig
        );
        if (result.error) {
          setError(result.error);
          return;
        }
      } else {
        const openRequest = await findDeliverablePlanRequest(clientId, "diet");
        if (!openRequest) {
          setError("No open nutrition request found for this client.");
          return;
        }
        const result = await sendTrainerPlanToClient(
          openRequest.id,
          planId,
          "nutrition",
          scheduleConfig
        );
        if (result.error) {
          setError(result.error);
          return;
        }
      }

      router.push(`/admin/clients/${clientId}`);
      router.refresh();
    });
  };

  const today = formatDateKey(new Date());
  const quickDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return formatDateKey(d);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-sm">
          {([1, 2, 3] as const).map((n) => (
            <span
              key={n}
              className={cn(
                "rounded-full px-3 py-1 font-medium",
                step === n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}
            >
              {n === 1 ? "Plan & macros" : n === 2 ? "Meals" : "Schedule"}
            </span>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setInfoOpen(true)}>
          <Info className="mr-2 h-4 w-4" />
          Information
        </Button>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Diet plan overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Plan name</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fat loss phase 1" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["target_calories", "target_protein", "target_carbs", "target_fat"] as const).map((key) => (
                <div key={key} className="space-y-1">
                  <Label className="capitalize">{key.replace("target_", "")}</Label>
                  <Input
                    type="number"
                    value={macros[key]}
                    onChange={(e) =>
                      setMacros({ ...macros, [key]: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add up to 3 options per meal type. All slots are optional.
          </p>
          {MEAL_SLOTS.map(({ slot, label }) => (
            <Card key={slot}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{label}</CardTitle>
                {slotMeals[slot].length < MAX_MEALS_PER_SLOT && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => addMealToSlot(slot)}>
                    <Plus className="mr-1 h-3 w-3" /> Add
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {slotMeals[slot].length === 0 ? (
                  <p className="text-sm text-muted-foreground">No meals added</p>
                ) : (
                  slotMeals[slot].map((meal, idx) => (
                    <div key={meal.id ?? idx} className="relative rounded-lg border border-border p-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2"
                        onClick={() => removeSlotMeal(slot, idx)}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                      <MealDetailsFields
                        mealType={meal.meal_type}
                        onMealTypeChange={() => {}}
                        name={meal.name}
                        onNameChange={(name) => updateSlotMeal(slot, idx, { ...meal, name })}
                        description={meal.description}
                        onDescriptionChange={(description) =>
                          updateSlotMeal(slot, idx, { ...meal, description })
                        }
                        macros={meal.macros}
                        onMacrosChange={(macros) => updateSlotMeal(slot, idx, { ...meal, macros })}
                        ingredients={meal.ingredients}
                        onIngredientsChange={(ingredients) =>
                          updateSlotMeal(slot, idx, { ...meal, ingredients })
                        }
                        hideMealType
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule each meal separately</CardTitle>
              <p className="text-sm text-muted-foreground">
                Turn on only the meal types the client needs on their calendar. Each can repeat on
                different days.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label>Plan start</Label>
              <div className="flex flex-wrap gap-2">
                {(["now", "next_week"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setStartMode(mode)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      startMode === mode
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/60"
                    )}
                  >
                    {formatScheduleAnchorLabel(mode)}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {MEAL_SLOTS.filter(({ slot }) => slotMeals[slot].length > 0).map(({ slot, label }) => {
            const s = slotSchedules[slot];
            const preview = describeSchedulePreview(
              anchor,
              s.weekdays,
              s.weeks
            );
            const slotDates = s.enabled
              ? buildSlotScheduleDates({
                  enabled: true,
                  startDate: formatDateKey(anchor),
                  weekdays: s.weekdays,
                  weeks: s.weeks,
                  extraDates: s.extraDates,
                })
              : [];

            return (
              <Card key={slot}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{label}</CardTitle>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) =>
                        setSlotSchedules((prev) => ({
                          ...prev,
                          [slot]: { ...prev[slot], enabled: e.target.checked },
                        }))
                      }
                      className="rounded border-border"
                    />
                    Schedule
                  </label>
                </CardHeader>
                {s.enabled && (
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      {slotMeals[slot].length} option{slotMeals[slot].length === 1 ? "" : "s"} ·{" "}
                      {slotDates.length} day{slotDates.length === 1 ? "" : "s"}
                    </p>
                    <div className="space-y-2">
                      <Label>Repeat on</Label>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_OPTIONS.map(({ label: dayLabel, value }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setSlotSchedules((prev) => ({
                                ...prev,
                                [slot]: {
                                  ...prev[slot],
                                  weekdays: prev[slot].weekdays.includes(value)
                                    ? prev[slot].weekdays.filter((d) => d !== value)
                                    : [...prev[slot].weekdays, value].sort((a, b) => a - b),
                                },
                              }))
                            }
                            className={cn(
                              "rounded-lg border px-3 py-2 text-sm font-medium",
                              s.weekdays.includes(value)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-secondary/60"
                            )}
                          >
                            {dayLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Weeks</Label>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 4, 8, 12].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() =>
                              setSlotSchedules((prev) => ({
                                ...prev,
                                [slot]: { ...prev[slot], weeks: n },
                              }))
                            }
                            className={cn(
                              "rounded-lg border px-3 py-2 text-sm",
                              s.weeks === n
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-secondary/60"
                            )}
                          >
                            {n} wk
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{preview}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Extra dates</Label>
                      <div className="flex flex-wrap gap-2">
                        {quickDates.map((dateKey) => {
                          const d = new Date(dateKey + "T12:00:00");
                          const dateLabel =
                            dateKey === today
                              ? "Today"
                              : d.toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                });
                          return (
                            <button
                              key={dateKey}
                              type="button"
                              onClick={() =>
                                setSlotSchedules((prev) => ({
                                  ...prev,
                                  [slot]: {
                                    ...prev[slot],
                                    extraDates: prev[slot].extraDates.includes(dateKey)
                                      ? prev[slot].extraDates.filter((x) => x !== dateKey)
                                      : [...prev[slot].extraDates, dateKey],
                                  },
                                }))
                              }
                              className={cn(
                                "rounded-lg border px-2.5 py-1.5 text-xs",
                                s.extraDates.includes(dateKey)
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-secondary/60"
                              )}
                            >
                              {dateLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        {step > 1 && (
          <Button type="button" variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3)} disabled={isPending}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        )}
        {step < 3 ? (
          <Button onClick={handleNext} disabled={isPending}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSend} disabled={isPending}>
            {requestId ? "Send plan to client" : "Save & finish"}
          </Button>
        )}
      </div>

      <ClientInformationDialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        intake={clientIntake}
        preferences={requestPreferences}
      />
    </div>
  );
}
