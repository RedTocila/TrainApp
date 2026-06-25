import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AiProvider, ChatTurn } from "@/lib/ai/types";

export function getConfiguredProviders(): AiProvider[] {
  const preferred = (process.env.AI_MEAL_PROVIDER ?? "openai") as AiProvider;
  const other: AiProvider = preferred === "openai" ? "anthropic" : "openai";
  const providers: AiProvider[] = [];

  if (preferred === "openai" && process.env.OPENAI_API_KEY) providers.push("openai");
  if (preferred === "anthropic" && process.env.ANTHROPIC_API_KEY) providers.push("anthropic");
  if (other === "openai" && process.env.OPENAI_API_KEY) providers.push("openai");
  if (other === "anthropic" && process.env.ANTHROPIC_API_KEY) providers.push("anthropic");

  return [...new Set(providers)];
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

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function runTextPrompt(
  prompt: string,
  options?: { maxTokens?: number; json?: boolean }
): Promise<string> {
  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    throw new Error("AI is not configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY.");
  }

  let lastError: Error | null = null;
  for (const provider of providers) {
    try {
      if (provider === "openai") {
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
          model: process.env.OPENAI_MEAL_MODEL ?? "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: options?.maxTokens ?? 1200,
          ...(options?.json ? { response_format: { type: "json_object" } } : {}),
        });
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("OpenAI returned an empty response");
        return content;
      }

      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MEAL_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: options?.maxTokens ?? 1200,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Anthropic returned an empty response");
      }
      return textBlock.text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("AI request failed");
}

export async function runChatCompletion(
  messages: ChatTurn[],
  options?: { maxTokens?: number }
): Promise<string> {
  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    throw new Error("AI is not configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY.");
  }

  const systemMessage = messages.find((message) => message.role === "system")?.content;
  const conversation = messages.filter((message) => message.role !== "system");

  let lastError: Error | null = null;
  for (const provider of providers) {
    try {
      if (provider === "openai") {
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
          model: process.env.OPENAI_MEAL_MODEL ?? "gpt-4o-mini",
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          max_tokens: options?.maxTokens ?? 900,
        });
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("OpenAI returned an empty response");
        return content;
      }

      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MEAL_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: options?.maxTokens ?? 900,
        ...(systemMessage ? { system: systemMessage } : {}),
        messages: conversation.map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
      });
      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Anthropic returned an empty response");
      }
      return textBlock.text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("AI chat request failed");
}

export async function runVisionPrompt(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    throw new Error("AI is not configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY.");
  }

  let lastError: Error | null = null;
  for (const provider of providers) {
    try {
      if (provider === "openai") {
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
          model: process.env.OPENAI_MEAL_MODEL ?? "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${imageBase64}` },
                },
              ],
            },
          ],
          max_tokens: 900,
        });
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("OpenAI returned an empty response");
        return content;
      }

      const client = getAnthropicClient();
      const mediaType = mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MEAL_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 900,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });
      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Anthropic returned an empty response");
      }
      return textBlock.text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("AI vision request failed");
}
