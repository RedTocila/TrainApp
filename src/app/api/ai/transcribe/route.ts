import { getOpenAIClient } from "@/lib/ai/providers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Voice input is not available right now." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid audio upload" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: "No audio received" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "Recording is too long" }, { status: 400 });
  }

  const languageRaw = form.get("language");
  const language =
    typeof languageRaw === "string" && languageRaw.trim()
      ? languageRaw.trim()
      : undefined;

  try {
    const client = getOpenAIClient();
    const extension = pickExtension(audio.type, audio.name);
    const file = new File([audio], `voice.${extension}`, {
      type: audio.type || "audio/webm",
    });

    const result = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      ...(language ? { language } : {}),
    });

    const text = (result.text ?? "").trim();
    if (!text) {
      return Response.json(
        { error: "Couldn't catch that — try again." },
        { status: 422 }
      );
    }

    return Response.json({ text });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Transcription failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

function pickExtension(mimeType: string, name: string): string {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}
