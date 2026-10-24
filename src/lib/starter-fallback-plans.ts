import type { AiWeeklyFullProgram } from "@/lib/ai/generate-weekly-full-program";
import type {
  AiGeneratedHiitPlan,
  AiGeneratedWorkoutDay,
} from "@/lib/ai/plan-builder-types";
import type { IntakeResponses } from "@/lib/intake-questionnaire";
import {
  daysPerWeekFromIntake,
  wantsIntervalMainFromIntake,
} from "@/lib/intake-starter-program";
import type { MacroTargets } from "@/lib/macro-calculator";
import type { MealSlot } from "@/lib/meal-slots";

type Exercise = AiGeneratedWorkoutDay["exercises"][number];

function ex(name: string, sets = 3, reps = "8-12", rest = 90): Exercise {
  return { name, sets, reps, rest_seconds: rest };
}

function equipmentKind(responses: IntakeResponses): "gym" | "home" | "bodyweight" {
  const access = responses.equipment_access ?? [];
  if (access.includes("full_gym")) return "gym";
  if (access.includes("home_dumbbells")) return "home";
  return "bodyweight";
}

function intervalPlan(
  title: string,
  names: string[],
  pace: "warmup" | "stretch" | "main"
): AiGeneratedHiitPlan {
  const work = pace === "stretch" ? 35 : pace === "warmup" ? 30 : 40;
  const rest = pace === "stretch" ? 10 : pace === "warmup" ? 12 : 20;
  return {
    kind: "hiit",
    title,
    description: title,
    coach_notes: [],
    config: {
      prepare_seconds: pace === "main" ? 10 : 8,
      rounds: pace === "main" ? 3 : 1,
      round_rest_seconds: pace === "main" ? 60 : 15,
      cycles: 1,
      cycle_rest_seconds: 30,
      exercises: names.map((name) => ({
        name,
        work_seconds: work,
        rest_seconds: rest,
      })),
    },
  };
}

function strengthMain(title: string, exercises: Exercise[]): AiGeneratedWorkoutDay {
  return {
    title,
    description: title,
    exercises,
    coach_notes: [],
  };
}

/** Usable first program when AI is unavailable. Catalog names so demos still resolve. */
export function fallbackStarterWorkout(
  responses: IntakeResponses,
  locale: "en" | "al"
): AiWeeklyFullProgram {
  const daysPerWeek = daysPerWeekFromIntake(responses);
  const kind = equipmentKind(responses);
  const al = locale === "al";
  const intervalMain = wantsIntervalMainFromIntake(responses);
  const library = kind === "gym" ? GYM_DAYS : kind === "home" ? HOME_DAYS : BODYWEIGHT_DAYS;
  const picked = library.slice(0, daysPerWeek);
  const titles = al ? DAY_TITLES_AL : DAY_TITLES_EN;

  return {
    title: al ? `Fillestar · ${daysPerWeek} ditë` : `Starter · ${daysPerWeek} days`,
    description: al
      ? "Programi yt i parë. Çdo ditë: ngrohje, stërvitja kryesore, pastaj shtrirje."
      : "Your first program. Each day: warm-up, a full workout, then stretching.",
    includeExtras: true,
    coach_notes: [],
    days: picked.map((day, index) => {
      const title = titles[day.focus] ?? (al ? `Dita ${index + 1}` : `Day ${index + 1}`);
      const warmTitle = al ? `Ngrohje · ${title}` : `${title} warm-up`;
      const stretchTitle = al ? `Shtrirje · ${title}` : `${title} stretch`;
      return {
        focus: title,
        warmup: intervalPlan(warmTitle, day.warmup, "warmup"),
        stretch: intervalPlan(stretchTitle, day.stretch, "stretch"),
        main: intervalMain
          ? {
              kind: "hiit" as const,
              plan: intervalPlan(title, day.exercises.map((exercise) => exercise.name), "main"),
            }
          : { kind: "strength" as const, workout: strengthMain(title, day.exercises) },
      };
    }),
  };
}

const DAY_TITLES_EN = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  full: "Full body",
} as const;

const DAY_TITLES_AL = {
  push: "Shtytje",
  pull: "Tërheqje",
  legs: "Këmbë",
  upper: "Trupi i sipërm",
  full: "Trup i plotë",
} as const;

type FallbackDay = {
  focus: keyof typeof DAY_TITLES_EN;
  warmup: string[];
  stretch: string[];
  exercises: Exercise[];
};

const PUSH_WARMUP = [
  "inchworm",
  "dynamic chest stretch (male)",
  "high knee against wall",
  "ankle circles",
  "glute bridge march",
];
const PULL_WARMUP = [
  "high knee against wall",
  "inchworm",
  "dead bug",
  "ankle circles",
  "bodyweight standing row",
];
const LEGS_WARMUP = [
  "high knee against wall",
  "ankle circles",
  "glute bridge march",
  "inchworm",
  "runners stretch",
];
const UPPER_WARMUP = [
  "inchworm",
  "dynamic chest stretch (male)",
  "dead bug",
  "high knee against wall",
  "bodyweight standing row",
];

const PUSH_STRETCH = [
  "chest and front of shoulder stretch",
  "overhead triceps stretch",
  "rear deltoid stretch",
  "kneeling lat stretch",
  "neck side stretch",
];
const PULL_STRETCH = [
  "kneeling lat stretch",
  "rear deltoid stretch",
  "chest and front of shoulder stretch",
  "hamstring stretch",
  "neck side stretch",
];
const LEGS_STRETCH = [
  "hamstring stretch",
  "lying (side) quads stretch",
  "seated glute stretch",
  "calf stretch with hands against wall",
  "seated lower back stretch",
];
const UPPER_STRETCH = [
  "chest and front of shoulder stretch",
  "kneeling lat stretch",
  "overhead triceps stretch",
  "rear deltoid stretch",
  "seated lower back stretch",
];

const GYM_DAYS: FallbackDay[] = [
  {
    focus: "push",
    warmup: PUSH_WARMUP,
    stretch: PUSH_STRETCH,
    exercises: [
      ex("barbell bench press", 4, "6-8", 120),
      ex("dumbbell incline bench press", 3, "8-10", 90),
      ex("barbell seated overhead press", 3, "8-10", 90),
      ex("dumbbell lateral raise", 3, "12-15", 60),
      ex("cable pushdown", 3, "10-12", 60),
      ex("dumbbell standing triceps extension", 3, "10-12", 60),
      ex("push-up", 2, "8-15", 60),
    ],
  },
  {
    focus: "pull",
    warmup: PULL_WARMUP,
    stretch: PULL_STRETCH,
    exercises: [
      ex("pull-up", 4, "6-10", 120),
      ex("barbell bent over row", 4, "6-8", 120),
      ex("cable pulldown", 3, "8-10", 90),
      ex("dumbbell bent over row", 3, "8-12", 90),
      ex("dumbbell rear delt raise", 3, "12-15", 60),
      ex("barbell curl", 3, "8-12", 60),
      ex("dumbbell hammer curl", 3, "10-12", 60),
    ],
  },
  {
    focus: "legs",
    warmup: LEGS_WARMUP,
    stretch: LEGS_STRETCH,
    exercises: [
      ex("barbell full squat", 4, "6-8", 150),
      ex("barbell romanian deadlift", 3, "8-10", 120),
      ex("barbell hack squat", 3, "8-12", 120),
      ex("walking lunge", 3, "10/leg", 90),
      ex("barbell good morning", 3, "8-10", 90),
      ex("barbell glute bridge", 3, "8-12", 90),
      ex("barbell standing calf raise", 3, "12-15", 60),
    ],
  },
  {
    focus: "upper",
    warmup: UPPER_WARMUP,
    stretch: UPPER_STRETCH,
    exercises: [
      ex("dumbbell bench press", 4, "8-10", 90),
      ex("barbell bent over row", 4, "8-10", 90),
      ex("barbell seated overhead press", 3, "8-10", 90),
      ex("cable pulldown", 3, "8-12", 90),
      ex("dumbbell lateral raise", 3, "12-15", 60),
      ex("barbell curl", 3, "10-12", 60),
      ex("cable pushdown", 3, "10-12", 60),
    ],
  },
];

const HOME_DAYS: FallbackDay[] = [
  {
    focus: "full",
    warmup: PUSH_WARMUP,
    stretch: UPPER_STRETCH,
    exercises: [
      ex("dumbbell bench press", 4, "8-10", 90),
      ex("dumbbell bent over row", 4, "8-10", 90),
      ex("dumbbell romanian deadlift", 3, "8-12", 90),
      ex("dumbbell lunge", 3, "10/leg", 75),
      ex("push-up", 3, "8-15", 60),
      ex("glute bridge march", 3, "12", 45),
      ex("crunch floor", 3, "12-15", 45),
    ],
  },
  {
    focus: "pull",
    warmup: PULL_WARMUP,
    stretch: PULL_STRETCH,
    exercises: [
      ex("dumbbell bent over row", 4, "8-12", 90),
      ex("dumbbell romanian deadlift", 3, "8-12", 90),
      ex("walking lunge", 3, "10/leg", 75),
      ex("dumbbell hammer curl", 3, "10-12", 60),
      ex("dumbbell rear delt raise", 3, "12-15", 60),
      ex("glute bridge march", 3, "12", 45),
      ex("crunch floor", 3, "12-15", 45),
    ],
  },
  {
    focus: "legs",
    warmup: LEGS_WARMUP,
    stretch: LEGS_STRETCH,
    exercises: [
      ex("dumbbell lunge", 4, "10/leg", 75),
      ex("dumbbell romanian deadlift", 4, "8-12", 90),
      ex("jump squat", 3, "8-12", 60),
      ex("walking lunge", 3, "10/leg", 75),
      ex("glute bridge march", 3, "12", 45),
      ex("bodyweight standing calf raise", 3, "12-15", 45),
      ex("crunch floor", 3, "12-15", 45),
    ],
  },
  {
    focus: "push",
    warmup: PUSH_WARMUP,
    stretch: PUSH_STRETCH,
    exercises: [
      ex("dumbbell bench press", 4, "8-10", 90),
      ex("push-up", 3, "8-15", 60),
      ex("dumbbell lunge", 3, "10/leg", 75),
      ex("bench dip on floor", 3, "8-12", 60),
      ex("dumbbell lateral raise", 3, "12-15", 60),
      ex("glute bridge march", 3, "12", 45),
      ex("crunch floor", 3, "12-15", 45),
    ],
  },
];

const BODYWEIGHT_DAYS: FallbackDay[] = [
  {
    focus: "full",
    warmup: PUSH_WARMUP,
    stretch: UPPER_STRETCH,
    exercises: [
      ex("push-up", 4, "8-15", 60),
      ex("jump squat", 4, "8-12", 60),
      ex("walking lunge", 3, "10/leg", 60),
      ex("glute bridge march", 3, "12", 45),
      ex("bench dip on floor", 3, "8-12", 60),
      ex("bodyweight standing row", 3, "10-15", 60),
      ex("crunch floor", 3, "12-15", 45),
    ],
  },
  {
    focus: "full",
    warmup: PULL_WARMUP,
    stretch: PULL_STRETCH,
    exercises: [
      ex("bodyweight standing row", 4, "10-15", 60),
      ex("walking lunge", 3, "10/leg", 60),
      ex("mountain climber", 3, "20", 45),
      ex("glute bridge march", 3, "12", 45),
      ex("push-up", 3, "8-15", 60),
      ex("dead bug", 3, "8/side", 45),
      ex("burpee", 3, "8-10", 60),
    ],
  },
  {
    focus: "upper",
    warmup: UPPER_WARMUP,
    stretch: PUSH_STRETCH,
    exercises: [
      ex("push-up", 4, "8-15", 60),
      ex("bench dip on floor", 3, "8-12", 60),
      ex("bodyweight standing row", 4, "10-15", 60),
      ex("diamond push-up", 3, "6-12", 60),
      ex("inchworm", 3, "6", 45),
      ex("crunch floor", 3, "12-15", 45),
      ex("dead bug", 3, "8/side", 45),
    ],
  },
  {
    focus: "legs",
    warmup: LEGS_WARMUP,
    stretch: LEGS_STRETCH,
    exercises: [
      ex("walking lunge", 4, "10/leg", 60),
      ex("jump squat", 4, "8-12", 60),
      ex("glute bridge march", 3, "12", 45),
      ex("bodyweight standing calf raise", 3, "12-15", 45),
      ex("mountain climber", 3, "20", 45),
      ex("burpee", 3, "8-10", 60),
      ex("crunch floor", 3, "12-15", 45),
    ],
  },
];

export type StarterMeal = {
  slot: MealSlot;
  name: string;
  foods: { name: string; amount: string }[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** First day menu split across the client's macro targets. */
export function fallbackStarterMeals(
  targets: MacroTargets,
  responses: IntakeResponses,
  locale: "en" | "al"
): StarterMeal[] {
  const al = locale === "al";
  const diet = responses.diet_type;
  const plant = diet === "vegan" || diet === "vegetarian";
  const names = al
    ? plant
      ? ["Tërshërë me fruta", "Oriz me fasule", "Tofu me perime", "Fruta dhe kos bimor"]
      : ["Vezë dhe tërshërë", "Pula me oriz", "Darkë me patate", "Kos dhe fruta"]
    : plant
      ? ["Oats and fruit", "Rice and beans", "Tofu and vegetables", "Fruit and plant yogurt"]
      : ["Eggs and oats", "Chicken and rice", "Potato plate", "Yogurt and fruit"];
  const foods = plant
    ? [
        [{ name: al ? "Tërshërë" : "Oats", amount: "60 g" }, { name: al ? "Banane" : "Banana", amount: "1" }],
        [{ name: al ? "Oriz" : "Rice", amount: "150 g" }, { name: al ? "Fasule" : "Beans", amount: "120 g" }],
        [{ name: "Tofu", amount: "150 g" }, { name: al ? "Perime" : "Vegetables", amount: "200 g" }],
        [{ name: al ? "Fruta" : "Fruit", amount: "1" }, { name: al ? "Kos bimor" : "Plant yogurt", amount: "150 g" }],
      ]
    : [
        [{ name: al ? "Vezë" : "Eggs", amount: "2" }, { name: al ? "Tërshërë" : "Oats", amount: "50 g" }],
        [{ name: al ? "Pulë" : "Chicken", amount: "150 g" }, { name: al ? "Oriz" : "Rice", amount: "150 g" }],
        [{ name: al ? "Pulë" : "Chicken", amount: "120 g" }, { name: al ? "Patate" : "Potatoes", amount: "200 g" }],
        [{ name: al ? "Kos" : "Yogurt", amount: "150 g" }, { name: al ? "Fruta" : "Fruit", amount: "1" }],
      ];
  const slots: MealSlot[] = ["breakfast", "lunch", "dinner", "snack_1"];
  const weights = [0.25, 0.35, 0.3, 0.1];
  const calories = splitTotal(targets.calories, weights);
  const protein = splitTotal(targets.protein, weights);
  const carbs = splitTotal(targets.carbs, weights);
  const fat = splitTotal(targets.fat, weights);

  return slots.map((slot, index) => ({
    slot,
    name: names[index] ?? names[0]!,
    foods: foods[index] ?? foods[0]!,
    calories: calories[index] ?? 0,
    protein: protein[index] ?? 0,
    carbs: carbs[index] ?? 0,
    fat: fat[index] ?? 0,
  }));
}

function splitTotal(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0) || 1;
  const parts = weights.map((weight) => Math.max(0, Math.round((total * weight) / sum)));
  const drift = Math.round(total) - parts.reduce((acc, part) => acc + part, 0);
  const last = parts.length - 1;
  if (last >= 0) parts[last] = Math.max(0, (parts[last] ?? 0) + drift);
  return parts;
}
