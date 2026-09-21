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
} from "@/lib/ai/coach-chat-plans";
import type {
  AiGeneratedNutritionPlan,
  AiWorkoutPlanResult,
} from "@/lib/ai/plan-builder-types";
import { isAiHiitPlan } from "@/lib/ai/plan-builder-types";
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
    };

export type CoachChatToolEvent =
  | { type: "tool_start"; name: string }
  | { type: "tool_done"; name: string }
  | { type: "plan_preview"; preview: ChatPlanPreview }
  | { type: "rich_blocks"; blocks: CoachChatRichBlock[] }
  | { type: "pending_action"; action: CoachPendingAction };

const PLAN_TOOLS = new Set([
  "generate_workout_plan",
  "generate_nutrition_plan",
  "edit_workout_plan",
  "edit_nutrition_plan",
]);

export const TOOL_STATUS_LABELS: Record<string, string> = {
  get_my_active_plans: "Loading your programs…",
  generate_workout_plan: "Building workout plan…",
  generate_nutrition_plan: "Building nutrition plan…",
  edit_workout_plan: "Updating workout plan…",
  edit_nutrition_plan: "Updating nutrition plan…",
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
        "Generate a new personalized workout program with multiple training days AND attach calendar schedule settings. Use when they want a new plan or an N-day split for W weeks. Set days_per_week, schedule_weeks, and schedule_weekdays. Apply on the preview saves + schedules — no second step.",
      parameters: {
        type: "object",
        properties: {
          preferences: {
            type: "string",
            description:
              "Extra instructions (equipment, focus areas, split style, which weekdays). Mention the exact training days if they named them.",
          },
          days_per_week: {
            type: "number",
            description:
              "Exact number of distinct training days in the plan (1–6). Required when they ask for a multi-day week (e.g. 4 for Mon/Tue/Thu/Fri). Do not leave this at 1 if they want multiple training days.",
          },
          schedule_weeks: {
            type: "number",
            description:
              "How many weeks to put on the calendar when they Apply (1–52). Default 4. Always set this when they ask for a multi-week schedule.",
          },
          schedule_weekdays: {
            type: "array",
            items: { type: "number" },
            description:
              "JS weekdays Sun=0…Sat=6 to schedule on Apply. Mon/Tue/Thu/Fri = [1,2,4,5]. Must match days_per_week length when they named specific days.",
          },
          workout_kind: {
            type: "string",
            enum: ["strength", "hiit"],
            description:
              "strength = classic sets/reps weekly plan; hiit = timed interval session with work/rest/rounds.",
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
        "Modify the client's current active workout plan (swap exercises, reduce volume, etc.). To turn a 1-day plan into a multi-day split for scheduling, prefer generate_workout_plan with days_per_week instead.",
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
      name: "edit_nutrition_plan",
      description:
        "Modify the client's current active nutrition plan (change meals, macros, swap foods, lighter dinners, etc.).",
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
  "list_my_nutrition_plans",
]);

export function isAskModeTool(name: string): boolean {
  return ASK_TOOL_NAMES.has(name);
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

export async function executeCoachChatTool(
  name: string,
  argsJson: string,
  profile: Profile,
  onEvent?: (event: CoachChatToolEvent) => void,
  mode: CoachChatMode = "ask"
): Promise<{
  result: string;
  planPreview?: ChatPlanPreview;
  richBlocks?: CoachChatRichBlock[];
  pendingAction?: CoachPendingAction;
}> {
  onEvent?.({ type: "tool_start", name });

  if (mode === "ask" && !isAskModeTool(name)) {
    onEvent?.({ type: "tool_done", name });
    return {
      result:
        "Blocked: Ask mode is read-only. Tell the client to switch to Act mode (control next to the paperclip) to log, schedule, build, or delete.",
    };
  }

  if (PLAN_TOOLS.has(name) && !hasAiPlanBuilderAccess(profile)) {
    onEvent?.({ type: "tool_done", name });
    return { result: aiAccessError(profile) };
  }

  if (COACH_COMMAND_TOOL_NAMES.has(name)) {
    try {
      const { result, pendingAction } = await executeCoachCommandTool(
        name,
        argsJson,
        profile
      );
      if (pendingAction) {
        onEvent?.({ type: "pending_action", action: pendingAction });
      }
      onEvent?.({ type: "tool_done", name });
      return { result, pendingAction };
    } catch (error) {
      onEvent?.({ type: "tool_done", name });
      const msg = error instanceof Error ? error.message : "Command failed";
      return { result: `Error: ${msg}` };
    }
  }

  const args = parseToolArgs(argsJson);

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
        const daysPerWeek =
          typeof args.days_per_week === "number" && args.days_per_week > 0
            ? Math.min(6, Math.max(1, Math.round(args.days_per_week)))
            : undefined;
        const plan = await generateWorkoutPlanForChat(
          profile,
          preferences,
          workoutKind,
          daysPerWeek
        );
        const dayCount = isAiHiitPlan(plan) ? 1 : plan.days.length;
        const schedule = buildWorkoutScheduleIntent(args, dayCount);
        const preview: ChatPlanPreview = { type: "workout", plan, schedule };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        if (isAiHiitPlan(plan)) {
          return {
            result: `Generated HIIT workout "${plan.title}". Preview ready — Apply saves it and schedules ${schedule.weeks} week(s) on the calendar.`,
            planPreview: preview,
          };
        }
        return {
          result: `Generated workout plan "${plan.title}" with ${plan.days.length} training day(s). Preview ready — when they tap Apply it SAVES the program AND schedules ~${schedule.weekdays.length * schedule.weeks} sessions (${schedule.weeks} weeks). Do not ask them to schedule separately.`,
          planPreview: preview,
        };
      }
      case "generate_nutrition_plan": {
        const preferences =
          typeof args.preferences === "string" ? args.preferences : undefined;
        const plan = await generateNutritionPlanForChat(profile, preferences);
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
          result: `Generated nutrition plan "${plan.title}" (${plan.daily_targets.calories} cal). Apply saves it and schedules ${schedule.weeks} week(s) of meals on the calendar.`,
          planPreview: preview,
        };
      }
      case "edit_workout_plan": {
        const instructions = String(args.instructions ?? "").trim();
        if (!instructions) {
          onEvent?.({ type: "tool_done", name });
          return { result: "Missing instructions for workout plan edit." };
        }
        const plan = await editWorkoutPlanForChat(profile, instructions);
        const dayCount = isAiHiitPlan(plan) ? 1 : plan.days.length;
        const schedule = buildWorkoutScheduleIntent(args, dayCount);
        const preview: ChatPlanPreview = { type: "workout", plan, schedule };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        return {
          result: `Updated workout plan "${plan.title}". Apply saves changes and schedules ${schedule.weeks} week(s) on the calendar.`,
          planPreview: preview,
        };
      }
      case "edit_nutrition_plan": {
        const instructions = String(args.instructions ?? "").trim();
        if (!instructions) {
          onEvent?.({ type: "tool_done", name });
          return { result: "Missing instructions for nutrition plan edit." };
        }
        const plan = await editNutritionPlanForChat(profile, instructions);
        const preview: ChatPlanPreview = {
          type: "nutrition",
          plan,
          schedule: { weeks: 4, weekdays: [0, 1, 2, 3, 4, 5, 6] },
        };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        return {
          result: `Updated nutrition plan "${plan.title}". Apply saves and schedules 4 weeks on the calendar.`,
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
    const msg = error instanceof Error ? error.message : "Tool execution failed";
    return { result: `Error: ${msg}` };
  }
}
