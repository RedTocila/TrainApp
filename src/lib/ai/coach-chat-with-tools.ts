import {
  COACH_CHAT_TOOLS,
  executeCoachChatTool,
  type ChatPlanPreview,
  type CoachChatToolEvent,
} from "@/lib/ai/coach-chat-tools";
import type { CoachChatRichBlock } from "@/lib/ai/coach-chat-block-types";
import { getOpenAIClient } from "@/lib/ai/providers";
import type { ChatTurn } from "@/lib/ai/types";
import type { Profile } from "@/lib/types";
import type OpenAI from "openai";

const MAX_TOOL_ROUNDS = 5;

function toOpenAIMessage(message: ChatTurn): OpenAI.Chat.ChatCompletionMessageParam {
  if (message.role === "system" || message.role === "assistant") {
    return { role: message.role, content: message.content };
  }
  if (!message.image) {
    return { role: "user", content: message.content };
  }
  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
  if (message.content.trim()) {
    parts.push({ type: "text", text: message.content });
  }
  parts.push({
    type: "image_url",
    image_url: {
      url: `data:${message.image.mimeType};base64,${message.image.base64}`,
    },
  });
  return { role: "user", content: parts };
}

export function canUseCoachChatTools(messages: ChatTurn[]): boolean {
  return !messages.some((m) => m.role === "user" && m.image);
}

export async function runCoachChatWithTools(
  messages: ChatTurn[],
  profile: Profile,
  onEvent?: (event: CoachChatToolEvent) => void,
  options?: { maxTokens?: number; signal?: AbortSignal }
): Promise<{ reply: string; planPreview?: ChatPlanPreview; richBlocks?: CoachChatRichBlock[] }> {
  const client = getOpenAIClient();
  const conversation = messages.map(toOpenAIMessage);
  let planPreview: ChatPlanPreview | undefined;
  const richBlocks: CoachChatRichBlock[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (options?.signal?.aborted) {
      throw new Error("Request aborted");
    }

    const response = await client.chat.completions.create(
      {
        model: process.env.OPENAI_MEAL_MODEL ?? "gpt-4o-mini",
        messages: conversation,
        tools: COACH_CHAT_TOOLS,
        tool_choice: "auto",
        max_tokens: options?.maxTokens ?? 900,
      },
      { signal: options?.signal }
    );

    const choice = response.choices[0]?.message;
    if (!choice) {
      throw new Error("OpenAI returned an empty response");
    }

    if (choice.tool_calls?.length) {
      conversation.push({
        role: "assistant",
        content: choice.content ?? "",
        tool_calls: choice.tool_calls,
      });

      for (const toolCall of choice.tool_calls) {
        if (toolCall.type !== "function") continue;
        const { result, planPreview: preview, richBlocks: blocks } = await executeCoachChatTool(
          toolCall.function.name,
          toolCall.function.arguments,
          profile,
          onEvent
        );
        if (preview) planPreview = preview;
        if (blocks?.length) richBlocks.push(...blocks);

        conversation.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      continue;
    }

    const text = choice.content?.trim() ?? "";
    if (!text && !planPreview && richBlocks.length === 0) {
      throw new Error("OpenAI returned an empty response");
    }

    return {
      reply:
        text ||
        (planPreview
          ? "Your plan preview is ready — tap Apply to save it to your program."
          : "Here's your coach dashboard — check the cards above."),
      planPreview,
      richBlocks: richBlocks.length > 0 ? richBlocks : undefined,
    };
  }

  return {
    reply: "I hit the tool limit — try a simpler request or apply the preview above.",
    planPreview,
    richBlocks: richBlocks.length > 0 ? richBlocks : undefined,
  };
}
