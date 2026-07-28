import { prepareFitnessCoachChatWithSearch } from "@/lib/ai/fitness-chat";
import { validateChatImage } from "@/lib/ai/chat-image";
import {
  canUseCoachChatTools,
  runCoachChatWithTools,
} from "@/lib/ai/coach-chat-with-tools";
import { TOOL_STATUS_LABELS } from "@/lib/ai/coach-chat-tools";
import { maybeNaturalizeCoachReply } from "@/lib/ai/albanian-naturalize";
import { streamChatCompletion, getConfiguredProviders } from "@/lib/ai/providers";
import {
  checkAlexCommandAllowed,
  consumeAlexCommand,
} from "@/lib/actions/usage-limits";
import { SUBSCRIPTION_ACCESS_COLUMNS } from "@/lib/db-selects";
import { createClient } from "@/lib/supabase/server";
import type { ChatImageAttachment, ChatMessage } from "@/lib/ai/types";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";

function chunkText(text: string, size = 24): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

async function collectStreamedText(
  messages: Parameters<typeof streamChatCompletion>[0],
  options: { maxTokens?: number; signal?: AbortSignal }
): Promise<string> {
  let full = "";
  for await (const chunk of streamChatCompletion(messages, options)) {
    full += chunk;
  }
  return full;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(`${SUBSCRIPTION_ACCESS_COLUMNS}, preferred_locale`)
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const alexAccess = await checkAlexCommandAllowed(profile as Profile);
  if (!alexAccess.allowed) {
    return Response.json({ error: alexAccess.error }, { status: 403 });
  }

  let body: {
    message?: string;
    history?: ChatMessage[];
    image?: ChatImageAttachment | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message = body.message ?? "";
  const history = Array.isArray(body.history) ? body.history : [];
  const imageInput = body.image ?? null;
  const validatedImage = imageInput ? validateChatImage(imageInput) : null;
  if (validatedImage && "error" in validatedImage) {
    return Response.json({ error: validatedImage.error }, { status: 400 });
  }
  const image = validatedImage && "image" in validatedImage ? validatedImage.image : null;
  const preferredLocale = (profile as Profile).preferred_locale;

  const prepared = await prepareFitnessCoachChatWithSearch(
    user.id,
    message,
    history,
    preferredLocale,
    image
  );
  if ("error" in prepared) {
    return Response.json({ error: prepared.error }, { status: 400 });
  }

  const { messages: chatMessages, sources, searchedWeb } = prepared;
  const useTools =
    canUseCoachChatTools(chatMessages) && getConfiguredProviders().includes("openai");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        enqueue({ meta: { searchedWeb } });

        let reply = "";

        if (useTools) {
          const fullProfile = profile as Profile;
          const { data: full } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          const profileForTools = (full ?? profile) as Profile;

          const result = await runCoachChatWithTools(
            chatMessages,
            profileForTools,
            (event) => {
              if (event.type === "tool_start") {
                const label =
                  TOOL_STATUS_LABELS[event.name] ??
                  `Running ${event.name.replace(/_/g, " ")}…`;
                enqueue({ toolStatus: label });
              }
              if (event.type === "plan_preview") {
                enqueue({ planPreview: event.preview });
              }
              if (event.type === "rich_blocks") {
                enqueue({ richBlocks: event.blocks });
              }
            },
            { maxTokens: 900, signal: request.signal }
          );

          reply = result.reply;

          if (result.planPreview) {
            enqueue({ planPreview: result.planPreview });
          }
        } else {
          reply = await collectStreamedText(chatMessages, {
            maxTokens: 900,
            signal: request.signal,
          });
        }

        if ((profile as Profile).preferred_locale === "al") {
          enqueue({ toolStatus: "Duke përpunuar shqipën…" });
        }
        reply = await maybeNaturalizeCoachReply(reply, preferredLocale);

        for (const chunk of chunkText(reply)) {
          enqueue({ text: chunk });
        }

        if (sources.length > 0) {
          enqueue({ sources });
        }
        await consumeAlexCommand(profile as Profile);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Stream failed";
        enqueue({ error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
