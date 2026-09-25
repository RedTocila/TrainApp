import type OpenAI from "openai";
import { createPendingAction } from "@/lib/ai/coach-pending-actions";
import type { CoachPendingAction } from "@/lib/ai/coach-pending-actions";
import {
  coachAddCardioCommand,
  coachClearCardioSchedule,
  coachCompleteHabitCommand,
  coachListAllHabitsCommand,
  coachListMyCardioCommand,
  coachListTodayCardioCommand,
  coachListTodayHabitsCommand,
  coachListTodayWorkoutsCommand,
  coachLogMealCommand,
  coachLogWaterCommand,
  coachLogWeightCommand,
  coachSaveHabitCommand,
  coachStartCardioCommand,
  coachStartWorkoutCommand,
  coachUpdateMacrosCommand,
  coachUpdateProfileSettingsCommand,
  coachUpdateWaterGoalCommand,
  getWorkoutPlanDaysSummary,
  listCoachNutritionPlans,
  listCoachWeekPlans,
  listCoachWorkoutPlans,
  resolveCardioForCoach,
  resolveHabitForCoach,
  resolveNutritionPlanLabel,
  resolveWeekPlanLabel,
  resolveWorkoutPlanLabel,
  summarizeCoachUpcomingWorkoutSchedule,
} from "@/lib/actions/coach-commands";
import { resolveCoachNavigatePath } from "@/lib/ai/coach-navigate";
import {
  INTAKE_MULTI_SELECT_KEYS,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import type { Profile } from "@/lib/types";

export const COMMAND_TOOL_STATUS_LABELS: Record<string, string> = {
  list_my_workouts: "Loading your workouts…",
  list_my_week_plans: "Loading your week plans…",
  list_upcoming_workout_schedule: "Checking your calendar…",
  list_my_nutrition_plans: "Loading your meal plans…",
  log_meal: "Logging meal…",
  log_weight: "Logging weight…",
  log_water: "Logging water…",
  list_today_habits: "Loading today's habits…",
  list_my_habits: "Loading your habits…",
  complete_habit: "Marking habit complete…",
  add_habit: "Adding habit…",
  update_habit: "Updating habit…",
  delete_habit: "Preparing to delete habit…",
  update_macros: "Updating macros…",
  update_water_goal: "Updating water goal…",
  update_profile_settings: "Updating profile…",
  navigate_to: "Opening page…",
  list_today_workouts: "Checking today's workouts…",
  list_my_cardio: "Loading your cardio…",
  list_today_cardio: "Checking today's cardio…",
  add_cardio: "Adding cardio…",
  schedule_cardio: "Preparing cardio schedule…",
  delete_cardio: "Preparing to delete cardio…",
  clear_cardio_schedule: "Preparing to clear cardio schedule…",
  start_workout: "Starting workout…",
  start_cardio: "Starting cardio…",
  schedule_workout_plan: "Preparing workout schedule…",
  schedule_week_plan: "Preparing week plan schedule…",
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
        "List the client's LIBRARY strength/HIIT workout plans (ids + titles). Excludes week templates, warm-ups, stretches, and one-off calendar sessions. Call before scheduling/deleting/assigning a single library plan. For full-week templates use list_my_week_plans. For clearing the calendar, prefer list_upcoming_workout_schedule.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_week_plans",
      description:
        "List saved WEEK templates (kind=week) with ids, training-day count, weekdays, and whether currently scheduled. Use before schedule_week_plan when they want to put an existing week program back on the calendar. Prefer this over list_my_workouts for 'my week plan' / 'schedule my program for N weeks'.",
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
        "Immediately add water intake in ml (e.g. 250, 500). Soft action — no confirm button. Call when they say they drank water, logged water, or give an amount in ml/L.",
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
      name: "list_today_habits",
      description:
        "List habits scheduled for today with completion status. Call before complete_habit when the habit name is ambiguous.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_habit",
      description:
        "Mark a scheduled habit complete for today (same as checking it off on the dashboard). Soft action — no confirm button.",
      parameters: {
        type: "object",
        properties: {
          habit_id: { type: "string", description: "From list_today_habits" },
          habit_name: {
            type: "string",
            description: "Partial title match if id unknown",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_habits",
      description:
        "List all saved habits with ids (not only today). Call before update_habit or delete_habit.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "add_habit",
      description:
        "Create a new recurring habit. Soft action — runs immediately. Defaults to every day for 12 weeks if weekdays/weeks omitted.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          weekdays: {
            type: "array",
            items: { type: "number" },
            description: "0=Sun … 6=Sat. Default all days.",
          },
          weeks: { type: "number", description: "Repeat length, default 12" },
          time_start: { type: "string", description: "HH:MM optional" },
          time_end: { type: "string", description: "HH:MM optional" },
          start_mode: {
            type: "string",
            enum: ["now", "next_week"],
            description: "Default now",
          },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_habit",
      description:
        "Update an existing habit title/schedule. Soft action. Call list_my_habits first for habit_id.",
      parameters: {
        type: "object",
        properties: {
          habit_id: { type: "string" },
          title: { type: "string" },
          weekdays: {
            type: "array",
            items: { type: "number" },
          },
          weeks: { type: "number" },
          time_start: { type: "string" },
          time_end: { type: "string" },
          start_mode: { type: "string", enum: ["now", "next_week"] },
        },
        required: ["habit_id", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_habit",
      description:
        "Propose permanently deleting a habit. SERIOUS — Confirm button required. Call list_my_habits first if needed.",
      parameters: {
        type: "object",
        properties: {
          habit_id: { type: "string" },
          habit_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_macros",
      description:
        "Update daily calorie/macro targets on the profile (same as Profile tab macros). Soft action. Prefer absolute grams: calories + protein_g/carbs_g/fat_g. Or calories + protein_pct/carbs_pct/fat_pct.",
      parameters: {
        type: "object",
        properties: {
          calories: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
          protein_pct: { type: "number" },
          carbs_pct: { type: "number" },
          fat_pct: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_water_goal",
      description:
        "Set daily water goal in ml (profile/dashboard water target). Soft action.",
      parameters: {
        type: "object",
        properties: {
          water_goal_ml: { type: "number" },
        },
        required: ["water_goal_ml"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_profile_settings",
      description:
        "Update profile settings: name, phone, goal, language (en/al), units (metric/imperial). Soft action. Only include fields the client wants changed.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          phone: { type: "string" },
          goal: {
            type: "string",
            enum: [
              "lose_weight",
              "gain_weight",
              "build_muscle",
              "stay_fit",
              "improve_endurance",
              "general_health",
            ],
          },
          preferred_locale: { type: "string", enum: ["en", "al"] },
          unit_system: { type: "string", enum: ["metric", "imperial"] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description:
        "Open a dashboard page for the client (closes chat and navigates). Use aliases like programs, profile, nutrition, workout schedule, cardio, habits, ai, progress photos, home — or a /dashboard/... path.",
      parameters: {
        type: "object",
        properties: {
          page: {
            type: "string",
            description: "Alias or path, e.g. programs, profile, /dashboard/workout",
          },
        },
        required: ["page"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_today_workouts",
      description:
        "List workouts scheduled for today (or date) with scheduled_workout_id. Call before start_workout when multiple sessions exist.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, default today" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_workout",
      description:
        "Start today's next workout (or a specific scheduled_workout_id) and open the live session. Soft action — navigates immediately.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, default today" },
          scheduled_workout_id: {
            type: "string",
            description: "Optional — from list_today_workouts",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_cardio",
      description:
        "List saved cardio library items with ids. Call before schedule/delete/start when id unknown.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_today_cardio",
      description: "List cardio scheduled for today (or date).",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, default today" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_cardio",
      description:
        "Create a cardio library item (title, optional duration minutes / YouTube URL). Soft action.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          duration_minutes: { type: "number" },
          youtube_url: { type: "string" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_cardio",
      description:
        "Propose scheduling a cardio item onto calendar weekdays for N weeks. SERIOUS — Confirm required. Call list_my_cardio first if needed.",
      parameters: {
        type: "object",
        properties: {
          cardio_id: { type: "string" },
          cardio_name: { type: "string" },
          weeks: { type: "number", description: "Default 4" },
          weekdays: {
            type: "array",
            items: { type: "number" },
            description: "0=Sun … 6=Sat. Default Mon/Wed/Fri",
          },
          start_mode: { type: "string", enum: ["now", "next_week"] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_cardio",
      description:
        "Propose permanently deleting a cardio library item. SERIOUS — Confirm required.",
      parameters: {
        type: "object",
        properties: {
          cardio_id: { type: "string" },
          cardio_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clear_cardio_schedule",
      description:
        "Propose clearing upcoming scheduled cardio. SERIOUS — Confirm required. Use clear_all or cardio_id.",
      parameters: {
        type: "object",
        properties: {
          cardio_id: { type: "string" },
          clear_all: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_cardio",
      description:
        "Open the cardio timer session for today (or date). Soft action — navigates immediately. Pass cardio_id if multiple.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string" },
          cardio_id: { type: "string" },
          cardio_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_workout_plan",
      description:
        "Propose scheduling an EXISTING saved strength/HIIT library plan onto the calendar for several weeks. SERIOUS — Confirm button required. Do NOT use for week templates (kind=week) — use schedule_week_plan instead. The plan must already have enough training days: scheduling places one plan day per weekday. If they want Mon/Tue/Thu/Fri (4 days), the plan needs 4 days — call generate_workout_plan with days_per_week=4 first, wait for Apply, then schedule. Call list_my_workouts first if you lack plan_id.",
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
      name: "schedule_week_plan",
      description:
        "Propose scheduling an EXISTING saved week template (Plans tab) onto the calendar for N weeks — places each day's main (+ warm-up/stretch if configured) on its weekdays. SERIOUS — Confirm required. Call list_my_week_plans first for week_plan_id. Prefer this when they say 'schedule my week plan', 'put my program back on the calendar', or name a week template.",
      parameters: {
        type: "object",
        properties: {
          week_plan_id: { type: "string", description: "Id from list_my_week_plans" },
          weeks: { type: "number", description: "1–52, default 4" },
          start_date: {
            type: "string",
            description: "YYYY-MM-DD anchor, default today",
          },
        },
        required: ["week_plan_id"],
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
        "Propose permanently deleting a personal workout or week plan. SERIOUS — needs Confirm. Call list_my_workouts or list_my_week_plans first.",
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
  profile: Profile,
  timezoneOffsetMinutes?: number
): Promise<{
  result: string;
  pendingAction?: CoachPendingAction;
  dashboardMutated?: boolean;
  navigate?: string;
}> {
  const args = parseToolArgs(argsJson);
  const tz =
    typeof args.timezoneOffsetMinutes === "number" &&
    Number.isFinite(args.timezoneOffsetMinutes)
      ? args.timezoneOffsetMinutes
      : timezoneOffsetMinutes;

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
            "Only one-off calendar sessions exist. Use list_upcoming_workout_schedule. For full-week templates call list_my_week_plans.",
        };
      }
      return {
        result:
          lines.join("\n") +
          "\n(Week templates are separate — call list_my_week_plans to schedule a full week program.)",
      };
    }
    case "list_my_week_plans": {
      const plans = await listCoachWeekPlans();
      if (!plans.length) {
        return {
          result:
            "No week plans yet. Generate one with generate_workout_plan (multi-day + warm-up/stretch) and have them tap Apply — or they can build one under Dashboard → Programs / Plans.",
        };
      }
      return {
        result: plans
          .map((p) => {
            const extras = p.includeExtras ? "warm-up+stretch" : "mains only";
            const sched = p.scheduled
              ? `scheduled${p.scheduledWeeks ? ` (${p.scheduledWeeks}w)` : ""}`
              : "not scheduled";
            return `- ${p.title} id=${p.id} · ${p.dayCount} day(s) · ${extras} · ${sched} · ${p.dayLabels}`;
          })
          .join("\n"),
      };
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
        timezoneOffsetMinutes: tz,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client it's logged.`,
        dashboardMutated: true,
      };
    }
    case "log_weight": {
      const result = await coachLogWeightCommand({
        weight_kg: Number(args.weight_kg),
        date: typeof args.date === "string" ? args.date : undefined,
        timezoneOffsetMinutes: tz,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client it's saved.`,
        dashboardMutated: true,
      };
    }
    case "log_water": {
      const result = await coachLogWaterCommand({
        amount_ml: Number(args.amount_ml),
        date: typeof args.date === "string" ? args.date : undefined,
        timezoneOffsetMinutes: tz,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client it's saved.`,
        dashboardMutated: true,
      };
    }
    case "list_today_habits": {
      const result = await coachListTodayHabitsCommand(tz);
      if ("error" in result) return { result: `Error: ${result.error}` };
      return { result: result.text };
    }
    case "complete_habit": {
      const result = await coachCompleteHabitCommand({
        habit_id:
          typeof args.habit_id === "string" ? args.habit_id : undefined,
        habit_name:
          typeof args.habit_name === "string" ? args.habit_name : undefined,
        timezoneOffsetMinutes: tz,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client it's checked off.`,
        dashboardMutated: true,
      };
    }
    case "list_my_habits": {
      const result = await coachListAllHabitsCommand();
      if ("error" in result) return { result: `Error: ${result.error}` };
      return { result: result.text };
    }
    case "add_habit": {
      const result = await coachSaveHabitCommand({
        title: String(args.title ?? ""),
        weekdays: Array.isArray(args.weekdays)
          ? args.weekdays.map(Number)
          : undefined,
        weeks: typeof args.weeks === "number" ? args.weeks : undefined,
        time_start:
          typeof args.time_start === "string" ? args.time_start : undefined,
        time_end: typeof args.time_end === "string" ? args.time_end : undefined,
        start_mode:
          args.start_mode === "next_week" ? "next_week" : "now",
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client it's saved.`,
        dashboardMutated: true,
      };
    }
    case "update_habit": {
      const habitId = String(args.habit_id ?? "");
      if (!habitId) return { result: "Error: habit_id is required. Call list_my_habits." };
      const result = await coachSaveHabitCommand({
        habit_id: habitId,
        title: String(args.title ?? ""),
        weekdays: Array.isArray(args.weekdays)
          ? args.weekdays.map(Number)
          : undefined,
        weeks: typeof args.weeks === "number" ? args.weeks : undefined,
        time_start:
          typeof args.time_start === "string" ? args.time_start : undefined,
        time_end: typeof args.time_end === "string" ? args.time_end : undefined,
        start_mode:
          args.start_mode === "next_week" ? "next_week" : "now",
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client it's updated.`,
        dashboardMutated: true,
      };
    }
    case "delete_habit": {
      const resolved = await resolveHabitForCoach({
        habit_id:
          typeof args.habit_id === "string" ? args.habit_id : undefined,
        habit_name:
          typeof args.habit_name === "string" ? args.habit_name : undefined,
      });
      if ("error" in resolved) return { result: `Error: ${resolved.error}` };
      const pendingAction = createPendingAction(
        "delete_habit",
        `Delete habit “${resolved.title}”`,
        "Permanently removes this habit and its schedule.",
        { habitId: resolved.id, title: resolved.title },
        { confirmLabel: "Delete habit" }
      );
      return {
        result:
          "Confirm card shown for habit delete. Not deleted until they confirm.",
        pendingAction,
      };
    }
    case "update_macros": {
      const result = await coachUpdateMacrosCommand({
        calories: typeof args.calories === "number" ? args.calories : undefined,
        protein_g:
          typeof args.protein_g === "number" ? args.protein_g : undefined,
        carbs_g: typeof args.carbs_g === "number" ? args.carbs_g : undefined,
        fat_g: typeof args.fat_g === "number" ? args.fat_g : undefined,
        protein_pct:
          typeof args.protein_pct === "number" ? args.protein_pct : undefined,
        carbs_pct:
          typeof args.carbs_pct === "number" ? args.carbs_pct : undefined,
        fat_pct: typeof args.fat_pct === "number" ? args.fat_pct : undefined,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client macros are updated.`,
        dashboardMutated: true,
      };
    }
    case "update_water_goal": {
      const result = await coachUpdateWaterGoalCommand({
        water_goal_ml: Number(args.water_goal_ml),
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client the water goal is saved.`,
        dashboardMutated: true,
      };
    }
    case "update_profile_settings": {
      if (
        args.full_name === undefined &&
        args.phone === undefined &&
        args.goal === undefined &&
        args.preferred_locale === undefined &&
        args.unit_system === undefined
      ) {
        return {
          result:
            "Error: Provide at least one of full_name, phone, goal, preferred_locale, unit_system.",
        };
      }
      const result = await coachUpdateProfileSettingsCommand({
        full_name:
          typeof args.full_name === "string" ? args.full_name : undefined,
        phone: typeof args.phone === "string" ? args.phone : undefined,
        goal: typeof args.goal === "string" ? args.goal : undefined,
        preferred_locale:
          typeof args.preferred_locale === "string"
            ? args.preferred_locale
            : undefined,
        unit_system:
          typeof args.unit_system === "string" ? args.unit_system : undefined,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client profile settings are saved.`,
        dashboardMutated: true,
      };
    }
    case "navigate_to": {
      const resolved = resolveCoachNavigatePath(String(args.page ?? ""));
      if ("error" in resolved) return { result: `Error: ${resolved.error}` };
      return {
        result: `Opening ${resolved.href} for the client now.`,
        navigate: resolved.href,
      };
    }
    case "list_today_workouts": {
      const result = await coachListTodayWorkoutsCommand(
        typeof args.date === "string" ? args.date : undefined,
        tz
      );
      if ("error" in result) return { result: `Error: ${result.error}` };
      return { result: result.text };
    }
    case "start_workout": {
      const result = await coachStartWorkoutCommand({
        date: typeof args.date === "string" ? args.date : undefined,
        scheduled_workout_id:
          typeof args.scheduled_workout_id === "string"
            ? args.scheduled_workout_id
            : undefined,
        timezoneOffsetMinutes: tz,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client the workout is opening.`,
        navigate: result.navigate,
        dashboardMutated: true,
      };
    }
    case "list_my_cardio": {
      const result = await coachListMyCardioCommand();
      if ("error" in result) return { result: `Error: ${result.error}` };
      return { result: result.text };
    }
    case "list_today_cardio": {
      const result = await coachListTodayCardioCommand(
        typeof args.date === "string" ? args.date : undefined,
        tz
      );
      if ("error" in result) return { result: `Error: ${result.error}` };
      return { result: result.text };
    }
    case "add_cardio": {
      const result = await coachAddCardioCommand({
        title: String(args.title ?? ""),
        description:
          typeof args.description === "string" ? args.description : undefined,
        duration_minutes:
          typeof args.duration_minutes === "number"
            ? args.duration_minutes
            : undefined,
        youtube_url:
          typeof args.youtube_url === "string" ? args.youtube_url : undefined,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client it's saved.`,
        dashboardMutated: true,
      };
    }
    case "schedule_cardio": {
      const resolved = await resolveCardioForCoach({
        cardio_id:
          typeof args.cardio_id === "string" ? args.cardio_id : undefined,
        cardio_name:
          typeof args.cardio_name === "string" ? args.cardio_name : undefined,
      });
      if ("error" in resolved) return { result: `Error: ${resolved.error}` };
      const weeks =
        typeof args.weeks === "number" && args.weeks > 0
          ? Math.round(args.weeks)
          : 4;
      const weekdays = Array.isArray(args.weekdays)
        ? args.weekdays
            .map(Number)
            .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
        : [1, 3, 5];
      const startMode =
        args.start_mode === "next_week" ? "next_week" : "now";
      const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const daysLabel = weekdays
        .map((d) => weekdayLabels[d] ?? String(d))
        .join(", ");
      const pendingAction = createPendingAction(
        "schedule_cardio",
        `Schedule “${resolved.title}”`,
        `Places this cardio on ${daysLabel} for ${weeks} week(s) (${startMode}).`,
        {
          cardioId: resolved.id,
          title: resolved.title,
          weeks,
          weekdays,
          startMode,
        },
        { confirmLabel: "Schedule cardio" }
      );
      return {
        result:
          "Confirm card shown for cardio schedule. Not scheduled until they confirm.",
        pendingAction,
      };
    }
    case "delete_cardio": {
      const resolved = await resolveCardioForCoach({
        cardio_id:
          typeof args.cardio_id === "string" ? args.cardio_id : undefined,
        cardio_name:
          typeof args.cardio_name === "string" ? args.cardio_name : undefined,
      });
      if ("error" in resolved) return { result: `Error: ${resolved.error}` };
      const pendingAction = createPendingAction(
        "delete_cardio",
        `Delete cardio “${resolved.title}”`,
        "Permanently removes this cardio from your library.",
        { cardioId: resolved.id, title: resolved.title },
        { confirmLabel: "Delete cardio" }
      );
      return {
        result:
          "Confirm card shown for cardio delete. Not deleted until they confirm.",
        pendingAction,
      };
    }
    case "clear_cardio_schedule": {
      const clearAll = args.clear_all === true;
      let cardioId: string | undefined;
      let title = "all cardio";
      if (!clearAll) {
        const resolved = await resolveCardioForCoach({
          cardio_id:
            typeof args.cardio_id === "string" ? args.cardio_id : undefined,
          cardio_name:
            typeof args.cardio_name === "string" ? args.cardio_name : undefined,
        });
        if ("error" in resolved) {
          return {
            result: `Error: ${resolved.error} Or set clear_all=true.`,
          };
        }
        cardioId = resolved.id;
        title = resolved.title;
      }
      const pendingAction = createPendingAction(
        "clear_cardio_schedule",
        clearAll ? "Clear all upcoming cardio" : `Clear schedule for “${title}”`,
        "Removes upcoming calendar cardio sessions from today onward.",
        {
          cardioId: cardioId ?? null,
          clearAll,
          title,
          timezoneOffsetMinutes: tz,
        },
        { confirmLabel: "Clear schedule" }
      );
      return {
        result:
          "Confirm card shown for clearing cardio schedule. Not cleared until they confirm.",
        pendingAction,
      };
    }
    case "start_cardio": {
      const result = await coachStartCardioCommand({
        date: typeof args.date === "string" ? args.date : undefined,
        cardio_id:
          typeof args.cardio_id === "string" ? args.cardio_id : undefined,
        cardio_name:
          typeof args.cardio_name === "string" ? args.cardio_name : undefined,
        timezoneOffsetMinutes: tz,
      });
      if ("error" in result) return { result: `Error: ${result.error}` };
      return {
        result: `${result.message} Tell the client cardio is opening.`,
        navigate: result.navigate,
      };
    }
    case "schedule_workout_plan": {
      const planId = String(args.plan_id ?? "");
      const meta = await resolveWorkoutPlanLabel(planId);
      if (!meta) return { result: "Workout plan not found. Call list_my_workouts." };

      // Week templates must use the week scheduler (warm-up/stretch + fixed weekdays).
      if (meta.kind === "week") {
        const weeks =
          typeof args.weeks === "number" && args.weeks > 0
            ? Math.round(args.weeks)
            : 4;
        const startDate =
          typeof args.start_date === "string" ? args.start_date : undefined;
        const weekMeta = await resolveWeekPlanLabel(planId);
        if (!weekMeta || weekMeta.dayCount < 1) {
          return {
            result:
              "Blocked: this week plan has no training days. Build or regenerate it first.",
          };
        }
        const pendingAction = createPendingAction(
          "schedule_week_plan",
          `Schedule week “${weekMeta.title}”`,
          `${weekMeta.dayCount} training day(s)${
            weekMeta.includeExtras ? " · warm-up + stretch" : " · mains only"
          } · ${weeks} week(s)${
            startDate ? ` · from ${startDate}` : " · starting today"
          } · ${weekMeta.dayLabels}`,
          { weekPlanId: planId, weeks, startDate },
          { confirmLabel: "Confirm schedule" }
        );
        return {
          result:
            "This is a week template — schedule preview ready via schedule_week_plan. Tell the client to tap Confirm — do NOT say it is already scheduled.",
          pendingAction,
        };
      }

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
            "Blocked: this workout has no days to schedule. Generate a new plan with generate_workout_plan first — or if they meant a week template, call list_my_week_plans then schedule_week_plan.",
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
        { planId, weeks, weekdays, startDate, timezoneOffsetMinutes: tz },
        { confirmLabel: "Confirm schedule" }
      );
      return {
        result:
          "Schedule preview is ready. Tell the client to tap Confirm — do NOT say it is already scheduled.",
        pendingAction,
      };
    }
    case "schedule_week_plan": {
      const weekPlanId = String(args.week_plan_id ?? args.plan_id ?? "");
      const meta = await resolveWeekPlanLabel(weekPlanId);
      if (!meta) {
        return {
          result:
            "Week plan not found. Call list_my_week_plans first — or generate a new week with generate_workout_plan and have them Apply.",
        };
      }
      if (meta.dayCount < 1) {
        return {
          result: "Blocked: this week plan has no training days configured.",
        };
      }
      const weeks =
        typeof args.weeks === "number" && args.weeks > 0
          ? Math.round(args.weeks)
          : 4;
      const startDate =
        typeof args.start_date === "string" ? args.start_date : undefined;
      const pendingAction = createPendingAction(
        "schedule_week_plan",
        `Schedule week “${meta.title}”`,
        `${meta.dayCount} training day(s)${
          meta.includeExtras ? " · warm-up + stretch" : " · mains only"
        } · ${weeks} week(s)${
          startDate ? ` · from ${startDate}` : " · starting today"
        } · ${meta.dayLabels}`,
        { weekPlanId, weeks, startDate },
        { confirmLabel: "Confirm schedule" }
      );
      return {
        result:
          "Week plan schedule preview ready. Tell the client to tap Confirm — do NOT say it is already scheduled.",
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
        { planId, weeks, weekdays, startDate, timezoneOffsetMinutes: tz },
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
      if (meta.kind === "week") {
        return {
          result:
            "Blocked: week templates can't be set as the active single workout. Use schedule_week_plan to put the week on the calendar, or assign a strength/HIIT library plan from list_my_workouts.",
        };
      }
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
