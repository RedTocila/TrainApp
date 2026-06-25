import { prepareFitnessCoachChatMessages } from "@/lib/ai/fitness-chat";
import { streamChatCompletion } from "@/lib/ai/providers";
import { PROFILE_COLUMNS } from "@/lib/db-selects";
import { createClient } from "@/lib/supabase/server";
import { hasPaidAccess } from "@/lib/subscription";
import type { ChatMessage } from "@/lib/ai/types";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";

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
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .single();

  if (!profile || !hasPaidAccess(profile as Profile)) {
    return Response.json({ error: "Subscription required" }, { status: 403 });
  }

  let body: { message?: string; history?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message = body.message ?? "";
  const history = Array.isArray(body.history) ? body.history : [];

  const prepared = await prepareFitnessCoachChatMessages(user.id, message, history);
  if ("error" in prepared) {
    return Response.json({ error: prepared.error }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChatCompletion(prepared.messages, {
          maxTokens: 900,
          signal: request.signal,
        })) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Stream failed";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
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
