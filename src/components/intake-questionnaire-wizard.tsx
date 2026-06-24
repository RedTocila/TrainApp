"use client";

import { useCallback, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import {
  ACTIVITY_OPTIONS,
  ALCOHOL_OPTIONS,
  ALLERGY_OPTIONS,
  COOKING_OPTIONS,
  COMMUTE_OPTIONS,
  DAILY_STEPS_OPTIONS,
  DIET_TYPE_OPTIONS,
  EMPTY_INTAKE_RESPONSES,
  ENERGY_OPTIONS,
  EQUIPMENT_OPTIONS,
  GOAL_OPTIONS,
  GOAL_TIMELINE_OPTIONS,
  HEALTH_CONDITION_OPTIONS,
  INJURY_AREA_OPTIONS,
  INTAKE_STEPS,
  MEALS_PER_DAY_OPTIONS,
  SLEEP_HOURS_OPTIONS,
  SMOKING_OPTIONS,
  STRESS_OPTIONS,
  TRAINING_DAYS_OPTIONS,
  TRAINING_EXPERIENCE_OPTIONS,
  TRAINING_TIME_OPTIONS,
  WATER_HABITS_OPTIONS,
  WORK_HOURS_OPTIONS,
  JOB_TYPE_OPTIONS,
  getStepMissingFields,
  type IntakeOption,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import { GENDER_OPTIONS } from "@/lib/intake-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function OptionGrid({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: IntakeOption[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
}) {
  const selected = multi ? (Array.isArray(value) ? value : []) : value;

  const toggle = (optionValue: string) => {
    if (!multi) {
      onChange(optionValue);
      return;
    }
    const current = Array.isArray(selected) ? selected : [];
    if (optionValue === "none") {
      onChange(["none"]);
      return;
    }
    const withoutNone = current.filter((v) => v !== "none");
    if (withoutNone.includes(optionValue)) {
      onChange(withoutNone.filter((v) => v !== optionValue));
    } else {
      onChange([...withoutNone, optionValue]);
    }
  };

  const isSelected = (optionValue: string) => {
    if (multi) return Array.isArray(selected) && selected.includes(optionValue);
    return selected === optionValue;
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => toggle(option.value)}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
            isSelected(option.value)
              ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
              : "border-border bg-secondary/40 hover:border-primary/40 hover:bg-secondary/70"
          )}
        >
          <span className="text-xl leading-none">{option.emoji}</span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{option.label}</span>
            {option.description && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {option.description}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

function StepFields({
  stepId,
  responses,
  onChange,
}: {
  stepId: string;
  responses: IntakeResponses;
  onChange: (patch: Partial<IntakeResponses>) => void;
}) {
  switch (stepId) {
    case "basics":
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="q-age">How old are you?</Label>
              <Input
                id="q-age"
                type="number"
                min={13}
                max={120}
                placeholder="28"
                value={responses.age ?? ""}
                onChange={(e) =>
                  onChange({ age: parseInt(e.target.value, 10) || undefined })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <div className="grid grid-cols-2 gap-2">
                {GENDER_OPTIONS.filter((o) => o.value).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ gender: opt.value })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      responses.gender === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/60"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="q-weight">Current weight (kg)</Label>
              <Input
                id="q-weight"
                type="number"
                step="0.1"
                placeholder="75"
                value={responses.intake_weight_kg ?? ""}
                onChange={(e) =>
                  onChange({
                    intake_weight_kg: parseFloat(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-height">Height (cm)</Label>
              <Input
                id="q-height"
                type="number"
                placeholder="175"
                value={responses.height_cm ?? ""}
                onChange={(e) =>
                  onChange({ height_cm: parseInt(e.target.value, 10) || undefined })
                }
              />
            </div>
          </div>
        </div>
      );
    case "goal":
      return (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Primary goal</Label>
            <OptionGrid
              options={GOAL_OPTIONS}
              value={responses.goal}
              onChange={(v) => onChange({ goal: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Target timeline</Label>
            <OptionGrid
              options={GOAL_TIMELINE_OPTIONS}
              value={responses.goal_timeline}
              onChange={(v) => onChange({ goal_timeline: v as string })}
            />
          </div>
        </div>
      );
    case "training":
      return (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Training experience</Label>
            <OptionGrid
              options={TRAINING_EXPERIENCE_OPTIONS}
              value={responses.training_experience}
              onChange={(v) => onChange({ training_experience: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Days you train per week</Label>
            <OptionGrid
              options={TRAINING_DAYS_OPTIONS}
              value={responses.training_days_per_week}
              onChange={(v) => onChange({ training_days_per_week: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Preferred workout time</Label>
            <OptionGrid
              options={TRAINING_TIME_OPTIONS}
              value={responses.training_time_preference}
              onChange={(v) => onChange({ training_time_preference: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Equipment access (pick all that apply)</Label>
            <OptionGrid
              multi
              options={EQUIPMENT_OPTIONS}
              value={responses.equipment_access}
              onChange={(v) => onChange({ equipment_access: v as string[] })}
            />
          </div>
          <div className="space-y-2">
            <Label>Other activities</Label>
            <OptionGrid
              multi
              options={ACTIVITY_OPTIONS}
              value={responses.current_activities}
              onChange={(v) => onChange({ current_activities: v as string[] })}
            />
          </div>
        </div>
      );
    case "work":
      return (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Job type</Label>
            <OptionGrid
              options={JOB_TYPE_OPTIONS}
              value={responses.job_type}
              onChange={(v) => onChange({ job_type: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Work hours</Label>
            <OptionGrid
              options={WORK_HOURS_OPTIONS}
              value={responses.work_hours}
              onChange={(v) => onChange({ work_hours: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Commute</Label>
            <OptionGrid
              options={COMMUTE_OPTIONS}
              value={responses.commute}
              onChange={(v) => onChange({ commute: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Average daily steps</Label>
            <OptionGrid
              options={DAILY_STEPS_OPTIONS}
              value={responses.daily_steps}
              onChange={(v) => onChange({ daily_steps: v as string })}
            />
          </div>
        </div>
      );
    case "sleep":
      return (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Hours of sleep</Label>
            <OptionGrid
              options={SLEEP_HOURS_OPTIONS}
              value={responses.sleep_hours}
              onChange={(v) => onChange({ sleep_hours: v as string })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="q-wake">Usual wake time</Label>
              <Input
                id="q-wake"
                type="time"
                value={responses.wake_time ?? ""}
                onChange={(e) => onChange({ wake_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-bed">Usual bedtime</Label>
              <Input
                id="q-bed"
                type="time"
                value={responses.bedtime ?? ""}
                onChange={(e) => onChange({ bedtime: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Daytime energy</Label>
            <OptionGrid
              options={ENERGY_OPTIONS}
              value={responses.energy_level}
              onChange={(v) => onChange({ energy_level: v as string })}
            />
          </div>
        </div>
      );
    case "nutrition":
      return (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Diet style</Label>
            <OptionGrid
              options={DIET_TYPE_OPTIONS}
              value={responses.diet_type}
              onChange={(v) => onChange({ diet_type: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Meals per day</Label>
            <OptionGrid
              options={MEALS_PER_DAY_OPTIONS}
              value={responses.meals_per_day}
              onChange={(v) => onChange({ meals_per_day: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cooking at home</Label>
            <OptionGrid
              options={COOKING_OPTIONS}
              value={responses.cooking_frequency}
              onChange={(v) => onChange({ cooking_frequency: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Food allergies (pick all)</Label>
            <OptionGrid
              multi
              options={ALLERGY_OPTIONS}
              value={responses.food_allergies}
              onChange={(v) => onChange({ food_allergies: v as string[] })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-dislikes">Foods you dislike or avoid</Label>
            <Textarea
              id="q-dislikes"
              rows={2}
              placeholder="e.g. mushrooms, spicy food…"
              value={responses.food_dislikes ?? ""}
              onChange={(e) => onChange({ food_dislikes: e.target.value })}
            />
          </div>
        </div>
      );
    case "health":
      return (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Injury areas (pick all that apply)</Label>
            <OptionGrid
              multi
              options={INJURY_AREA_OPTIONS}
              value={responses.injury_areas}
              onChange={(v) => onChange({ injury_areas: v as string[] })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-injury-details">Injury details</Label>
            <Textarea
              id="q-injury-details"
              rows={2}
              placeholder="What hurts, when it flares up, what to avoid…"
              value={responses.injury_details ?? ""}
              onChange={(e) => onChange({ injury_details: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Health conditions</Label>
            <OptionGrid
              multi
              options={HEALTH_CONDITION_OPTIONS}
              value={responses.health_conditions}
              onChange={(v) => onChange({ health_conditions: v as string[] })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-condition-details">Condition details</Label>
            <Textarea
              id="q-condition-details"
              rows={2}
              placeholder="Anything your coach should know…"
              value={responses.health_condition_details ?? ""}
              onChange={(e) =>
                onChange({ health_condition_details: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-meds">Medications / supplements</Label>
            <Textarea
              id="q-meds"
              rows={2}
              placeholder="Optional"
              value={responses.medications ?? ""}
              onChange={(e) => onChange({ medications: e.target.value })}
            />
          </div>
        </div>
      );
    case "lifestyle":
      return (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Smoking</Label>
            <OptionGrid
              options={SMOKING_OPTIONS}
              value={responses.smoking}
              onChange={(v) => onChange({ smoking: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Alcohol</Label>
            <OptionGrid
              options={ALCOHOL_OPTIONS}
              value={responses.alcohol}
              onChange={(v) => onChange({ alcohol: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Stress level</Label>
            <OptionGrid
              options={STRESS_OPTIONS}
              value={responses.stress_level}
              onChange={(v) => onChange({ stress_level: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>Water habits</Label>
            <OptionGrid
              options={WATER_HABITS_OPTIONS}
              value={responses.water_habits}
              onChange={(v) => onChange({ water_habits: v as string })}
            />
          </div>
        </div>
      );
    default:
      return null;
  }
}

export function IntakeQuestionnaireWizard({
  initialResponses = EMPTY_INTAKE_RESPONSES,
  onComplete,
  onStepChange,
  compact = false,
  completeLabel = "See my plan preview",
}: {
  initialResponses?: IntakeResponses;
  onComplete: (responses: IntakeResponses) => void;
  onStepChange?: (step: number) => void;
  compact?: boolean;
  completeLabel?: string;
}) {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<IntakeResponses>(initialResponses);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const current = INTAKE_STEPS[step];
  const progress = ((step + 1) / INTAKE_STEPS.length) * 100;

  const patch = useCallback((update: Partial<IntakeResponses>) => {
    setResponses((prev) => ({ ...prev, ...update }));
    setError(null);
  }, []);

  const goTo = (next: number) => {
    setStep(next);
    onStepChange?.(next);
    setError(null);
  };

  const handleNext = () => {
    const missing = getStepMissingFields(current.id, responses);
    if (missing.length > 0) {
      setError("Pick an option or fill in the required fields to continue.");
      return;
    }
    if (step < INTAKE_STEPS.length - 1) {
      goTo(step + 1);
      return;
    }
    startTransition(() => onComplete(responses));
  };

  const handleBack = () => {
    if (step > 0) goTo(step - 1);
  };

  return (
    <div className={cn("space-y-6", compact && "space-y-4")}>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Step {step + 1} of {INTAKE_STEPS.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <p className="text-2xl">{current.emoji}</p>
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">
              {current.title}
            </h2>
            <p className="text-sm text-muted-foreground">{current.subtitle}</p>
          </div>

          <StepFields stepId={current.id} responses={responses} onChange={patch} />
        </motion.div>
      </AnimatePresence>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={step === 0}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="button" className="flex-1 gap-2" onClick={handleNext}>
          {step === INTAKE_STEPS.length - 1 ? (
            <>
              <Sparkles className="h-4 w-4" />
              {completeLabel}
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {step === INTAKE_STEPS.length - 1 && (
        <p className="text-center text-xs text-muted-foreground">
          Your answers personalize macros, habits, and coach recommendations.
        </p>
      )}
    </div>
  );
}

export function IntakeCompleteSummary({
  responses,
  macros,
}: {
  responses: IntakeResponses;
  macros?: { calories: number; protein: number; carbs: number; fat: number } | null;
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Check className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-black">You&apos;re all set</h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ve mapped your profile. Create your account to unlock your dashboard.
        </p>
      </div>
      {macros && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Estimated daily targets
          </p>
          <p className="mt-1 text-lg font-black">
            {macros.calories} cal · P{macros.protein} · C{macros.carbs} · F{macros.fat}
          </p>
        </div>
      )}
          <p className="text-xs text-muted-foreground">
            Preview estimate — AI fine-tunes when you create your account
          </p>
    </div>
  );
}
