import { getOpenAIClient } from "@/lib/ai/providers";

const MAX_BYTES = 8 * 1024 * 1024;

const PRIMARY_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-transcribe";
const FALLBACK_MODEL = "whisper-1";

const GPT_TRANSCRIBE_LANGUAGE_CODES = new Set([
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "ja",
  "ko",
  "zh",
  "ru",
  "ar",
  "hi",
  "tr",
  "pl",
  "sv",
  "da",
  "no",
  "fi",
  "uk",
  "cs",
  "ro",
  "hu",
  "el",
  "he",
  "th",
  "vi",
  "id",
  "ms",
  "tl",
]);

function isGptTranscribeModel(model: string): boolean {
  return (
    model.startsWith("gpt-4o-transcribe") || model.startsWith("gpt-transcribe")
  );
}

function languagePrompt(language: string | undefined): string | undefined {
  if (language === "sq") {
    return "The audio is spoken in Albanian (shqip). Transcribe ONLY in Albanian. Keep fitness and coaching terms natural in Albanian — do not translate to English.";
  }
  if (language === "en") {
    return "Transcribe in English. Keep fitness coaching phrasing natural.";
  }
  return undefined;
}

function apiLanguageForModel(
  model: string,
  language: string | undefined
): string | undefined {
  if (!language) return undefined;
  if (isGptTranscribeModel(model)) {
    return GPT_TRANSCRIBE_LANGUAGE_CODES.has(language) ? language : undefined;
  }
  return language;
}

export function transcribeAudioLimit(): number {
  return MAX_BYTES;
}

/** Turn a short voice clip into text. Uses the same models as the phone composer. */
export async function transcribeAudioBytes(input: {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  language?: string;
  fast?: boolean;
}): Promise<{ text: string } | { error: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { error: "Voice input is not available right now." };
  }
  if (input.bytes.byteLength === 0) return { error: "No audio received." };
  if (input.bytes.byteLength > MAX_BYTES) return { error: "Recording is too long." };

  const client = getOpenAIClient();
  const prompt = languagePrompt(input.language);
  const models = input.fast
    ? [FALLBACK_MODEL]
    : [PRIMARY_MODEL, ...(PRIMARY_MODEL === FALLBACK_MODEL ? [] : [FALLBACK_MODEL])];

  let lastError: unknown = null;
  for (const model of models) {
    try {
      const apiLanguage = apiLanguageForModel(model, input.language);
      const file = new File([Buffer.from(input.bytes)], input.filename, {
        type: input.mimeType || "audio/mp4",
      });
      const result = await client.audio.transcriptions.create({
        file,
        model,
        ...(apiLanguage ? { language: apiLanguage } : {}),
        ...(prompt ? { prompt } : {}),
        ...(isGptTranscribeModel(model) ? { response_format: "json" as const } : {}),
      });
      const text = (result.text ?? "").trim();
      if (!text) {
        lastError = new Error("empty transcript");
        continue;
      }
      return { text };
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Transcription failed";
  return { error: message };
}
