import { ADMIN_SYSTEM_PROMPT, ADMIN_TOOL_STATUS_LABELS } from "@/lib/ai/admin-chat-tools";
import { runAdminChatWithTools } from "@/lib/ai/admin-chat-with-tools";
import { getConfiguredProviders, streamChatCompletion } from "@/lib/ai/providers";
import type { ChatMessage, ChatTurn } from "@/lib/ai/types";
import { getProfile } from "@/lib/actions/auth";

export const runtime = "nodejs";

async function enqueueTextSmooth(
  enqueue: (payload: unknown) => void,
  text: string,
  signal?: AbortSignal
) {
  if (!text) return;
  const parts = text.match(/\s+\S+|\S+|\s+/g) ?? [text];
  let buffer = "";
  for (const part of parts) {
    if (signal?.aborted) return;
    buffer += part;
    if (buffer.length >= 12 || part.includes("\n")) {
      enqueue({ text: buffer });
      buffer = "";
      await new Promise((r) => setTimeout(r, 12));
    }
  }
  if (buffer) enqueue({ text: buffer });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (profile.role !== "admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  let body: { message?: string; history?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const chatMessages: ChatTurn[] = [
    { role: "system", content: ADMIN_SYSTEM_PROMPT },
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-24)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const useTools = getConfiguredProviders().includes("openai");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        let reply = "";
        let streamedLive = false;

        const onToken = (text: string) => {
          if (!text) return;
          streamedLive = true;
          enqueue({ text });
        };

        if (useTools) {
          const result = await runAdminChatWithTools(
            chatMessages,
            (event) => {
              if (event.type === "tool_start") {
                const label =
                  ADMIN_TOOL_STATUS_LABELS[event.name] ??
                  `Running ${event.name.replace(/_/g, " ")}…`;
                enqueue({ toolStatus: label });
              }
            },
            { maxTokens: 1100, signal: request.signal, onToken }
          );
          reply = result.reply;
        } else {
          for await (const chunk of streamChatCompletion(chatMessages, {
            maxTokens: 1100,
            signal: request.signal,
          })) {
            reply += chunk;
            onToken(chunk);
          }
        }

        if (!streamedLive && reply) {
          await enqueueTextSmooth(enqueue, reply, request.signal);
        }

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
      "X-Accel-Buffering": "no",
    },
  });
}
