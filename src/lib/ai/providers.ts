import OpenAI from "openai";
import type { AiProvider, ChatImageAttachment, ChatTurn } from "@/lib/ai/types";
import { formatUserError } from "@/lib/format-user-error";

/**
 * Routing tier for cost vs quality (OpenAI only):
 * - cheap: OPENAI_MEAL_MODEL (chat, meals, short tasks)
 * - quality: OPENAI_QUALITY_MODEL (plans, reports)
 */
export type AiRouteTier = "cheap" | "quality";

type PromptOptions = {
  maxTokens?: number;
  json?: boolean;
  /** Defaults to cheap for text/chat; quality for long plan/report jobs. */
  tier?: AiRouteTier;
};

const NOT_CONFIGURED = "AI is not configured. Add OPENAI_API_KEY.";

function openaiTextModel(tier: AiRouteTier): string {
  if (tier === "quality") return process.env.OPENAI_QUALITY_MODEL ?? "gpt-4.1-mini";
  return process.env.OPENAI_MEAL_MODEL ?? "gpt-4o-mini";
}

function getTurnImages(message: ChatTurn): ChatImageAttachment[] {
  if (message.images?.length) return message.images;
  if (message.image) return [message.image];
  return [];
}

function toOpenAIMessage(message: ChatTurn): OpenAI.Chat.ChatCompletionMessageParam {
  const images = getTurnImages(message);
  if (message.role === "system" || message.role === "assistant" || images.length === 0) {
    return { role: message.role, content: message.content };
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

export function getConfiguredProviders(): AiProvider[] {
  return process.env.OPENAI_API_KEY ? ["openai"] : [];
}

export function isAiConfigured(): boolean {
  return getConfiguredProviders().length > 0;
}

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function requireOpenAIClient(): OpenAI {
  if (!isAiConfigured()) throw new Error(NOT_CONFIGURED);
  return getOpenAIClient();
}

export async function runTextPrompt(
  prompt: string,
  options?: PromptOptions
): Promise<string> {
  const client = requireOpenAIClient();
  try {
    const response = await client.chat.completions.create({
      model: openaiTextModel(options?.tier ?? "cheap"),
      messages: [{ role: "user", content: prompt }],
      max_tokens: options?.maxTokens ?? 1200,
      ...(options?.json ? { response_format: { type: "json_object" } } : {}),
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response");
    return content;
  } catch (error) {
    throw new Error(formatUserError(error, "AI request failed"));
  }
}

export async function runChatCompletion(
  messages: ChatTurn[],
  options?: { maxTokens?: number; tier?: AiRouteTier }
): Promise<string> {
  const client = requireOpenAIClient();
  try {
    const response = await client.chat.completions.create({
      model: openaiTextModel(options?.tier ?? "cheap"),
      messages: messages.map(toOpenAIMessage),
      max_tokens: options?.maxTokens ?? 900,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response");
    return content;
  } catch (error) {
    throw new Error(formatUserError(error, "AI chat request failed"));
  }
}

export async function* streamChatCompletion(
  messages: ChatTurn[],
  options?: { maxTokens?: number; signal?: AbortSignal; tier?: AiRouteTier }
): AsyncGenerator<string> {
  const client = requireOpenAIClient();
  try {
    const stream = await client.chat.completions.create(
      {
        model: openaiTextModel(options?.tier ?? "cheap"),
        messages: messages.map(toOpenAIMessage),
        max_tokens: options?.maxTokens ?? 900,
        stream: true,
      },
      { signal: options?.signal }
    );

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  } catch (error) {
    if (options?.signal?.aborted) return;
    throw new Error(formatUserError(error, "AI chat stream failed"));
  }
}

export async function runVisionPrompt(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  options?: { maxTokens?: number; imageDetail?: "low" | "high" | "auto" }
): Promise<string> {
  const client = requireOpenAIClient();
  // Vision needs a stronger model than text — mini often mislabels chicken as fish.
  // Do not fall back to OPENAI_MEAL_MODEL (often mini); override only via OPENAI_VISION_MODEL.
  const visionModel = process.env.OPENAI_VISION_MODEL ?? "gpt-4o";

  try {
    const response = await client.chat.completions.create({
      model: visionModel,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: options?.imageDetail ?? "auto",
              },
            },
          ],
        },
      ],
      max_tokens: options?.maxTokens ?? 900,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response");
    return content;
  } catch (error) {
    throw new Error(formatUserError(error, "AI vision request failed"));
  }
}
