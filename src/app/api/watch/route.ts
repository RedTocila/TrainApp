import { requireWatchUser } from "@/lib/watch/auth";
import { handleWatchAction } from "@/lib/watch/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireWatchUser(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    action?: string;
    date?: unknown;
    setId?: unknown;
    reps?: unknown;
    weightKg?: unknown;
    amount?: unknown;
    message?: unknown;
    audioBase64?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await handleWatchAction(auth, body);
    if ("error" in result && result.error) {
      return Response.json(
        { error: result.error },
        { status: result.status ?? 400 }
      );
    }
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
