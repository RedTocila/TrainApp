import {
  ADMIN_CHAT_TOOLS,
  executeAdminChatTool,
  type AdminChatToolEvent,
} from "@/lib/ai/admin-chat-tools";
import { getOpenAIClient } from "@/lib/ai/providers";
import type { ChatTurn } from "@/lib/ai/types";
import type OpenAI from "openai";

const MAX_TOOL_ROUNDS = 6;

function toOpenAIMessage(message: ChatTurn): OpenAI.Chat.ChatCompletionMessageParam {
  if (message.role === "system" || message.role === "assistant") {
    return { role: message.role, content: message.content };
  }
  return { role: "user", content: message.content };
}

type ToolCallAcc = {
  id: string;
  name: string;
  arguments: string;
};

export async function runAdminChatWithTools(
  messages: ChatTurn[],
  onEvent?: (event: AdminChatToolEvent) => void,
  options?: {
    maxTokens?: number;
    signal?: AbortSignal;
    onToken?: (text: string) => void;
  }
): Promise<{ reply: string }> {
  const client = getOpenAIClient();
  const conversation = messages.map(toOpenAIMessage);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (options?.signal?.aborted) {
      throw new Error("Request aborted");
    }

    const stream = await client.chat.completions.create(
      {
        model: process.env.OPENAI_MEAL_MODEL ?? "gpt-4o-mini",
        messages: conversation,
        tools: ADMIN_CHAT_TOOLS,
        tool_choice: "auto",
        max_tokens: options?.maxTokens ?? 1100,
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
        const result = await executeAdminChatTool(
          toolCall.name,
          toolCall.arguments,
          onEvent
        );
        conversation.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      continue;
    }

    const text = content.trim();
    if (!text) {
      throw new Error("OpenAI returned an empty response");
    }
    return { reply: text };
  }

  return {
    reply: "I hit the tool round limit — try a simpler request or confirm one action at a time.",
  };
}
