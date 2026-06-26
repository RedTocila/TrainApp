import {
  buildCoachingTipsBlocks,
  buildMealIdeasBlocks,
  buildTodaySnapshotBlocks,
  buildWeeklyReportBlocks,
  buildWeightTrendBlocks,
} from "@/lib/ai/coach-chat-block-builders";
import type { CoachChatRichBlock } from "@/lib/ai/coach-chat-block-types";
import {
  editNutritionPlanForChat,
  editWorkoutPlanForChat,
  generateNutritionPlanForChat,
  generateWorkoutPlanForChat,
  summarizeActivePlans,
} from "@/lib/ai/coach-chat-plans";
import type {
  AiGeneratedNutritionPlan,
  AiGeneratedWorkoutPlan,
} from "@/lib/ai/plan-builder-types";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { hasAiAccess } from "@/lib/subscription";
import type { Profile } from "@/lib/types";
import type OpenAI from "openai";

export type ChatPlanPreview =
  | { type: "workout"; plan: AiGeneratedWorkoutPlan }
  | { type: "nutrition"; plan: AiGeneratedNutritionPlan };

export type CoachChatToolEvent =
  | { type: "tool_start"; name: string }
  | { type: "tool_done"; name: string }
  | { type: "plan_preview"; preview: ChatPlanPreview }
  | { type: "rich_blocks"; blocks: CoachChatRichBlock[] };

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
};

export const COACH_CHAT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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
        "Generate a new personalized weekly workout plan. Use when they want a new program, training split, or to replace their workouts.",
      parameters: {
        type: "object",
        properties: {
          preferences: {
            type: "string",
            description: "Optional extra instructions (equipment, days per week, focus areas).",
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
        "Modify the client's current active workout plan based on their instructions (swap exercises, add a day, reduce volume, etc.).",
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

function aiAccessError(): string {
  return `Plan building in chat requires ${PLATFORM_AI_NAME}. Upgrade your subscription to use this feature.`;
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function executeCoachChatTool(
  name: string,
  argsJson: string,
  profile: Profile,
  onEvent?: (event: CoachChatToolEvent) => void
): Promise<{ result: string; planPreview?: ChatPlanPreview; richBlocks?: CoachChatRichBlock[] }> {
  onEvent?.({ type: "tool_start", name });

  if (PLAN_TOOLS.has(name) && !hasAiAccess(profile)) {
    onEvent?.({ type: "tool_done", name });
    return { result: aiAccessError() };
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
        const plan = await generateWorkoutPlanForChat(profile, preferences);
        const preview: ChatPlanPreview = { type: "workout", plan };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        return {
          result: `Generated workout plan "${plan.title}" with ${plan.days.length} training day(s). A preview card is shown in chat — the client must tap Apply to save it.`,
          planPreview: preview,
        };
      }
      case "generate_nutrition_plan": {
        const preferences =
          typeof args.preferences === "string" ? args.preferences : undefined;
        const plan = await generateNutritionPlanForChat(profile, preferences);
        const preview: ChatPlanPreview = { type: "nutrition", plan };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        return {
          result: `Generated nutrition plan "${plan.title}" (${plan.daily_targets.calories} cal). A preview card is shown in chat — the client must tap Apply to save it.`,
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
        const preview: ChatPlanPreview = { type: "workout", plan };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        return {
          result: `Updated workout plan "${plan.title}". Preview ready — client must Apply to save changes.`,
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
        const preview: ChatPlanPreview = { type: "nutrition", plan };
        onEvent?.({ type: "plan_preview", preview });
        onEvent?.({ type: "tool_done", name });
        return {
          result: `Updated nutrition plan "${plan.title}". Preview ready — client must Apply to save changes.`,
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
