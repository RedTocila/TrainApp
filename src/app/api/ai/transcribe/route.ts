import { getOpenAIClient } from "@/lib/ai/providers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/** Prefer GPT-4o Transcribe (better Albanian); override via OPENAI_TRANSCRIBE_MODEL. */
const PRIMARY_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-transcribe";
const FALLBACK_MODEL = "whisper-1";

function isGptTranscribeModel(model: string): boolean {
  return model.startsWith("gpt-4o-transcribe") || model.startsWith("gpt-transcribe");
}

function languagePrompt(language: string | undefined): string | undefined {
  if (language === "sq") {
    return "Transcribe in Albanian (shqip). Keep fitness terms natural in Albanian.";
  }
  if (language === "en") {
    return "Transcribe in English. Keep fitness coaching phrasing natural.";
  }
  return undefined;
}

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
    const makeFile = () =>
      new File([audio], `voice.${extension}`, {
        type: audio.type || "audio/webm",
      });

    const prompt = languagePrompt(language);
    const models = [PRIMARY_MODEL];
    if (PRIMARY_MODEL !== FALLBACK_MODEL) models.push(FALLBACK_MODEL);

    let lastError: unknown = null;
    for (const model of models) {
      try {
        const result = await client.audio.transcriptions.create({
          file: makeFile(),
          model,
          ...(language ? { language } : {}),
          ...(prompt ? { prompt } : {}),
          ...(isGptTranscribeModel(model)
            ? { response_format: "json" as const }
            : {}),
        });

        const text = (result.text ?? "").trim();
        if (!text) {
          lastError = new Error("empty transcript");
          continue;
        }

        return Response.json({ text });
      } catch (error) {
        lastError = error;
      }
    }

    const msg =
      lastError instanceof Error ? lastError.message : "Transcription failed";
    return Response.json({ error: msg }, { status: 500 });
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
