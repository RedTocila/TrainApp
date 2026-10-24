"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dumbbell, Mars, Venus } from "lucide-react";
import {
  AgeWheel,
  FieldHint,
  FollowUp,
  FunnelBackButton,
  FunnelContinue,
  FunnelTextField,
  HeightRuler,
  PillOptions,
  QuestionTitle,
  RecoveryTimeFields,
  WeightRuler,
} from "@/components/intake-funnel-controls";
import { DashboardThemedShell } from "@/components/dashboard-themed-shell";
import { ExerciseGifImage } from "@/components/exercise-gif-image";
import { NutritionRemainingCard } from "@/components/nutrition-remaining-card";
import { starterProgramPreview } from "@/lib/intake-starter-program";
import { resolveExerciseGifUrls, resolveProfileGender } from "@/lib/exercise-gif";
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
  JOB_TYPE_OPTIONS,
  MEALS_PER_DAY_OPTIONS,
  SLEEP_HOURS_OPTIONS,
  SMOKING_OPTIONS,
  STRESS_OPTIONS,
  TRAINING_DAYS_OPTIONS,
  TRAINING_EXPERIENCE_OPTIONS,
  TRAINING_TIME_OPTIONS,
  WATER_HABITS_OPTIONS,
  WORK_HOURS_OPTIONS,
  getMissingIntakeResponses,
  isIntakeResponsesComplete,
  normalizeIntakeResponses,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import { GENDER_OPTIONS } from "@/lib/intake-display";
import { cn } from "@/lib/utils";

const DEFAULT_AGE = 25;
const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_WEIGHT_KG = 75;

const GENDER_PILLS = GENDER_OPTIONS.filter((option) => option.value).map((option) => ({
  value: option.value,
  label: option.label,
}));

type ScreenDef = {
  id: string;
  section: string;
  lead: string;
  emphasis: string;
  picker?: boolean;
  required: (keyof IntakeResponses)[];
};

/** One screen per picker. Related choices share a screen so the funnel stays short. */
const FUNNEL_SCREENS: ScreenDef[] = [
  {
    id: "age",
    section: "About you",
    lead: "How old",
    emphasis: "are you?",
    picker: true,
    required: ["age"],
  },
  {
    id: "gender",
    section: "About you",
    lead: "What's your",
    emphasis: "gender?",
    required: ["gender"],
  },
  {
    id: "height",
    section: "About you",
    lead: "How tall",
    emphasis: "are you?",
    picker: true,
    required: ["height_cm"],
  },
  {
    id: "weight",
    section: "About you",
    lead: "What's your",
    emphasis: "current weight?",
    picker: true,
    required: ["intake_weight_kg"],
  },
  {
    id: "goal",
    section: "Your goal",
    lead: "What's",
    emphasis: "your goal?",
    required: ["goal", "goal_timeline"],
  },
  {
    id: "training",
    section: "Your training",
    lead: "How do you",
    emphasis: "train?",
    required: ["training_experience", "training_days_per_week", "training_time_preference"],
  },
  {
    id: "access",
    section: "Your training",
    lead: "What can you",
    emphasis: "train with?",
    required: [],
  },
  {
    id: "day",
    section: "Your day",
    lead: "What does",
    emphasis: "your day look like?",
    required: ["job_type", "work_hours", "daily_steps"],
  },
  {
    id: "recovery",
    section: "Recovery",
    lead: "How do you",
    emphasis: "recover?",
    required: ["sleep_hours", "energy_level"],
  },
  {
    id: "food",
    section: "Nutrition",
    lead: "How do you",
    emphasis: "eat?",
    required: ["diet_type", "meals_per_day", "cooking_frequency"],
  },
  {
    id: "limits",
    section: "Nutrition",
    lead: "Anything we should",
    emphasis: "leave off?",
    required: [],
  },
  {
    id: "health",
    section: "Health",
    lead: "Any pain",
    emphasis: "or limits?",
    required: [],
  },
  {
    id: "lifestyle",
    section: "Lifestyle",
    lead: "Life off",
    emphasis: "the gym",
    required: ["smoking", "alcohol", "stress_level", "water_habits"],
  },
];

function filled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function isScreenComplete(screen: ScreenDef, responses: IntakeResponses): boolean {
  return screen.required.every((key) => filled(responses[key]));
}

function withPickerDefaults(screenId: string, responses: IntakeResponses): IntakeResponses {
  if (screenId === "age" && responses.age == null) return { ...responses, age: DEFAULT_AGE };
  if (screenId === "height" && responses.height_cm == null) {
    return { ...responses, height_cm: DEFAULT_HEIGHT_CM };
  }
  if (screenId === "weight" && responses.intake_weight_kg == null) {
    return { ...responses, intake_weight_kg: DEFAULT_WEIGHT_KG };
  }
  return responses;
}

const slide = {
  enter: (dir: number) => ({ x: dir * 36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -36, opacity: 0 }),
};

function ScreenFields({
  screenId,
  responses,
  onChange,
  compact,
}: {
  screenId: string;
  responses: IntakeResponses;
  onChange: (patch: Partial<IntakeResponses>) => void;
  compact: boolean;
}) {
  switch (screenId) {
    case "age":
      return (
        <AgeWheel
          compact={compact}
          value={responses.age ?? DEFAULT_AGE}
          onChange={(age) => onChange({ age })}
        />
      );
    case "gender":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            {GENDER_PILLS.map((option) => {
              const active = responses.gender === option.value;
              const Icon = option.value === "female" ? Venus : Mars;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ gender: option.value })}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border-2 transition-colors",
                    active
                      ? "border-primary bg-primary/15 text-primary shadow-lg shadow-primary/25"
                      : "border-border bg-card text-foreground"
                  )}
                >
                  <Icon className="h-10 w-10" strokeWidth={1.75} aria-hidden />
                  <span className="text-base font-bold">{option.label}</span>
                </button>
              );
            })}
          </div>
          <FieldHint>It changes how we estimate your energy burn.</FieldHint>
        </>
      );
    case "height":
      return (
        <HeightRuler
          compact={compact}
          value={responses.height_cm ?? DEFAULT_HEIGHT_CM}
          onChange={(height_cm) => onChange({ height_cm })}
        />
      );
    case "weight":
      return (
        <WeightRuler
          compact={compact}
          value={responses.intake_weight_kg ?? DEFAULT_WEIGHT_KG}
          onChange={(intake_weight_kg) => onChange({ intake_weight_kg })}
        />
      );
    case "goal":
      return (
        <>
          <PillOptions
            options={GOAL_OPTIONS}
            value={responses.goal}
            onChange={(value) => onChange({ goal: value as string })}
          />
          <FollowUp label="How fast do you want to get there?">
            <PillOptions
              options={GOAL_TIMELINE_OPTIONS}
              value={responses.goal_timeline}
              onChange={(value) => onChange({ goal_timeline: value as string })}
            />
          </FollowUp>
        </>
      );
    case "training":
      return (
        <>
          <FollowUp first label="Experience">
            <PillOptions
              options={TRAINING_EXPERIENCE_OPTIONS}
              value={responses.training_experience}
              onChange={(value) => onChange({ training_experience: value as string })}
            />
          </FollowUp>
          <FollowUp label="Days you train">
            <PillOptions
              options={TRAINING_DAYS_OPTIONS}
              value={responses.training_days_per_week}
              onChange={(value) => onChange({ training_days_per_week: value as string })}
            />
          </FollowUp>
          <FollowUp label="When do you like to train?">
            <PillOptions
              options={TRAINING_TIME_OPTIONS}
              value={responses.training_time_preference}
              onChange={(value) => onChange({ training_time_preference: value as string })}
            />
          </FollowUp>
        </>
      );
    case "access":
      return (
        <>
          <FollowUp first label="Equipment">
            <PillOptions
              multi
              options={EQUIPMENT_OPTIONS}
              value={responses.equipment_access}
              onChange={(value) => onChange({ equipment_access: value as string[] })}
            />
          </FollowUp>
          <FollowUp label="Other activities">
            <PillOptions
              multi
              options={ACTIVITY_OPTIONS}
              value={responses.current_activities}
              onChange={(value) => onChange({ current_activities: value as string[] })}
            />
          </FollowUp>
          <FieldHint>Select every option that fits. You can leave these blank.</FieldHint>
        </>
      );
    case "day":
      return (
        <>
          <FollowUp first label="What kind of work?">
            <PillOptions
              options={JOB_TYPE_OPTIONS}
              value={responses.job_type}
              onChange={(value) => onChange({ job_type: value as string })}
            />
          </FollowUp>
          <FollowUp label="Work hours">
            <PillOptions
              options={WORK_HOURS_OPTIONS}
              value={responses.work_hours}
              onChange={(value) => onChange({ work_hours: value as string })}
            />
          </FollowUp>
          <FollowUp label="Commute">
            <PillOptions
              options={COMMUTE_OPTIONS}
              value={responses.commute}
              onChange={(value) => onChange({ commute: value as string })}
            />
          </FollowUp>
          <FollowUp label="Daily steps">
            <PillOptions
              options={DAILY_STEPS_OPTIONS}
              value={responses.daily_steps}
              onChange={(value) => onChange({ daily_steps: value as string })}
            />
          </FollowUp>
        </>
      );
    case "recovery":
      return (
        <>
          <FollowUp first label="Hours of sleep">
            <PillOptions
              options={SLEEP_HOURS_OPTIONS}
              value={responses.sleep_hours}
              onChange={(value) => onChange({ sleep_hours: value as string })}
            />
          </FollowUp>
          <FollowUp label="Daytime energy">
            <PillOptions
              options={ENERGY_OPTIONS}
              value={responses.energy_level}
              onChange={(value) => onChange({ energy_level: value as string })}
            />
          </FollowUp>
          <RecoveryTimeFields
            wake={responses.wake_time ?? ""}
            bedtime={responses.bedtime ?? ""}
            onWake={(wake_time) => onChange({ wake_time })}
            onBedtime={(bedtime) => onChange({ bedtime })}
          />
        </>
      );
    case "food":
      return (
        <>
          <FollowUp first label="Diet style">
            <PillOptions
              options={DIET_TYPE_OPTIONS}
              value={responses.diet_type}
              onChange={(value) => onChange({ diet_type: value as string })}
            />
          </FollowUp>
          <FollowUp label="Meals per day">
            <PillOptions
              options={MEALS_PER_DAY_OPTIONS}
              value={responses.meals_per_day}
              onChange={(value) => onChange({ meals_per_day: value as string })}
            />
          </FollowUp>
          <FollowUp label="Cooking at home">
            <PillOptions
              options={COOKING_OPTIONS}
              value={responses.cooking_frequency}
              onChange={(value) => onChange({ cooking_frequency: value as string })}
            />
          </FollowUp>
        </>
      );
    case "limits":
      return (
        <>
          <FollowUp first label="Food allergies">
            <PillOptions
              multi
              options={ALLERGY_OPTIONS}
              value={responses.food_allergies}
              onChange={(value) => onChange({ food_allergies: value as string[] })}
            />
          </FollowUp>
          <div className="mt-9">
            <FunnelTextField
              id="q-dislikes"
              label="Foods you dislike or avoid"
              multiline
              placeholder="e.g. mushrooms, spicy food…"
              value={responses.food_dislikes ?? ""}
              onChange={(food_dislikes) => onChange({ food_dislikes })}
            />
          </div>
          <FieldHint>Pick every allergy that applies, or None.</FieldHint>
        </>
      );
    case "health":
      return (
        <>
          <FollowUp first label="Injury areas">
            <PillOptions
              multi
              options={INJURY_AREA_OPTIONS}
              value={responses.injury_areas}
              onChange={(value) => onChange({ injury_areas: value as string[] })}
            />
          </FollowUp>
          <div className="mt-6">
            <FunnelTextField
              id="q-injury-details"
              label="Injury details"
              multiline
              placeholder="What hurts, when it flares up, what to avoid…"
              value={responses.injury_details ?? ""}
              onChange={(injury_details) => onChange({ injury_details })}
            />
          </div>
          <FollowUp label="Health conditions">
            <PillOptions
              multi
              options={HEALTH_CONDITION_OPTIONS}
              value={responses.health_conditions}
              onChange={(value) => onChange({ health_conditions: value as string[] })}
            />
          </FollowUp>
          <div className="mt-6 space-y-4">
            <FunnelTextField
              id="q-condition-details"
              label="Condition details"
              multiline
              placeholder="Anything your coach should know…"
              value={responses.health_condition_details ?? ""}
              onChange={(health_condition_details) => onChange({ health_condition_details })}
            />
            <FunnelTextField
              id="q-meds"
              label="Medications or supplements"
              multiline
              placeholder="Optional"
              value={responses.medications ?? ""}
              onChange={(medications) => onChange({ medications })}
            />
          </div>
          <FieldHint>Optional. This is how the plan works around your body.</FieldHint>
        </>
      );
    case "lifestyle":
      return (
        <>
          <FollowUp first label="Smoking">
            <PillOptions
              options={SMOKING_OPTIONS}
              value={responses.smoking}
              onChange={(value) => onChange({ smoking: value as string })}
            />
          </FollowUp>
          <FollowUp label="Alcohol">
            <PillOptions
              options={ALCOHOL_OPTIONS}
              value={responses.alcohol}
              onChange={(value) => onChange({ alcohol: value as string })}
            />
          </FollowUp>
          <FollowUp label="Stress">
            <PillOptions
              options={STRESS_OPTIONS}
              value={responses.stress_level}
              onChange={(value) => onChange({ stress_level: value as string })}
            />
          </FollowUp>
          <FollowUp label="Water">
            <PillOptions
              options={WATER_HABITS_OPTIONS}
              value={responses.water_habits}
              onChange={(value) => onChange({ water_habits: value as string })}
            />
          </FollowUp>
        </>
      );
    default:
      return null;
  }
}

function FunnelProgress({
  step,
  free,
  onJump,
}: {
  step: number;
  free: boolean;
  onJump: (index: number) => void;
}) {
  if (!free) {
    return (
      <div className="mx-5 h-0.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-red-600 transition-[width] duration-300"
          style={{ width: `${((step + 1) / FUNNEL_SCREENS.length) * 100}%` }}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-1 px-5">
      {FUNNEL_SCREENS.map((screen, index) => (
        <button
          key={screen.id}
          type="button"
          aria-label={`Open ${screen.section}`}
          onClick={() => onJump(index)}
          className="h-4 flex-1"
        >
          <span
            className={cn(
              "block h-0.5 rounded-full",
              index <= step ? "bg-red-600" : "bg-zinc-800"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export type IntakeQuestionnaireWizardHandle = {
  submit: () => boolean;
};

export const IntakeQuestionnaireWizard = forwardRef<
  IntakeQuestionnaireWizardHandle,
  {
    initialResponses?: IntakeResponses;
    onComplete: (responses: IntakeResponses) => void;
    onStepChange?: (step: number) => void;
    compact?: boolean;
    /** Allow jumping to any step (dashboard edit). Default off for onboarding. */
    freeStepNavigation?: boolean;
    /** All questions on one page. Used when updating from the dashboard. */
    stacked?: boolean;
    completeLabel?: string;
    /** First-screen back. Onboarding uses this to leave the funnel. */
    onExit?: () => void;
    secondaryAction?: { label: string; onClick: () => void };
    status?: string | null;
    /** Ignore continue while a save is in flight. */
    locked?: boolean;
  }
>(function IntakeQuestionnaireWizard(
  {
    initialResponses = EMPTY_INTAKE_RESPONSES,
    onComplete,
    onStepChange,
    compact = false,
    freeStepNavigation = false,
    stacked = false,
    completeLabel = "See my plan preview",
    onExit,
    secondaryAction,
    status,
    locked = false,
  },
  ref
) {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<IntakeResponses>(() =>
    normalizeIntakeResponses(initialResponses)
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const serverSnapshot = useRef(JSON.stringify(initialResponses));
  const bodyRef = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  const screen = FUNNEL_SCREENS[step] ?? FUNNEL_SCREENS[0];
  const shown = withPickerDefaults(screen.id, responses);
  const last = FUNNEL_SCREENS.length - 1;
  const ready = freeStepNavigation || isScreenComplete(screen, shown);

  useEffect(() => {
    const nextSnapshot = JSON.stringify(initialResponses);
    if (serverSnapshot.current !== nextSnapshot) {
      serverSnapshot.current = nextSnapshot;
      setResponses(normalizeIntakeResponses(initialResponses));
    }
  }, [initialResponses]);

  useEffect(() => {
    setResponses((prev) => {
      const next = withPickerDefaults(screen.id, prev);
      return next === prev ? prev : next;
    });
  }, [screen.id]);

  const patch = useCallback((update: Partial<IntakeResponses>) => {
    setResponses((prev) => ({ ...prev, ...update }));
    setError(null);
  }, []);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(last, next));
    direction.current = clamped >= step ? 1 : -1;
    setStep(clamped);
    onStepChange?.(clamped);
    setError(null);
    requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({ top: 0 });
    });
  };

  const submitFrom = (source: IntakeResponses) => {
    const seeded = stacked
      ? FUNNEL_SCREENS.reduce(
          (current, item) => withPickerDefaults(item.id, current),
          source
        )
      : source;
    const normalized = normalizeIntakeResponses(seeded);
    if (!isIntakeResponsesComplete(normalized)) {
      const missing = getMissingIntakeResponses(normalized);
      const index = FUNNEL_SCREENS.findIndex((item) => !isScreenComplete(item, normalized));
      if (index >= 0) {
        if (stacked) {
          document
            .getElementById(`intake-screen-${FUNNEL_SCREENS[index]?.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          goTo(index);
        }
      }
      setError(
        missing.length
          ? `Still need: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`
          : "Fill in the required fields to save."
      );
      return false;
    }
    setError(null);
    startTransition(() => onComplete(normalized));
    return true;
  };

  useImperativeHandle(ref, () => ({
    submit: () => submitFrom(withPickerDefaults(screen.id, responses)),
  }));

  const handleNext = () => {
    if (locked) return;
    const seeded = withPickerDefaults(screen.id, responses);
    if (seeded !== responses) setResponses(seeded);
    if (!freeStepNavigation && !isScreenComplete(screen, seeded)) {
      setError("Choose an option to continue.");
      return;
    }
    if (step < last) {
      goTo(step + 1);
      return;
    }
    submitFrom(seeded);
  };

  const handleBack = () => {
    if (step > 0) {
      goTo(step - 1);
      return;
    }
    onExit?.();
  };

  const showBack = step > 0 || Boolean(onExit);

  if (stacked) {
    return (
      <div className="space-y-6">
        {FUNNEL_SCREENS.map((item, index) => {
          const previous = FUNNEL_SCREENS[index - 1];
          const showSection = !previous || previous.section !== item.section;
          const values = withPickerDefaults(item.id, responses);
          return (
            <section key={item.id} id={`intake-screen-${item.id}`} className="space-y-3 scroll-mt-24">
              {showSection ? (
                <p className="px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
                  {item.section}
                </p>
              ) : null}
              <div className="rounded-3xl bg-white/[0.04] px-3 py-4">
                <QuestionTitle lead={item.lead} emphasis={item.emphasis} />
                <div className="mt-5">
                  <ScreenFields
                    screenId={item.id}
                    responses={values}
                    onChange={patch}
                    compact
                  />
                </div>
              </div>
            </section>
          );
        })}
        {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
        {status ? <p className="text-center text-sm text-zinc-400">{status}</p> : null}
        <FunnelContinue
          label={completeLabel}
          ready={!locked}
          onClick={() => submitFrom(responses)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "premium-gradient relative flex w-full flex-col text-foreground",
        compact ? "min-h-[32rem]" : "min-h-0 flex-1"
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-md flex-col",
          compact ? "min-h-[32rem]" : "min-h-0 flex-1"
        )}
      >
      <header className="relative flex h-14 shrink-0 items-center px-2">
        {showBack ? (
          <FunnelBackButton label={step === 0 ? "Back" : "Previous question"} onClick={handleBack} />
        ) : (
          <span className="w-10" />
        )}
        <p className="pointer-events-none absolute inset-x-14 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          {screen.section}
        </p>
      </header>

      <FunnelProgress
        step={step}
        free={freeStepNavigation}
        onJump={(index) => {
          if (freeStepNavigation || index <= step) goTo(index);
        }}
      />

      <div
        ref={bodyRef}
        className={cn(
          "relative px-5 pb-6",
          compact ? "mt-2" : "mt-1 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
        )}
      >
        <AnimatePresence mode="wait" custom={direction.current}>
          <motion.div
            key={screen.id}
            custom={direction.current}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={cn("flex flex-col pt-8", screen.picker && !compact && "min-h-full")}
          >
            <QuestionTitle lead={screen.lead} emphasis={screen.emphasis} />
            <div
              className={cn(
                "mt-8",
                screen.picker && !compact && "flex min-h-0 flex-1 flex-col"
              )}
            >
              <div
                className={cn(
                  "w-full",
                  screen.picker && !compact && "flex min-h-0 flex-1 flex-col",
                  screen.id === "height" && !compact && "justify-center"
                )}
              >
                <ScreenFields
                  screenId={screen.id}
                  responses={shown}
                  onChange={patch}
                  compact={compact}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative shrink-0 px-5 pb-4 pt-1">
        {error ? <p className="mb-3 text-center text-sm text-red-400">{error}</p> : null}
        {status ? <p className="mb-3 text-center text-sm text-zinc-400">{status}</p> : null}
        <FunnelContinue
          label={step === last ? completeLabel : "Continue"}
          ready={ready && !locked}
          onClick={handleNext}
        />
        {freeStepNavigation && step < last ? (
          <button
            type="button"
            onClick={() => submitFrom(withPickerDefaults(screen.id, responses))}
            className="mt-3 w-full py-1 text-center text-sm text-zinc-400"
          >
            {completeLabel}
          </button>
        ) : null}
        {secondaryAction ? (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="mt-3 w-full py-1 text-center text-sm text-zinc-500"
          >
            {secondaryAction.label}
          </button>
        ) : null}
        {!freeStepNavigation && step === last ? (
          <p className="mt-3 text-center text-xs text-zinc-500">
            Your answers personalize macros, habits, and coach recommendations.
          </p>
        ) : null}
      </div>
      </div>
    </div>
  );
});

const MACRO_COLORS = {
  protein: "#34d399",
  carbs: "#38bdf8",
  fat: "#fbbf24",
} as const;

export function MacroDonut({
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

function ExampleExerciseGif({
  name,
  gender,
}: {
  name: string;
  gender?: string;
}) {
  const { url, fallbackUrl } = resolveExerciseGifUrls({
    name,
    gender: resolveProfileGender(gender),
  });

  return (
    <ExerciseGifImage
      gifUrl={url}
      fallbackUrl={fallbackUrl}
      alt={name}
      className="h-10 w-10 shrink-0 rounded-lg bg-white"
    />
  );
}

export function IntakeCompleteSummary({
  responses,
  macros,
}: {
  responses: IntakeResponses;
  macros?: { calories: number; protein: number; carbs: number; fat: number } | null;
}) {
  const workout = starterProgramPreview(responses);

  return (
    <div className="space-y-4 text-left">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-black">You&apos;re all set</h2>
        <p className="text-sm text-muted-foreground">
          Your targets and training week, ready when you create your account.
        </p>
      </div>
      {macros ? (
        <DashboardThemedShell theme="nutrition" solid>
          <NutritionRemainingCard
            mode="target"
            caption="kcal / day"
            current={{ calories: 0, protein: 0, carbs: 0, fat: 0 }}
            targets={macros}
          />
        </DashboardThemedShell>
      ) : null}
      <DashboardThemedShell theme="workout" solid>
        <div className="flex flex-col gap-3 px-3.5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
              <Dumbbell className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
                Workout
              </p>
              <p className="text-sm font-semibold text-white">
                {workout.daysPerWeek} days/week · {workout.weeks} weeks
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-1.5">
            {workout.weekdayLabels.map((day, index) => (
              <li
                key={day}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-3 py-2"
              >
                <span className="w-9 shrink-0 text-sm font-black text-white">{day}</span>
                <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  {(workout.exampleExercises[index] ?? []).map((name) => (
                    <ExampleExerciseGif
                      key={`${day}-${name}`}
                      name={name}
                      gender={responses.gender}
                    />
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-white/60">
            {workout.experience} · {workout.equipment}. Each day is a warm-up, full workout, and stretch — {workout.sessions} sessions land on your calendar after signup.
          </p>
        </div>
      </DashboardThemedShell>
    </div>
  );
}
