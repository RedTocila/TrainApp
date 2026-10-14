import { transcribeAudioBytes, transcribeAudioLimit } from "@/lib/ai/transcribe-audio";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function pickExtension(mimeType: string, name: string): string {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5 && fromName !== name.toLowerCase()) {
    return fromName;
  }
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
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
  if (audio.size > transcribeAudioLimit()) {
    return Response.json({ error: "Recording is too long" }, { status: 400 });
  }

  const languageRaw = form.get("language");
  const language =
    typeof languageRaw === "string" && languageRaw.trim()
      ? languageRaw.trim()
      : undefined;

  const bytes = new Uint8Array(await audio.arrayBuffer());
  const extension = pickExtension(audio.type, audio.name);
  const result = await transcribeAudioBytes({
    bytes,
    filename: `voice.${extension}`,
    mimeType: audio.type || "audio/webm",
    language,
  });
  if ("error" in result) {
    const status = result.error.includes("not available") ? 503 : 500;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ text: result.text });
}
