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

function getTurnImages(message: ChatTurn) {
  if (message.images?.length) return message.images;
  if (message.image) return [message.image];
  return [];
}

function toOpenAIMessage(message: ChatTurn): OpenAI.Chat.ChatCompletionMessageParam {
  if (message.role === "system" || message.role === "assistant") {
    return { role: message.role, content: message.content };
  }
  const images = getTurnImages(message);
  if (images.length === 0) {
    return { role: "user", content: message.content };
  }
  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
  if (message.content.trim()) {
    parts.push({ type: "text", text: message.content });
  }
  for (const img of images) {
    parts.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    });
  }
  return { role: "user", content: parts };
}

export function canUseCoachChatTools(messages: ChatTurn[]): boolean {
  return !messages.some(
    (m) => m.role === "user" && (m.image || (m.images?.length ?? 0) > 0)
  );
}

type ToolCallAcc = {
  id: string;
  name: string;
  arguments: string;
};

export async function runCoachChatWithTools(
  messages: ChatTurn[],
  profile: Profile,
  onEvent?: (event: CoachChatToolEvent) => void,
  options?: {
    maxTokens?: number;
    signal?: AbortSignal;
    /** Fired for final-answer tokens (not for tool-call rounds). */
    onToken?: (text: string) => void;
  }
): Promise<{ reply: string; planPreview?: ChatPlanPreview; richBlocks?: CoachChatRichBlock[] }> {
  const client = getOpenAIClient();
  const conversation = messages.map(toOpenAIMessage);
  let planPreview: ChatPlanPreview | undefined;
  const richBlocks: CoachChatRichBlock[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (options?.signal?.aborted) {
      throw new Error("Request aborted");
    }

    const stream = await client.chat.completions.create(
      {
        model: process.env.OPENAI_MEAL_MODEL ?? "gpt-4o-mini",
        messages: conversation,
        tools: COACH_CHAT_TOOLS,
        tool_choice: "auto",
        max_tokens: options?.maxTokens ?? 900,
        stream: true,
      },
      { signal: options?.signal }
    );

    let content = "";
    const toolAcc = new Map<number, ToolCallAcc>();

    for await (const chunk of stream) {
      if (options?.signal?.aborted) {
        throw new Error("Request aborted");
      }
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.tool_calls) {
        for (const part of delta.tool_calls) {
          const index = part.index ?? 0;
          const current = toolAcc.get(index) ?? { id: "", name: "", arguments: "" };
          if (part.id) current.id = part.id;
          if (part.function?.name) current.name += part.function.name;
          if (part.function?.arguments) current.arguments += part.function.arguments;
          toolAcc.set(index, current);
        }
      }

      if (delta.content) {
        content += delta.content;
        // Stream live while this still looks like a text answer (no tool calls yet).
        if (toolAcc.size === 0) {
          options?.onToken?.(delta.content);
        }
      }
    }

    const toolCalls = [...toolAcc.values()].filter((t) => t.id && t.name);

    if (toolCalls.length > 0) {
      conversation.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls.map((t) => ({
          id: t.id,
          type: "function" as const,
          function: { name: t.name, arguments: t.arguments },
        })),
      });

      for (const toolCall of toolCalls) {
        const { result, planPreview: preview, richBlocks: blocks } = await executeCoachChatTool(
          toolCall.name,
          toolCall.arguments,
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

    // Final text answer — tokens already streamed live when toolAcc stayed empty.
    const text = content.trim();
    if (!text && !planPreview && richBlocks.length === 0) {
      throw new Error("OpenAI returned an empty response");
    }

    const reply =
      text ||
      (planPreview
        ? "Your plan preview is ready — tap Apply to save it to your program."
        : "Here's your coach dashboard — check the cards above.");

    // Fallback copy was not streamed token-by-token — emit once for the client.
    if (!text && options?.onToken) {
      options.onToken(reply);
    }

    return {
      reply,
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
