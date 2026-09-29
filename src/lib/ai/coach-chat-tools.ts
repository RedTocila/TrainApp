import {
  buildCoachingTipsBlocks,
  buildMealIdeasBlocks,
  buildTodaySnapshotBlocks,
  buildWeeklyReportBlocks,
  buildWeightTrendBlocks,
} from "@/lib/ai/coach-chat-block-builders";
import type { CoachChatRichBlock } from "@/lib/ai/coach-chat-block-types";
import {
  COACH_COMMAND_TOOLS,
  COACH_COMMAND_TOOL_NAMES,
  COMMAND_TOOL_STATUS_LABELS,
  executeCoachCommandTool,
} from "@/lib/ai/coach-chat-commands";
import type { CoachPendingAction } from "@/lib/ai/coach-pending-actions";
import {
  editNutritionPlanForChat,
  editWorkoutPlanForChat,
  generateNutritionPlanForChat,
  generateWorkoutPlanForChat,
  summarizeActivePlans,
  removeWorkoutExerciseForChat,
  addWorkoutExerciseForChat,
  replaceWorkoutExerciseForChat,
  adjustWorkoutDifficultyForChat,
  removeWorkoutDayForChat,
  removeMatchingExercisesForChat,
  adaptWorkoutToConstraintsForChat,
  SurgicalEditError,
  NutritionEditError,
  swapFoodForChat,
  changeFoodPortionForChat,
  type ChatSurgicalResult,
} from "@/lib/ai/coach-chat-plans";
import { formatNutritionPlanText } from "@/lib/ai/nutrition-quality";
import { planMedicalDisclaimer } from "@/lib/ai/plan-medical-disclaimer";
import type { CoachChatContext } from "@/lib/ai/coach-chat-context";
import { classifyCoachIntent } from "@/lib/ai/coach-intent";
import {
  guardToolForIntent,
  NUTRITION_EDIT_TOOLS,
  NUTRITION_MUTATION_TOOLS,
  WORKOUT_MUTATION_TOOLS,
} from "@/lib/ai/coach-chat-tool-guard";
import { extractCoachConstraints } from "@/lib/ai/coach-constraints";
import { getGenerationReport } from "@/lib/ai/generate-workout-plan";
import type {
  AiGeneratedNutritionPlan,
  AiWorkoutPlanResult,
} from "@/lib/ai/plan-builder-types";
import { isAiHiitPlan } from "@/lib/ai/plan-builder-types";
import type { AiWeeklyFullProgram } from "@/lib/ai/generate-weekly-full-program";
import { generateWeeklyFullProgramFromProfile } from "@/lib/ai/generate-weekly-full-program";
import {
  isAmbiguousWorkoutVsPlanRequest,
  looksLikeSingleSessionRequest,
  looksLikeWeekPlanRequest,
} from "@/lib/ai/infer-workout-kind";
import { daysPerWeekFromIntake } from "@/lib/intake-starter-program";
import {
  formatConflictToolResult,
  WorkoutRequirementConflictError,
} from "@/lib/ai/workout-requirements";
import { getLimitExceededMessage } from "@/lib/subscription-messages";
import { hasAiPlanBuilderAccess } from "@/lib/subscription-limits";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import type { Profile } from "@/lib/types";
import type OpenAI from "openai";

export type ChatPlanScheduleIntent = {
  /** Calendar weeks to place (1–52). */
  weeks: number;
  /** JS weekdays Sun=0…Sat=6. Empty = defaults from plan day count. */
  weekdays: number[];
  startDate?: string;
};

export type ChatPlanPreview =
  | {
      type: "workout";
      plan: AiWorkoutPlanResult;
      /** When set, Apply also schedules onto the calendar. */
      schedule?: ChatPlanScheduleIntent;
    }
  | {
      type: "nutrition";
      plan: AiGeneratedNutritionPlan;
      schedule?: ChatPlanScheduleIntent;
    }
  | {
      type: "weekly_full";
      program: AiWeeklyFullProgram;
      schedule: ChatPlanScheduleIntent;
    };

export type CoachChatToolEvent =
  | { type: "tool_start"; name: string }
  | { type: "tool_done"; name: string }
  | { type: "plan_preview"; preview: ChatPlanPreview }
  | { type: "rich_blocks"; blocks: CoachChatRichBlock[] }
  | { type: "pending_action"; action: CoachPendingAction }
  | { type: "navigate"; href: string };

const PLAN_TOOLS = new Set([
  "generate_workout_plan",
  "generate_nutrition_plan",
  "edit_workout_plan",
  "edit_nutrition_plan",
  "swap_food",
  "change_food_portion",
  "remove_workout_exercise",
  "add_workout_exercise",
  "replace_workout_exercise",
  "adjust_workout_difficulty",
  "remove_workout_day",
  "remove_matching_exercises",
  "adapt_workout_to_constraints",
]);

/** Final (validated, recalculated) plan text + coach notes for the model to present simply. */
function nutritionResultDetails(plan: AiGeneratedNutritionPlan): string {
  const disclaimers = new Set([planMedicalDisclaimer("en"), planMedicalDisclaimer("al")]);
  const notes = plan.coach_notes.filter((n) => !disclaimers.has(n)).slice(0, 5);
  return [
    "FINAL PLAN (present it in this simple format; amounts and totals are already calculated — don't change numbers):",
    formatNutritionPlanText(plan),
    plan.day_variants?.length
      ? 'Several daily menus: show the first menu in full, then one short line per other menu with what changes (e.g. "Day B: turkey instead of chicken, potatoes instead of rice"). The preview card shows every menu in full.'
      : "",
    notes.length ? `Coach notes to weave in briefly: ${notes.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function generationReportLine(plan: object): string {
  const report = getGenerationReport(plan);
  if (!report) return "";
  const parts: string[] = [];
  if (report.adjustments.length) parts.push(`Adjustments to tell the client: ${report.adjustments.join(" ")}`);
  if (report.autoFixes > 0) parts.push(`${report.autoFixes} exercise(s) were swapped automatically to satisfy hard constraints.`);
  if (report.remainingWarnings.length) parts.push(`Notes: ${report.remainingWarnings.slice(0, 3).join("; ")}.`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

export const TOOL_STATUS_LABELS: Record<string, string> = {
  get_my_active_plans: "Loading your programs…",
  generate_workout_plan: "Building workout plan…",
  generate_nutrition_plan: "Building nutrition plan…",
  edit_workout_plan: "Updating workout plan…",
  edit_nutrition_plan: "Updating nutrition plan…",
  swap_food: "Swapping food…",
  change_food_portion: "Updating portion…",
  remove_workout_exercise: "Removing exercise…",
  add_workout_exercise: "Adding exercise…",
  replace_workout_exercise: "Replacing exercise…",
  adjust_workout_difficulty: "Adjusting difficulty…",
  remove_workout_day: "Removing day…",
  remove_matching_exercises: "Removing exercises…",
  adapt_workout_to_constraints: "Adapting your plan…",
  show_today_snapshot: "Loading today's snapshot…",
  show_weekly_report: "Generating weekly report…",
  show_meal_ideas: "Finding meal ideas…",
  show_weight_trend: "Loading weight trend…",
  show_coaching_tips: "Loading coaching tips…",
  ...COMMAND_TOOL_STATUS_LABELS,
};

const BASE_COACH_CHAT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_my_active_plans",
      description:
        "Get a summary of the client's current active workout and nutrition plans. Call before editing or when they ask what's in their program.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_workout_plan",
      description:
        "Generate a single WORKOUT or a full-week PLAN. Only call when the shape is clear. WORKOUT (one session: push/pull/leg/chest day, \"one workout for today\"): days_per_week=1, include_warmup_stretch=false — saves under Workouts. PLAN (\"plan\"/\"workout plan\"/week/split/PPL/N-day week): days_per_week=2–6 DISTINCT focuses, include_warmup_stretch=true — saves under Plans. If they only said \"make me a workout\" / \"build me a workout\" with no focus day and no plan/week wording, DO NOT call this tool — ask whether they want one session or a full week first. NEVER split one push session into Mon=bench, Tue=OHP, etc. NEVER use profile training-days to invent a week unless they asked for a plan/week/split.",
      parameters: {
        type: "object",
        properties: {
          preferences: {
            type: "string",
            description:
              "Extra instructions (equipment, focus, split style, weekdays). For a single session, describe that one workout (e.g. push day with chest/shoulders/tris). For a plan/week, describe the split across days — include the word plan/week so the shape is clear.",
          },
          days_per_week: {
            type: "number",
            description:
              "1 = single workout only (push day / leg day / one session). 2–6 = PLAN: that many DISTINCT training days in a week schedule. When they say plan / workout plan / program / week / split, you MUST use 2–6 (profile training days or 3–4) — never 1. Do NOT invent multi-day when they asked for one workout.",
          },
          include_warmup_stretch: {
            type: "boolean",
            description:
              "true for PLAN / week programs (each training day gets warm-up + main + stretch → Plans tab). false for single workouts and HIIT sessions (Workouts tab). When they said plan/program/week, set true.",
          },
          schedule_weeks: {
            type: "number",
            description:
              "How many weeks to repeat on the calendar (1–52). Meaningful for week plans; default 4 when they asked for a week. Optional for single workouts.",
          },
          schedule_weekdays: {
            type: "array",
            items: { type: "number" },
            description:
              "JS weekdays Sun=0…Sat=6. Only for WEEK plans when the user named days (e.g. Mon/Tue/Thu/Fri = [1,2,4,5]). Omit for single workouts. If omitted on a week, auto-defaults: 2→Mon/Thu, 3→Mon/Wed/Fri, 4→Mon/Tue/Thu/Fri, 5→Mon–Fri.",
          },
          workout_kind: {
            type: "string",
            enum: ["strength", "hiit"],
            description:
              "strength = sets×reps (default): hypertrophy, powerlifting, calisthenics, functional, kettlebell, bodybuilding, weekly splits. hiit = interval timer for a single session: HIIT, Tabata, timed circuit, EMOM/AMRAP/for-time/metcon — use days_per_week=1.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_nutrition_plan",
      description:
        "Generate a new full-day nutrition plan with macro targets and meals. Use when they want a new meal plan or daily menu.",
      parameters: {
        type: "object",
        properties: {
          preferences: {
            type: "string",
            description: "Optional extra instructions (diet style, foods to avoid, meal preferences).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_workout_plan",
      description:
        "FULL regenerate of the client's active workout plan from free-text instructions. Prefer remove_workout_exercise / add_workout_exercise / replace_workout_exercise / adjust_workout_difficulty for single-exercise or difficulty tweaks — those preserve the rest of the plan. Use this only for broad redesigns (new split, many simultaneous changes).",
      parameters: {
        type: "object",
        properties: {
          instructions: {
            type: "string",
            description: "Clear description of what to change in the workout plan.",
          },
        },
        required: ["instructions"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_workout_exercise",
      description:
        "Remove ONE exercise from the active strength workout plan without regenerating the rest. Use for 'remove exercise 3', 'remove squats', etc. day_number and exercise_number are 1-based.",
      parameters: {
        type: "object",
        properties: {
          day_number: {
            type: "number",
            description: "1-based training day (default 1).",
          },
          exercise_number: {
            type: "number",
            description: "1-based exercise index on that day (preferred when they say 'exercise 3').",
          },
          exercise_name: {
            type: "string",
            description: "Exercise name to remove if they named it instead of a number.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_workout_exercise",
      description:
        "Add ONE exercise to a day on the active strength plan. Provide exercise_name (e.g. push-ups) and/or target_muscle (e.g. shoulders). Respects equipment constraints.",
      parameters: {
        type: "object",
        properties: {
          day_number: {
            type: "number",
            description: "1-based training day (default 1).",
          },
          exercise_name: {
            type: "string",
            description: "Library exercise to add (e.g. 'push-ups', 'dumbbell row').",
          },
          target_muscle: {
            type: "string",
            description:
              "If no exact exercise_name, pick a suitable move for this muscle (chest, back, glutes, shoulders, arms, core, legs).",
          },
          sets: { type: "number" },
          reps: { type: "string" },
          rest_seconds: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_workout_exercise",
      description:
        "Replace ONE exercise on the active strength plan, keeping sets/reps/rest. Use for 'replace exercise 3', 'replace lunges', 'swap squats'. If replacement_name is omitted, pick a similar allowed alternative (same muscle when possible).",
      parameters: {
        type: "object",
        properties: {
          day_number: {
            type: "number",
            description: "1-based training day (default 1).",
          },
          exercise_number: {
            type: "number",
            description: "1-based exercise index to replace.",
          },
          exercise_name: {
            type: "string",
            description: "Name of the exercise to replace if not using exercise_number.",
          },
          replacement_name: {
            type: "string",
            description: "Optional exact replacement library name. Omit to auto-pick a similar move.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_workout_difficulty",
      description:
        "Make the active strength plan harder or easier WITHOUT changing exercises (adjusts sets/reps/rest). Use for 'make it harder', 'make it easier', 'keep the same exercises but harder'.",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["harder", "easier"],
            description: "harder = more sets / lower reps / more rest; easier = opposite.",
          },
          day_number: {
            type: "number",
            description: "Optional 1-based day to adjust; omit to adjust all days.",
          },
        },
        required: ["direction"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_workout_day",
      description:
        "Remove a whole training DAY from the current plan (e.g. 'remove leg day', 'drop day 3', 'no more cardio day'). Does NOT add a replacement day — the plan simply has one day fewer. Use this instead of regenerating.",
      parameters: {
        type: "object",
        properties: {
          day_number: { type: "number", description: "1-based day to remove when they named a number." },
          focus: {
            type: "string",
            description: "Day type to remove when named by focus: legs, push, pull, upper, chest, back, shoulders, arms, core, full body, cardio.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_matching_exercises",
      description:
        "Remove EVERY matching exercise across the plan without replacing them — e.g. 'remove squats' (all squat variations), 'take out anything for shoulders'. Use when they say remove/drop/no more for a movement or muscle and did NOT ask for a substitute.",
      parameters: {
        type: "object",
        properties: {
          exercise_names: {
            type: "array",
            items: { type: "string" },
            description: "Movement names to remove (family-aware: 'squats' removes goblet/split/jump squats too).",
          },
          muscles: { type: "string", description: "Muscle group whose exercises should go, e.g. 'shoulders'." },
          day_number: { type: "number", description: "Optional 1-based day to limit the removal to." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adapt_workout_to_constraints",
      description:
        "Keep the current plan but make it comply with new constraints — e.g. 'make it bodyweight only', 'I only have dumbbells now', 'no shoulders', 'my knee hurts', 'no jumping'. Swaps only the exercises that break the rule (same sets/reps), keeps everything else.",
      parameters: {
        type: "object",
        properties: {
          instructions: { type: "string", description: "The new constraint in the client's words." },
        },
        required: ["instructions"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_nutrition_plan",
      description:
        "Rework the client's current nutrition plan when the change is broad (new meal structure, different calories/macros, lighter dinners, more variety, meal-prep style, a new food rule across the plan). For swapping ONE food use swap_food; for changing ONE portion use change_food_portion.",
      parameters: {
        type: "object",
        properties: {
          instructions: {
            type: "string",
            description: "Clear description of what to change in the nutrition plan.",
          },
        },
        required: ["instructions"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "swap_food",
      description:
        "Swap one food in the current nutrition plan (e.g. 'swap the rice for potatoes', 'no salmon, something else', 'replace eggs'). Keeps everything else; the portion is re-sized to match and meal + day totals are recalculated. Leave `to` empty to let the engine pick the closest allowed whole food.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Food to take out, as the client said it (e.g. 'rice', 'eggs')." },
          to: { type: "string", description: "Replacement food if the client named one; empty = pick the best match." },
          meal: { type: "string", description: "Optional meal (breakfast, lunch, dinner, snack, 'meal 2'); empty = everywhere it appears." },
        },
        required: ["from"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "change_food_portion",
      description:
        "Change the amount of one food in the current nutrition plan ('4 eggs instead of 3', '200g rice', 'double the chicken', 'less oats'). Meal and day totals are recalculated exactly.",
      parameters: {
        type: "object",
        properties: {
          food: { type: "string", description: "The food whose portion changes." },
          amount: { type: "string", description: "New amount: '200g', '4 eggs', '1 cup', or relative: 'double', 'half', 'more', 'less'." },
          meal: { type: "string", description: "Optional meal (breakfast, lunch, dinner, snack, 'meal 2')." },
        },
        required: ["food", "amount"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_today_snapshot",
      description:
        "Show today's macro rings, insight banner, activity stats, and weekly score gauges — same visuals as the AI Coach home tab. Use when they ask how they're doing today, today's macros, or daily progress.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "show_weekly_report",
      description:
        "Generate and display the full weekly coach report with training/nutrition/consistency score gauges, summary, highlights, concerns, and recommendations. Use for weekly report, report card, or week review.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "show_meal_ideas",
      description:
        "Show personalized meal suggestions with macro rings based on remaining calories/macros today. Use when they ask what to eat, meal ideas, or dinner suggestions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "show_weight_trend",
      description:
        "Show weight trend chart, goal progress gauge, weekly change, and projection — same as the AI Coach predictions tab. Use for weight trend, progress prediction, or goal timeline.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "show_coaching_tips",
      description:
        "Show last-7-days stat bars and personalized coaching tip cards — same as the AI Coach recommendations tab. Use for tips, advice based on recent habits, or what to improve.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

export const COACH_CHAT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  ...BASE_COACH_CHAT_TOOLS,
  ...COACH_COMMAND_TOOLS,
];

/** Ask = insights/lists only. Act = mutate plans + log/schedule/delete. */
export type CoachChatMode = "ask" | "act";

export function parseCoachChatMode(value: unknown): CoachChatMode {
  return value === "act" ? "act" : "ask";
}

const ASK_TOOL_NAMES = new Set([
  "get_my_active_plans",
  "show_today_snapshot",
  "show_weekly_report",
  "show_meal_ideas",
  "show_weight_trend",
  "show_coaching_tips",
  "list_my_workouts",
  "list_my_week_plans",
  "list_upcoming_workout_schedule",
  "list_my_nutrition_plans",
  "list_today_habits",
  "list_my_habits",
  "list_today_workouts",
  "list_my_cardio",
  "list_today_cardio",
]);

/** Immediate logging — available in Ask too (same as tapping dashboard buttons). */
export const COACH_SOFT_ACT_TOOL_NAMES = new Set([
  "log_meal",
  "log_weight",
  "log_water",
  "complete_habit",
]);

export function isSoftActTool(name: string): boolean {
  return COACH_SOFT_ACT_TOOL_NAMES.has(name);
}

export function isAskModeTool(name: string): boolean {
  return ASK_TOOL_NAMES.has(name) || isSoftActTool(name);
}

export function getCoachChatToolsForMode(
  mode: CoachChatMode
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  if (mode === "act") return COACH_CHAT_TOOLS;
  return COACH_CHAT_TOOLS.filter(
    (tool) =>
      tool.type === "function" && isAskModeTool(tool.function.name)
  );
}

function aiAccessError(profile: Profile): string {
  return getLimitExceededMessage(parseCheckoutLocale(profile.preferred_locale));
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function defaultWeekdaysForDayCount(dayCount: number): number[] {
  if (dayCount >= 5) return [1, 2, 3, 4, 5];
  if (dayCount >= 4) return [1, 2, 4, 5];
  if (dayCount === 3) return [1, 3, 5];
  if (dayCount === 2) return [1, 4];
  return [1];
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatScheduleWeekdays(weekdays: number[]): string {
  return weekdays
    .map((d) => WEEKDAY_SHORT[d] ?? "?")
    .filter(Boolean)
    .join("/");
}

function buildWorkoutScheduleIntent(
  args: Record<string, unknown>,
  dayCount: number
): ChatPlanScheduleIntent {
  const weeks =
    typeof args.schedule_weeks === "number" && args.schedule_weeks > 0
      ? Math.min(52, Math.max(1, Math.round(args.schedule_weeks)))
      : 4;
  const fromArgs = Array.isArray(args.schedule_weekdays)
    ? args.schedule_weekdays
        .map(Number)
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
    : [];
  return {
    weeks,
    weekdays: fromArgs.length > 0 ? fromArgs : defaultWeekdaysForDayCount(Math.max(1, dayCount)),
  };
}

function scheduleSummaryLine(schedule: ChatPlanScheduleIntent): string {
  return `${formatScheduleWeekdays(schedule.weekdays)} for ${schedule.weeks} week${schedule.weeks === 1 ? "" : "s"}`;
}

export async function executeCoachChatTool(
  name: string,
  argsJson: string,
  profile: Profile,
  onEvent?: (event: CoachChatToolEvent) => void,
  mode: CoachChatMode = "ask",
  /** Latest user message — used to detect plan vs single workout when preferences omit it. */
  userMessage?: string,
  timezoneOffsetMinutes?: number,
  /** User turns + working plan from the thread (constraints persist, edits target what they see). */
  chatContext?: CoachChatContext | null
): Promise<{
  result: string;
  planPreview?: ChatPlanPreview;
  richBlocks?: CoachChatRichBlock[];
  pendingAction?: CoachPendingAction;
  dashboardMutated?: boolean;
  navigate?: string;
}> {
  onEvent?.({ type: "tool_start", name });

  if (mode === "ask" && !isAskModeTool(name)) {
    onEvent?.({ type: "tool_done", name });
    return {
      result:
        "Blocked: Ask mode cannot run this action. Tell the client to switch to Act mode (control next to the paperclip) to schedule, build, delete, or change programs.",
    };
  }

  if (PLAN_TOOLS.has(name) && !hasAiPlanBuilderAccess(profile)) {
    onEvent?.({ type: "tool_done", name });
    return { result: aiAccessError(profile) };
  }

  if (COACH_COMMAND_TOOL_NAMES.has(name)) {
    try {
      const { result, pendingAction, dashboardMutated, navigate } =
        await executeCoachCommandTool(
          name,
          argsJson,
          profile,
          timezoneOffsetMinutes
        );
      if (pendingAction) {
        onEvent?.({ type: "pending_action", action: pendingAction });
      }
      if (navigate) {
        onEvent?.({ type: "navigate", href: navigate });
      }
      onEvent?.({ type: "tool_done", name });
      return { result, pendingAction, dashboardMutated, navigate };
    } catch (error) {
      onEvent?.({ type: "tool_done", name });
      const msg = error instanceof Error ? error.message : "Command failed";
      return { result: `Error: ${msg}` };
    }
  }

  const args = parseToolArgs(argsJson);
  const rawUserMessage = (userMessage ?? "")
    .replace(/\n\n\[Instruction:[\s\S]*$/i, "")
    .trim();
  // A saved plan may exist without a preview in the thread; mutation tools imply one.
  const hasWorkingPlan = NUTRITION_MUTATION_TOOLS.has(name)
    ? Boolean(chatContext?.workingNutrition) || NUTRITION_EDIT_TOOLS.has(name)
    : Boolean(chatContext?.workingWorkout) || WORKOUT_MUTATION_TOOLS.has(name);
  const intent = rawUserMessage
    ? classifyCoachIntent(rawUserMessage, { hasExistingPlan: hasWorkingPlan })
    : null;
  const blocked = guardToolForIntent(name, intent, hasWorkingPlan);
  if (blocked) {
    onEvent?.({ type: "tool_done", name });
    return { result: blocked };
  }

  const emitSurgicalPreview = (
    result: ChatSurgicalResult,
    scheduleArgs: Record<string, unknown>
  ) => {
    if (result.weekly) {
      const schedule = buildWorkoutScheduleIntent(scheduleArgs, result.weekly.days.length);
      const preview: ChatPlanPreview = { type: "weekly_full", program: result.weekly, schedule };
      onEvent?.({ type: "plan_preview", preview });
      onEvent?.({ type: "tool_done", name });
      return {
        result: `${result.summary} Schedule: ${scheduleSummaryLine(schedule)}. Preview ready — Apply saves the updated weekly program.`,
        planPreview: preview,
      };
    }
    const dayCount = result.plan.days.length;
    const schedule = buildWorkoutScheduleIntent(scheduleArgs, dayCount);
    const preview: ChatPlanPreview = {
      type: "workout",
      plan: result.plan,
      schedule,
    };
    onEvent?.({ type: "plan_preview", preview });
    onEvent?.({ type: "tool_done", name });
    return {
      result: `${result.summary} Schedule: ${scheduleSummaryLine(schedule)}. Preview ready — Apply saves changes and schedules. Tell the client the weekdays and that they can change them.`,
      planPreview: preview,
    };
  };

  try {
    switch (name) {
      case "get_my_active_plans": {
        const summary = await summarizeActivePlans(profile.id);
        onEvent?.({ type: "tool_done", name });
        return { result: summary };
      }
      case "generate_workout_plan": {
        const preferences =
          typeof args.preferences === "string" ? args.preferences : undefined;
        const workoutKind =
          args.workout_kind === "hiit" || args.workout_kind === "strength"
            ? args.workout_kind
            : null;
        // Prefer preferences; fall back to the raw user message so "make me a plan"
        // is detected even when the model omits the word from preferences.
        const rawUser = rawUserMessage;
        const shapeText = [preferences, rawUser]
          .filter((s): s is string => Boolean(s?.trim()))
          .join("\n");
        const weekPlan = looksLikeWeekPlanRequest(shapeText);
        const singleSession = looksLikeSingleSessionRequest(shapeText);
        const ambiguous =
          !weekPlan &&
          !singleSession &&
          isAmbiguousWorkoutVsPlanRequest(shapeText);

        if (ambiguous) {
          onEvent?.({ type: "tool_done", name });
          return {
            result:
              "Blocked: request is ambiguous (\"workout\" could mean one session or a full week). Do NOT guess. Ask the client one plain question: one training session for today, or a full week with several training days? Then call generate_workout_plan again after they answer.",
          };
        }

        let daysPerWeek =
          typeof args.days_per_week === "number" && args.days_per_week > 0
            ? Math.min(6, Math.max(1, Math.round(args.days_per_week)))
            : undefined;
        // "3 days a week" in the client's own words beats whatever the model filled in.
        const statedDays = extractCoachConstraints(rawUser).frequency_days;
        if (statedDays != null && weekPlan) {
          daysPerWeek = Math.min(6, Math.max(1, statedDays));
        }

        // Hard rules — never invent a Plans week from profile day count alone.
        // Workout = one session; Plan = only when week/split/"plan" language is clear.
        if (singleSession || !weekPlan) {
          daysPerWeek = 1;
        } else if (daysPerWeek == null || daysPerWeek < 2) {
          daysPerWeek = Math.max(
            2,
            daysPerWeekFromIntake(profile.intake_responses ?? {})
          );
        }

        const includeExtras = singleSession
          ? false
          : !weekPlan
            ? false
            : args.include_warmup_stretch === false
              ? false
              : args.include_warmup_stretch === true || weekPlan;

        // Multi-day weekly program → Plans tab only when week intent is clear.
        if (workoutKind !== "hiit" && weekPlan && (daysPerWeek ?? 0) >= 2) {
          const program = await generateWeeklyFullProgramFromProfile(profile, {
            daysPerWeek: daysPerWeek ?? 4,
            preferences,
            includeExtras,
            conversation: chatContext?.userTurns,
            hasExistingPlan: Boolean(chatContext?.workingWorkout),
          });
          const schedule = buildWorkoutScheduleIntent(args, program.days.length);
          const preview: ChatPlanPreview = {
            type: "weekly_full",
            program,
            schedule,
          };
          onEvent?.({ type: "plan_preview", preview });
          onEvent?.({ type: "tool_done", name });
          const sessionsPerWeek =
            program.days.length * (program.includeExtras ? 3 : 1);
          return {
            result: `Generated weekly program "${program.title}" with ${program.days.length} training days${program.includeExtras ? " (warm-up + main + stretch each)" : ""}. Schedule: ${scheduleSummaryLine(schedule)}. Preview ready — Apply saves under Plans (and single-day workouts under Workouts) and schedules ~${sessionsPerWeek * schedule.weeks} calendar sessions. Tell the client these weekdays were chosen (or used their named days) and they can ask to change them.`,
            planPreview: preview,
          };
        }

        const plan = await generateWorkoutPlanForChat(
          profile,
          preferences,
          workoutKind,
          daysPerWeek ?? (singleSession ? 1 : undefined),
          chatContext
        );
        const reportLine = generationReportLine(plan);
        const dayCount = isAiHiitPlan(plan) ? 1 : plan.days.length;
        const schedule = buildWorkoutScheduleIntent(args, dayCount);
        const preview: ChatPlanPreview = { type: "workout", plan, schedule };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        if (isAiHiitPlan(plan)) {
          return {
            result: `Generated HIIT workout "${plan.title}" (single session). Preview ready — Apply saves under Workouts. They can schedule it later if they want.${reportLine}`,
            planPreview: preview,
          };
        }
        if (dayCount <= 1 || singleSession) {
          const exerciseCount = plan.days[0]?.exercises.length ?? 0;
          return {
            result: `Generated workout "${plan.title}" as a single session (${exerciseCount} exercises in one day). Preview ready — Apply saves under Workouts (not Plans). Do not describe this as a multi-day week.${reportLine}`,
            planPreview: preview,
          };
        }
        return {
          result: `Generated multi-day workout "${plan.title}" with ${plan.days.length} training day(s). Schedule: ${scheduleSummaryLine(schedule)}. Preview ready — Apply saves it. If they wanted a full week template with warm-up/stretch under Plans, regenerate with days_per_week≥2 and include_warmup_stretch=true.${reportLine}`,
          planPreview: preview,
        };
      }
      case "generate_nutrition_plan": {
        const preferences =
          typeof args.preferences === "string" ? args.preferences : undefined;
        const plan = await generateNutritionPlanForChat(profile, preferences, chatContext);
        const schedule: ChatPlanScheduleIntent = {
          weeks:
            typeof args.schedule_weeks === "number" && args.schedule_weeks > 0
              ? Math.min(52, Math.max(1, Math.round(args.schedule_weeks)))
              : 4,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
        };
        const preview: ChatPlanPreview = { type: "nutrition", plan, schedule };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        return {
          result: `Generated nutrition plan "${plan.title}" (${plan.daily_targets.calories} cal). Apply saves it and schedules ${schedule.weeks} week(s) of meals on the calendar.\n${nutritionResultDetails(plan)}`,
          planPreview: preview,
        };
      }
      case "edit_workout_plan": {
        const instructions = String(args.instructions ?? "").trim();
        if (!instructions) {
          onEvent?.({ type: "tool_done", name });
          return { result: "Missing instructions for workout plan edit." };
        }
        const plan = await editWorkoutPlanForChat(profile, instructions, chatContext);
        const dayCount = isAiHiitPlan(plan) ? 1 : plan.days.length;
        const schedule = buildWorkoutScheduleIntent(args, dayCount);
        const preview: ChatPlanPreview = { type: "workout", plan, schedule };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        return {
          result: `Updated workout plan "${plan.title}". Schedule: ${scheduleSummaryLine(schedule)}. Preview ready — Apply saves changes and schedules on the calendar. Tell the client the weekdays and that they can change them.${generationReportLine(plan)}`,
          planPreview: preview,
        };
      }
      case "remove_workout_day": {
        const result = await removeWorkoutDayForChat(
          profile,
          {
            dayNumber: typeof args.day_number === "number" ? args.day_number : undefined,
            focus: typeof args.focus === "string" ? args.focus : undefined,
          },
          chatContext
        );
        return emitSurgicalPreview(result, args);
      }
      case "remove_matching_exercises": {
        const names = Array.isArray(args.exercise_names)
          ? args.exercise_names.filter((n): n is string => typeof n === "string")
          : [];
        const muscles = typeof args.muscles === "string" ? args.muscles : undefined;
        if (!names.length && !muscles?.trim()) {
          onEvent?.({ type: "tool_done", name });
          return { result: "Specify exercise_names or muscles to remove." };
        }
        const result = await removeMatchingExercisesForChat(
          profile,
          {
            exerciseNames: names,
            muscles,
            dayNumber: typeof args.day_number === "number" ? args.day_number : undefined,
          },
          chatContext
        );
        return emitSurgicalPreview(result, args);
      }
      case "adapt_workout_to_constraints": {
        const instructions = String(args.instructions ?? "").trim() || rawUserMessage;
        if (!instructions) {
          onEvent?.({ type: "tool_done", name });
          return { result: "Missing instructions for adapting the plan." };
        }
        const result = await adaptWorkoutToConstraintsForChat(profile, instructions, chatContext);
        return emitSurgicalPreview(result, args);
      }
      case "remove_workout_exercise": {
        const result = await removeWorkoutExerciseForChat(profile, {
          dayNumber:
            typeof args.day_number === "number" ? args.day_number : undefined,
          exerciseNumber:
            typeof args.exercise_number === "number"
              ? args.exercise_number
              : undefined,
          exerciseName:
            typeof args.exercise_name === "string"
              ? args.exercise_name
              : undefined,
        }, chatContext);
        return emitSurgicalPreview(result, args);
      }
      case "add_workout_exercise": {
        const result = await addWorkoutExerciseForChat(profile, {
          dayNumber:
            typeof args.day_number === "number" ? args.day_number : undefined,
          exerciseName:
            typeof args.exercise_name === "string"
              ? args.exercise_name
              : undefined,
          targetMuscle:
            typeof args.target_muscle === "string"
              ? args.target_muscle
              : undefined,
          sets: typeof args.sets === "number" ? args.sets : undefined,
          reps: typeof args.reps === "string" ? args.reps : undefined,
          restSeconds:
            typeof args.rest_seconds === "number"
              ? args.rest_seconds
              : undefined,
        }, chatContext);
        return emitSurgicalPreview(result, args);
      }
      case "replace_workout_exercise": {
        const result = await replaceWorkoutExerciseForChat(profile, {
          dayNumber:
            typeof args.day_number === "number" ? args.day_number : undefined,
          exerciseNumber:
            typeof args.exercise_number === "number"
              ? args.exercise_number
              : undefined,
          exerciseName:
            typeof args.exercise_name === "string"
              ? args.exercise_name
              : undefined,
          replacementName:
            typeof args.replacement_name === "string"
              ? args.replacement_name
              : undefined,
        }, chatContext);
        return emitSurgicalPreview(result, args);
      }
      case "adjust_workout_difficulty": {
        const direction =
          args.direction === "easier" || args.direction === "harder"
            ? args.direction
            : null;
        if (!direction) {
          onEvent?.({ type: "tool_done", name });
          return {
            result: "direction must be 'harder' or 'easier'.",
          };
        }
        const result = await adjustWorkoutDifficultyForChat(
          profile,
          direction,
          typeof args.day_number === "number" ? args.day_number : undefined,
          chatContext
        );
        return emitSurgicalPreview(result, args);
      }
      case "edit_nutrition_plan": {
        const instructions = String(args.instructions ?? "").trim();
        if (!instructions) {
          onEvent?.({ type: "tool_done", name });
          return { result: "Missing instructions for nutrition plan edit." };
        }
        const plan = await editNutritionPlanForChat(profile, instructions, chatContext);
        const preview: ChatPlanPreview = {
          type: "nutrition",
          plan,
          schedule: { weeks: 4, weekdays: [0, 1, 2, 3, 4, 5, 6] },
        };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        return {
          result: `Updated nutrition plan "${plan.title}". Apply saves and schedules 4 weeks on the calendar.\n${nutritionResultDetails(plan)}`,
          planPreview: preview,
        };
      }
      case "swap_food":
      case "change_food_portion": {
        const meal = typeof args.meal === "string" ? args.meal : null;
        const edit =
          name === "swap_food"
            ? await swapFoodForChat(
                profile,
                { from: String(args.from ?? ""), to: typeof args.to === "string" ? args.to : null, meal },
                chatContext
              )
            : await changeFoodPortionForChat(
                profile,
                { food: String(args.food ?? ""), amount: String(args.amount ?? ""), meal },
                chatContext
              );
        const preview: ChatPlanPreview = {
          type: "nutrition",
          plan: edit.plan,
          schedule: { weeks: 4, weekdays: [0, 1, 2, 3, 4, 5, 6] },
        };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        return {
          result: `${edit.summary} Preview ready — Apply saves the updated plan. Tell the client exactly what changed and the new day totals; don't say macros "may change".\n${edit.planText}`,
          planPreview: preview,
        };
      }
      case "show_today_snapshot": {
        const blocks = await buildTodaySnapshotBlocks(profile.id, profile);
        onEvent?.({ type: "rich_blocks", blocks });
        onEvent?.({ type: "tool_done", name });
        return {
          result:
            "Today's snapshot is displayed in chat with macro rings, insight, and activity stats. Keep your reply short — the visuals show the details.",
          richBlocks: blocks,
        };
      }
      case "show_weekly_report": {
        const blocks = await buildWeeklyReportBlocks(profile.id);
        onEvent?.({ type: "rich_blocks", blocks });
        onEvent?.({ type: "tool_done", name });
        return {
          result:
            "Weekly report card is displayed in chat with score gauges and coaching tips. Summarize briefly in your voice — the card has the full breakdown.",
          richBlocks: blocks,
        };
      }
      case "show_meal_ideas": {
        const blocks = await buildMealIdeasBlocks(profile.id);
        onEvent?.({ type: "rich_blocks", blocks });
        onEvent?.({ type: "tool_done", name });
        return {
          result:
            "Meal ideas with macro rings are shown in chat. Mention 1–2 favorites briefly — the cards list all suggestions.",
          richBlocks: blocks,
        };
      }
      case "show_weight_trend": {
        const blocks = await buildWeightTrendBlocks(profile.id, profile);
        onEvent?.({ type: "rich_blocks", blocks });
        onEvent?.({ type: "tool_done", name });
        return {
          result:
            "Weight trend and projection are displayed in chat. Interpret the trend briefly — the chart and gauges show the data.",
          richBlocks: blocks,
        };
      }
      case "show_coaching_tips": {
        const blocks = await buildCoachingTipsBlocks(profile.id, profile);
        onEvent?.({ type: "rich_blocks", blocks });
        onEvent?.({ type: "tool_done", name });
        return {
          result:
            "Coaching tips and stat bars are shown in chat. Reinforce the top tip in your voice — the cards have the details.",
          richBlocks: blocks,
        };
      }
      default:
        onEvent?.({ type: "tool_done", name });
        return { result: `Unknown tool: ${name}` };
    }
  } catch (error) {
    onEvent?.({ type: "tool_done", name });
    if (error instanceof WorkoutRequirementConflictError) {
      return { result: formatConflictToolResult(error) };
    }
    if (error instanceof SurgicalEditError || error instanceof NutritionEditError) {
      return { result: error.message };
    }
    const msg = error instanceof Error ? error.message : "Tool execution failed";
    return { result: `Error: ${msg}` };
  }
}
