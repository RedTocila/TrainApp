"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
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
  normalizeIntakeResponses,
  toggleIntakeMultiSelectValue,
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
import { useBodyUnits } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function StepProgress({
  step,
  onStepSelect,
}: {
  step: number;
  onStepSelect: (index: number) => void;
}) {
  return (
    <div
      className="flex w-full items-start"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={INTAKE_STEPS.length}
      aria-valuenow={step + 1}
      aria-label={`Step ${step + 1} of ${INTAKE_STEPS.length}: ${INTAKE_STEPS[step].title}`}
    >
      {INTAKE_STEPS.map((s, index) => {
        const done = index < step;
        const active = index === step;
        return (
          <div
            key={s.id}
            className={cn("flex min-w-0 items-start", index < INTAKE_STEPS.length - 1 && "flex-1")}
          >
            <button
              type="button"
              onClick={() => onStepSelect(index)}
              disabled={!done}
              className={cn(
                "flex w-8 shrink-0 flex-col items-center gap-1 sm:w-10",
                done && "cursor-pointer"
              )}
              aria-label={done ? `Go back to ${s.title}` : s.title}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm leading-none transition-colors sm:h-9 sm:w-9",
                  done && "bg-emerald-500 text-white",
                  active && "bg-primary text-primary-foreground shadow-[0_0_14px_-2px] shadow-primary/60",
                  !done && !active && "bg-secondary text-muted-foreground"
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} />
                ) : (
                  <span className="leading-none" aria-hidden>
                    {s.emoji}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "w-full truncate text-center text-[8px] font-bold uppercase sm:text-[10px] sm:tracking-wide",
                  active
                    ? "text-primary"
                    : done
                      ? "text-emerald-500"
                      : "text-muted-foreground/70"
                )}
              >
                {s.short}
              </span>
            </button>
            {index < INTAKE_STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "mx-0.5 mt-4 h-0.5 min-w-1 flex-1 self-start rounded-full sm:mt-[1.125rem]",
                  index < step ? "bg-emerald-500" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SelectionBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {count} selected
    </span>
  );
}

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
  const multiValueRef = useRef<string[]>(Array.isArray(value) ? value : []);

  if (multi) {
    multiValueRef.current = Array.isArray(value) ? value : [];
  }

  const toggle = (optionValue: string) => {
    if (!multi) {
      onChange(optionValue);
      return;
    }
    const next = toggleIntakeMultiSelectValue(multiValueRef.current, optionValue);
    multiValueRef.current = next;
    onChange(next);
  };

  const isSelected = (optionValue: string) => {
    if (multi) return Array.isArray(selected) && selected.includes(optionValue);
    return selected === optionValue;
  };

  return (
    <div
      className="grid gap-2.5 sm:grid-cols-2"
      role={multi ? "group" : undefined}
      aria-label={multi ? "Multiple selections allowed" : undefined}
    >
      {options.map((option) => {
        const active = isSelected(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.value)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left transition-all",
              active
                ? "border-primary bg-primary/10 shadow-[0_0_16px_-6px] shadow-primary/40"
                : "border-border/70 bg-secondary/30 hover:border-primary/40 hover:bg-secondary/60"
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg leading-none",
                active ? "bg-primary/20" : "bg-secondary/80"
              )}
              aria-hidden
            >
              {option.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold leading-snug">{option.label}</span>
              {option.description && (
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {option.description}
                </span>
              )}
            </span>
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30 bg-transparent text-transparent"
              )}
              aria-hidden
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function BodyMetricInput({
  id,
  canonical,
  format,
  parse,
  onCommit,
  unitSystem,
  placeholder,
  step,
}: {
  id: string;
  canonical: number | undefined;
  format: (value: number) => string;
  parse: (raw: string) => number | null;
  onCommit: (value: number | undefined) => void;
  unitSystem: string;
  placeholder: string;
  step: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [unitSystem]);

  const display =
    draft ?? (canonical != null ? format(canonical) : "");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);
    const parsed = parse(raw);
    if (parsed != null) {
      onCommit(parsed);
    } else {
      onCommit(undefined);
    }
  };

  const handleBlur = () => {
    setDraft(null);
  };

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      step={step}
      placeholder={placeholder}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
    />
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
  const units = useBodyUnits();

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
              <div className="grid grid-cols-2 gap-2 overflow-visible px-0.5 pt-0.5">
                {GENDER_OPTIONS.filter((o) => o.value).map((opt) => {
                  const active = responses.gender === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange({ gender: opt.value })}
                      className={cn(
                        "relative flex items-center justify-center gap-2 overflow-visible rounded-2xl border-2 px-3 py-2.5 text-sm font-bold transition-all",
                        active
                          ? "border-primary bg-primary/10 text-primary shadow-[0_0_16px_-6px] shadow-primary/40"
                          : "border-border/70 bg-secondary/30 hover:border-primary/40"
                      )}
                    >
                      {opt.emoji ? (
                        <span className="leading-none" aria-hidden>
                          {opt.emoji}
                        </span>
                      ) : null}
                      <span className="leading-none">{opt.label}</span>
                      {active && (
                        <span
                          className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background"
                          aria-hidden
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="q-weight">{units.weightFieldLabel}</Label>
              <BodyMetricInput
                id="q-weight"
                canonical={responses.intake_weight_kg}
                format={units.formatWeightKgInput}
                parse={units.parseWeightInput}
                onCommit={(kg) => onChange({ intake_weight_kg: kg })}
                unitSystem={units.unitSystem}
                placeholder={units.weightPlaceholder.replace("e.g. ", "")}
                step="0.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-height">{units.heightFieldLabel}</Label>
              <BodyMetricInput
                id="q-height"
                canonical={responses.height_cm}
                format={units.formatHeightCm}
                parse={units.parseHeightInput}
                onCommit={(cm) => onChange({ height_cm: cm })}
                unitSystem={units.unitSystem}
                placeholder={units.heightPlaceholder.replace("e.g. ", "")}
                step={units.unitSystem === "imperial" ? "0.01" : "1"}
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
            <div className="flex items-center gap-2">
              <Label>Equipment access</Label>
              <SelectionBadge count={responses.equipment_access?.length ?? 0} />
            </div>
            <OptionGrid
              multi
              options={EQUIPMENT_OPTIONS}
              value={responses.equipment_access}
              onChange={(v) => onChange({ equipment_access: v as string[] })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Other activities</Label>
              <SelectionBadge count={responses.current_activities?.length ?? 0} />
            </div>
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
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="q-wake">Usual wake time</Label>
              <Input
                id="q-wake"
                type="time"
                className="relative w-full"
                value={responses.wake_time ?? ""}
                onChange={(e) => onChange({ wake_time: e.target.value })}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="q-bed">Usual bedtime</Label>
              <Input
                id="q-bed"
                type="time"
                className="relative w-full"
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
            <div className="flex items-center gap-2">
              <Label>Food allergies</Label>
              <SelectionBadge count={responses.food_allergies?.length ?? 0} />
            </div>
            <p className="text-xs text-muted-foreground">
              Select every allergy that applies. Pick &quot;None&quot; only if you have no allergies.
            </p>
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
            <div className="flex items-center gap-2">
              <Label>Injury areas</Label>
              <SelectionBadge count={responses.injury_areas?.length ?? 0} />
            </div>
            <p className="text-xs text-muted-foreground">
              Select every area that is affected. Pick &quot;None&quot; only if you have no injuries.
            </p>
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
            <div className="flex items-center gap-2">
              <Label>Health conditions</Label>
              <SelectionBadge count={responses.health_conditions?.length ?? 0} />
            </div>
            <p className="text-xs text-muted-foreground">
              Select every condition that applies. Pick &quot;None&quot; only if you have no conditions.
            </p>
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
  const [responses, setResponses] = useState<IntakeResponses>(() =>
    normalizeIntakeResponses(initialResponses)
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const serverSnapshot = useRef(JSON.stringify(initialResponses));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextSnapshot = JSON.stringify(initialResponses);
    if (serverSnapshot.current !== nextSnapshot) {
      serverSnapshot.current = nextSnapshot;
      setResponses(normalizeIntakeResponses(initialResponses));
    }
  }, [initialResponses]);

  const current = INTAKE_STEPS[step];

  const patch = useCallback((update: Partial<IntakeResponses>) => {
    setResponses((prev) => ({ ...prev, ...update }));
    setError(null);
  }, []);

  const goTo = (next: number) => {
    setStep(next);
    onStepChange?.(next);
    setError(null);
    // Bring the top of the questionnaire back into view on step change.
    requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    <div
      ref={rootRef}
      className={cn("min-w-0 scroll-mt-20 space-y-6", compact && "space-y-4")}
    >
      <StepProgress step={step} onStepSelect={(index) => index < step && goTo(index)} />

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div className="min-w-0 space-y-1">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
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

const MACRO_COLORS = {
  protein: "#34d399",
  carbs: "#38bdf8",
  fat: "#fbbf24",
} as const;

function MacroDonut({
  macros,
}: {
  macros: { calories: number; protein: number; carbs: number; fat: number };
}) {
  const segments = [
    { key: "protein", label: "Protein", grams: macros.protein, cal: macros.protein * 4 },
    { key: "carbs", label: "Carbs", grams: macros.carbs, cal: macros.carbs * 4 },
    { key: "fat", label: "Fat", grams: macros.fat, cal: macros.fat * 9 },
  ] as const;
  const totalCal = Math.max(
    segments.reduce((sum, s) => sum + s.cal, 0),
    1
  );

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let progressOffset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-44 w-44">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="13"
            className="text-secondary"
          />
          {segments.map((segment) => {
            const length = (segment.cal / totalCal) * circumference;
            const dashOffset = -progressOffset;
            progressOffset += length;
            return (
              <circle
                key={segment.key}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={MACRO_COLORS[segment.key]}
                strokeWidth="13"
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(length - 1.5, 0)} ${circumference}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black leading-none tracking-tight">
            {macros.calories}
          </span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            cal / day
          </span>
        </div>
      </div>

      <div className="grid w-full grid-cols-3 gap-2">
        {segments.map((segment) => {
          const percent = Math.round((segment.cal / totalCal) * 100);
          return (
            <div
              key={segment.key}
              className="rounded-xl bg-secondary/40 px-2 py-2.5 text-center"
            >
              <span
                className="mx-auto mb-1.5 block h-2 w-8 rounded-full"
                style={{ backgroundColor: MACRO_COLORS[segment.key] }}
                aria-hidden
              />
              <p className="text-base font-black leading-none">{segment.grams}g</p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                {segment.label} · {percent}%
              </p>
            </div>
          );
        })}
      </div>
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
    <div className="space-y-5 text-center">
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
        <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-primary">
            Your estimated daily targets
          </p>
          <MacroDonut macros={macros} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Preview estimate — AI fine-tunes when you create your account
      </p>
    </div>
  );
}
