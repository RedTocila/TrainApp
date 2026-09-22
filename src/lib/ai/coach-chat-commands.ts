import type OpenAI from "openai";
import { createPendingAction } from "@/lib/ai/coach-pending-actions";
import type { CoachPendingAction } from "@/lib/ai/coach-pending-actions";
import {
  coachLogMealCommand,
  coachLogWaterCommand,
  coachLogWeightCommand,
  getWorkoutPlanDaysSummary,
  listCoachNutritionPlans,
  listCoachWorkoutPlans,
  resolveNutritionPlanLabel,
  resolveWorkoutPlanLabel,
  summarizeCoachUpcomingWorkoutSchedule,
} from "@/lib/actions/coach-commands";
import {
  INTAKE_MULTI_SELECT_KEYS,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import type { Profile } from "@/lib/types";

export const COMMAND_TOOL_STATUS_LABELS: Record<string, string> = {
  list_my_workouts: "Loading your workouts…",
  list_upcoming_workout_schedule: "Checking your calendar…",
  list_my_nutrition_plans: "Loading your meal plans…",
  log_meal: "Logging meal…",
  log_weight: "Logging weight…",
  log_water: "Logging water…",
  schedule_workout_plan: "Preparing workout schedule…",
  schedule_nutrition_plan: "Preparing nutrition schedule…",
  clear_workout_schedule: "Preparing to clear workout schedule…",
  clear_nutrition_schedule: "Preparing to clear nutrition schedule…",
  delete_workout_plan: "Preparing to delete workout…",
  delete_nutrition_plan: "Preparing to delete meal plan…",
  assign_workout_plan: "Preparing to set active workout…",
  assign_nutrition_plan: "Preparing to set active meal plan…",
  update_health_lifestyle: "Preparing health profile update…",
};

export const COACH_COMMAND_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_my_workouts",
      description:
        "List the client's LIBRARY workout plans (ids + titles). Excludes one-off calendar day sessions. Call before scheduling, deleting, or assigning a library plan. For clearing the calendar, prefer list_upcoming_workout_schedule.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_upcoming_workout_schedule",
      description:
        "Stacked summary of upcoming scheduled workouts (totals by weekday/type, date range). NEVER dump individual dates to the client. Call when they ask to clear/delete scheduled workouts or what's on their calendar.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_nutrition_plans",
      description:
        "List personal nutrition / meal plans with ids. Call before schedule, delete, assign, or clear nutrition actions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "log_meal",
      description:
        "Immediately log a meal for the client (today unless date is set). Use when they say they ate something and give enough detail for macros. Soft action — no confirm button.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Meal name" },
          meal_type: {
            type: "string",
            enum: ["breakfast", "lunch", "dinner", "snack"],
          },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          description: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD, default today" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_weight",
      description:
        "Immediately log body weight in kg. Soft action — no confirm button.",
      parameters: {
        type: "object",
        properties: {
          weight_kg: { type: "number" },
          date: { type: "string", description: "YYYY-MM-DD, default today" },
        },
        required: ["weight_kg"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_water",
      description:
        "Immediately add water intake in ml (e.g. 250, 500). Soft action — no confirm button.",
      parameters: {
        type: "object",
        properties: {
          amount_ml: { type: "number" },
          date: { type: "string", description: "YYYY-MM-DD, default today" },
        },
        required: ["amount_ml"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_workout_plan",
      description:
        "Propose scheduling an EXISTING saved workout plan onto the calendar for several weeks. SERIOUS — Confirm button required. The plan must already have enough training days: scheduling places one plan day per weekday. If they want Mon/Tue/Thu/Fri (4 days), the plan needs 4 days — call generate_workout_plan with days_per_week=4 first, wait for Apply, then schedule. Call list_my_workouts first if you lack plan_id.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string" },
          weeks: { type: "number", description: "1–52, default 4" },
          weekdays: {
            type: "array",
            items: { type: "number" },
            description:
              "JS weekdays Sun=0…Sat=6 for each training day in order. Example Mon/Tue/Thu/Fri = [1,2,4,5]. Length should match the plan's training day count.",
          },
          start_date: { type: "string", description: "YYYY-MM-DD, default today" },
        },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_nutrition_plan",
      description:
        "Propose scheduling a nutrition plan onto calendar days. SERIOUS — needs Confirm. Call list_my_nutrition_plans first if needed.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string" },
          weeks: { type: "number", description: "Default 4" },
          weekdays: {
            type: "array",
            items: { type: "number" },
            description: "Days to place meals; default every day",
          },
          start_date: { type: "string" },
        },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clear_workout_schedule",
      description:
        "Propose clearing upcoming calendar sessions. SERIOUS — one Confirm card. Prefer stacked scopes: clear_all, weekdays, and/or kinds. Use plan_id only for a library plan. If the request is ambiguous, call list_upcoming_workout_schedule and ASK which scope first — do NOT invent dozens of confirms.",
      parameters: {
        type: "object",
        properties: {
          plan_id: {
            type: "string",
            description: "Optional library plan id — clears only that plan's upcoming sessions",
          },
          clear_all: {
            type: "boolean",
            description: "Clear every upcoming scheduled workout",
          },
          weekdays: {
            type: "array",
            items: { type: "number" },
            description: "0=Sun … 6=Sat — clear only those weekdays",
          },
          kinds: {
            type: "array",
            items: {
              type: "string",
              enum: ["warmup", "stretch", "strength", "hiit"],
            },
            description: "Optional session kinds to clear",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clear_nutrition_schedule",
      description:
        "Propose clearing upcoming nutrition schedule for a plan. SERIOUS — needs Confirm.",
      parameters: {
        type: "object",
        properties: { plan_id: { type: "string" } },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_workout_plan",
      description:
        "Propose permanently deleting a personal workout plan. SERIOUS — needs Confirm. Call list_my_workouts first.",
      parameters: {
        type: "object",
        properties: { plan_id: { type: "string" } },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_nutrition_plan",
      description:
        "Propose permanently deleting a personal nutrition plan. SERIOUS — needs Confirm.",
      parameters: {
        type: "object",
        properties: { plan_id: { type: "string" } },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_workout_plan",
      description:
        "Propose setting a personal workout as the active program. SERIOUS — needs Confirm.",
      parameters: {
        type: "object",
        properties: { plan_id: { type: "string" } },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_nutrition_plan",
      description:
        "Propose setting a personal nutrition plan as active. SERIOUS — needs Confirm.",
      parameters: {
        type: "object",
        properties: { plan_id: { type: "string" } },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_health_lifestyle",
      description:
        "Propose updating fields on the health & lifestyle questionnaire (goal, experience, equipment, sleep, injuries, etc.). SERIOUS — needs Confirm. Only include fields the client clearly wants changed.",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "object",
            description:
              "Partial intake fields, e.g. { goal: 'build_muscle', training_experience: 'beginner', equipment_access: ['home_dumbbells'], training_days_per_week: '2_3' }",
            additionalProperties: true,
          },
          summary: {
            type: "string",
            description: "Short human summary of what will change",
          },
        },
        required: ["updates", "summary"],
        additionalProperties: false,
      },
    },
  },
];

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function weekdayNames(days: number[]): string {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days.map((d) => labels[d] ?? String(d)).join(", ");
}

function sanitizeIntakeUpdates(raw: unknown): IntakeResponses {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: IntakeResponses = {};
  const scalarKeys: (keyof IntakeResponses)[] = [
    "age",
    "gender",
    "height_cm",
    "intake_weight_kg",
    "goal",
    "goal_timeline",
    "training_experience",
    "training_days_per_week",
    "training_time_preference",
    "job_type",
    "work_hours",
    "commute",
    "daily_steps",
    "sleep_hours",
    "wake_time",
    "bedtime",
    "energy_level",
    "diet_type",
    "meals_per_day",
    "cooking_frequency",
    "food_dislikes",
    "injury_details",
    "health_condition_details",
    "medications",
    "smoking",
    "alcohol",
    "stress_level",
    "water_habits",
  ];

  for (const key of scalarKeys) {
    const v = src[key];
    if (v === undefined || v === null) continue;
    if (key === "age" || key === "height_cm" || key === "intake_weight_kg") {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) (out as Record<string, unknown>)[key] = n;
    } else if (typeof v === "string" && v.trim()) {
      (out as Record<string, unknown>)[key] = v.trim();
    }
  }

  for (const key of INTAKE_MULTI_SELECT_KEYS) {
    const v = src[key];
    if (Array.isArray(v)) {
      const arr = v.filter((x): x is string => typeof x === "string" && x.length > 0);
      if (arr.length) (out as Record<string, unknown>)[key] = arr;
    } else if (typeof v === "string" && v.trim()) {
      (out as Record<string, unknown>)[key] = [v.trim()];
    }
  }

  return out;
}

export async function executeCoachCommandTool(
  name: string,
  argsJson: string,
  profile: Profile
): Promise<{
  result: string;
  pendingAction?: CoachPendingAction;
}> {
  const args = parseToolArgs(argsJson);

  switch (name) {
    case "list_my_workouts": {
      const { plans, oneOffCount } = await listCoachWorkoutPlans(profile.id);
      if (!plans.length && oneOffCount === 0) {
        return { result: "No personal workout plans yet." };
      }
      const lines = plans.map((p) => `- ${p.title} [${p.kind}] id=${p.id}`);
      if (oneOffCount > 0) {
        lines.push(
          `- (+ ${oneOffCount} one-off calendar day sessions hidden — use list_upcoming_workout_schedule / clear_workout_schedule, do not list or delete them one-by-one)`
        );
      }
      if (!plans.length) {
        return {
          result:
            lines.join("\n") ||
            "Only one-off calendar sessions exist. Use list_upcoming_workout_schedule.",
        };
      }
      return { result: lines.join("\n") };
    }
    case "list_upcoming_workout_schedule": {
      const summary = await summarizeCoachUpcomingWorkoutSchedule();
      return { result: summary.text };
    }
    case "list_my_nutrition_plans": {
      const plans = await listCoachNutritionPlans();
      if (!plans.length) {
        return { result: "No personal nutrition plans yet." };
      }
      return {
        result: plans.map((p) => `- ${p.title} id=${p.id}`).join("\n"),
      };
    }
    case "log_meal": {
      const result = await coachLogMealCommand({
        name: String(args.name ?? ""),
        meal_type: typeof args.meal_type === "string" ? args.meal_type : undefined,
        calories: typeof args.calories === "number" ? args.calories : undefined,
        protein: typeof args.protein === "number" ? args.protein : undefined,
        carbs: typeof args.carbs === "number" ? args.carbs : undefined,
        fat: typeof args.fat === "number" ? args.fat : undefined,
        description:
          typeof args.description === "string" ? args.description : undefined,
        date: typeof args.date === "string" ? args.date : undefined,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return { result: `${result.message} Tell the client it's logged.` };
    }
    case "log_weight": {
      const result = await coachLogWeightCommand({
        weight_kg: Number(args.weight_kg),
        date: typeof args.date === "string" ? args.date : undefined,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return { result: `${result.message} Tell the client it's saved.` };
    }
    case "log_water": {
      const result = await coachLogWaterCommand({
        amount_ml: Number(args.amount_ml),
        date: typeof args.date === "string" ? args.date : undefined,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return { result: `${result.message} Tell the client it's saved.` };
    }
    case "schedule_workout_plan": {
      const planId = String(args.plan_id ?? "");
      const meta = await resolveWorkoutPlanLabel(planId);
      if (!meta) return { result: "Workout plan not found. Call list_my_workouts." };
      const weeks =
        typeof args.weeks === "number" && args.weeks > 0 ? Math.round(args.weeks) : 4;
      const weekdays = Array.isArray(args.weekdays)
        ? args.weekdays.map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
        : [];
      const startDate =
        typeof args.start_date === "string" ? args.start_date : undefined;
      const days = await getWorkoutPlanDaysSummary(planId);

      if (weekdays.length > 0 && meta.dayCount < weekdays.length) {
        return {
          result: `Blocked: plan "${meta.title}" only has ${meta.dayCount} training day(s), but they asked for ${weekdays.length} weekdays (${weekdayNames(weekdays)}). Scheduling cannot invent missing plan days. FIRST call generate_workout_plan with days_per_week=${weekdays.length} and preferences that name those weekdays. After they tap Apply on the preview, call list_my_workouts, then schedule_workout_plan with the new plan_id, weeks=${weeks}, and weekdays=${JSON.stringify(weekdays)}.`,
        };
      }

      if (meta.dayCount < 1) {
        return {
          result:
            "Blocked: this workout has no days to schedule. Generate a new plan with generate_workout_plan first.",
        };
      }

      const pendingAction = createPendingAction(
        "schedule_workout_plan",
        `Schedule “${meta.title}”`,
        `${meta.dayCount} training day(s) · ${weeks} week(s)${
          weekdays.length ? ` · ${weekdayNames(weekdays)}` : " · default training days"
        }${startDate ? ` · from ${startDate}` : " · starting today"} → ~${
          (weekdays.length || meta.dayCount) * weeks
        } sessions. Days: ${days.map((d) => d.title).join(", ") || "—"}`,
        { planId, weeks, weekdays, startDate },
        { confirmLabel: "Confirm schedule" }
      );
      return {
        result:
          "Schedule preview is ready. Tell the client to tap Confirm — do NOT say it is already scheduled.",
        pendingAction,
      };
    }
    case "schedule_nutrition_plan": {
      const planId = String(args.plan_id ?? "");
      const meta = await resolveNutritionPlanLabel(planId);
      if (!meta) {
        return { result: "Nutrition plan not found. Call list_my_nutrition_plans." };
      }
      const weeks =
        typeof args.weeks === "number" && args.weeks > 0 ? Math.round(args.weeks) : 4;
      const weekdays = Array.isArray(args.weekdays)
        ? args.weekdays.map(Number).filter((n) => Number.isFinite(n))
        : [];
      const startDate =
        typeof args.start_date === "string" ? args.start_date : undefined;
      const pendingAction = createPendingAction(
        "schedule_nutrition_plan",
        `Schedule “${meta.title}”`,
        `${weeks} week(s) of nutrition days${
          weekdays.length ? ` on ${weekdayNames(weekdays)}` : " (every day)"
        }${startDate ? ` from ${startDate}` : ", starting today"}.`,
        { planId, weeks, weekdays, startDate },
        { confirmLabel: "Confirm schedule" }
      );
      return {
        result:
          "Nutrition schedule preview ready. Client must tap Confirm — not scheduled yet.",
        pendingAction,
      };
    }
    case "clear_workout_schedule": {
      const planId =
        typeof args.plan_id === "string" && args.plan_id.trim()
          ? args.plan_id.trim()
          : null;
      const clearAll = args.clear_all === true;
      const weekdays = Array.isArray(args.weekdays)
        ? args.weekdays
            .map(Number)
            .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
        : [];
      const kinds = Array.isArray(args.kinds)
        ? args.kinds
            .map(String)
            .map((k) => k.toLowerCase())
            .filter((k) =>
              ["warmup", "stretch", "strength", "hiit"].includes(k)
            )
        : [];

      if (!planId && !clearAll && weekdays.length === 0 && kinds.length === 0) {
        return {
          result:
            "Ambiguous clear. Call list_upcoming_workout_schedule, then ASK which scope (all upcoming, weekdays, kinds, or one library plan_id). Do not list every session.",
        };
      }

      let title = "Clear upcoming workouts";
      let summary = "Removes matching upcoming calendar sessions. Past sessions stay.";

      if (planId) {
        const meta = await resolveWorkoutPlanLabel(planId);
        if (!meta) return { result: "Workout plan not found." };
        title = `Clear schedule for “${meta.title}”`;
        summary = `Removes upcoming calendar sessions for this library workout${
          weekdays.length ? ` on ${weekdayNames(weekdays)}` : ""
        }${kinds.length ? ` (${kinds.join(", ")})` : ""}. Past sessions stay.`;
      } else if (clearAll && weekdays.length === 0 && kinds.length === 0) {
        const schedule = await summarizeCoachUpcomingWorkoutSchedule();
        title = "Clear all upcoming workouts";
        summary =
          schedule.total > 0
            ? `Removes all ${schedule.total} upcoming calendar sessions. Past sessions stay.`
            : "No upcoming sessions found — confirm does nothing.";
      } else {
        const parts: string[] = [];
        if (weekdays.length) parts.push(weekdayNames(weekdays));
        if (kinds.length) parts.push(kinds.join("/"));
        title = `Clear upcoming (${parts.join(" · ") || "filtered"})`;
        summary = `Removes upcoming sessions matching ${parts.join(" + ") || "the filter"}. Past sessions stay.`;
      }

      const pendingAction = createPendingAction(
        "clear_workout_schedule",
        title,
        summary,
        {
          planId,
          clearAll,
          weekdays,
          kinds,
        },
        { confirmLabel: "Clear schedule" }
      );
      return {
        result:
          "Confirm card shown (one stacked clear). Wait for the client to confirm — do NOT claim it's cleared yet. Do not paste the full session list.",
        pendingAction,
      };
    }
    case "clear_nutrition_schedule": {
      const planId = String(args.plan_id ?? "");
      const meta = await resolveNutritionPlanLabel(planId);
      if (!meta) return { result: "Nutrition plan not found." };
      const pendingAction = createPendingAction(
        "clear_nutrition_schedule",
        `Clear nutrition schedule for “${meta.title}”`,
        "Removes upcoming scheduled nutrition days for this plan.",
        { planId },
        { confirmLabel: "Clear schedule" }
      );
      return {
        result: "Confirm card shown. Not cleared until they confirm.",
        pendingAction,
      };
    }
    case "delete_workout_plan": {
      const planId = String(args.plan_id ?? "");
      const meta = await resolveWorkoutPlanLabel(planId);
      if (!meta) return { result: "Workout plan not found." };
      const pendingAction = createPendingAction(
        "delete_workout_plan",
        `Delete “${meta.title}”`,
        "Permanently deletes this workout and its exercises. This cannot be undone.",
        { planId },
        { confirmLabel: "Delete workout" }
      );
      return {
        result: "Delete confirm card shown. Do NOT say deleted until they confirm.",
        pendingAction,
      };
    }
    case "delete_nutrition_plan": {
      const planId = String(args.plan_id ?? "");
      const meta = await resolveNutritionPlanLabel(planId);
      if (!meta) return { result: "Nutrition plan not found." };
      const pendingAction = createPendingAction(
        "delete_nutrition_plan",
        `Delete “${meta.title}”`,
        "Permanently deletes this meal plan. This cannot be undone.",
        { planId },
        { confirmLabel: "Delete meal plan" }
      );
      return {
        result: "Delete confirm card shown. Do NOT say deleted until they confirm.",
        pendingAction,
      };
    }
    case "assign_workout_plan": {
      const planId = String(args.plan_id ?? "");
      const meta = await resolveWorkoutPlanLabel(planId);
      if (!meta) return { result: "Workout plan not found." };
      const pendingAction = createPendingAction(
        "assign_workout_plan",
        `Make “${meta.title}” active`,
        "Sets this workout as your active program (replaces the current active workout).",
        { planId },
        { confirmLabel: "Set as active" }
      );
      return {
        result: "Confirm card shown. Not active until they confirm.",
        pendingAction,
      };
    }
    case "assign_nutrition_plan": {
      const planId = String(args.plan_id ?? "");
      const meta = await resolveNutritionPlanLabel(planId);
      if (!meta) return { result: "Nutrition plan not found." };
      const pendingAction = createPendingAction(
        "assign_nutrition_plan",
        `Make “${meta.title}” active`,
        "Sets this nutrition plan as active.",
        { planId },
        { confirmLabel: "Set as active" }
      );
      return {
        result: "Confirm card shown. Not active until they confirm.",
        pendingAction,
      };
    }
    case "update_health_lifestyle": {
      const updates = sanitizeIntakeUpdates(args.updates);
      if (Object.keys(updates).length === 0) {
        return { result: "No valid health/lifestyle fields to update." };
      }
      const summary =
        typeof args.summary === "string" && args.summary.trim()
          ? args.summary.trim()
          : `Update: ${Object.keys(updates).join(", ")}`;
      const pendingAction = createPendingAction(
        "update_health_lifestyle",
        "Update health & lifestyle",
        summary,
        { updates },
        { confirmLabel: "Save profile changes" }
      );
      return {
        result:
          "Confirm card shown for health profile changes. Not saved until they confirm.",
        pendingAction,
      };
    }
    default:
      return { result: `Unknown command tool: ${name}` };
  }
}

export const COACH_COMMAND_TOOL_NAMES = new Set(
  COACH_COMMAND_TOOLS.map((t) =>
    t.type === "function" ? t.function.name : ""
  ).filter(Boolean)
);
