import { resolveAiLanguagePreference } from "@/lib/ai/language-instructions";
import { runTextPrompt } from "@/lib/ai/providers";

/**
 * Second-pass rewrite: turns stiff / translated Albanian into natural spoken
 * coach shqip while freezing numbers and quoted meal names.
 * This is the systemic fix — do not keep adding one-off bad→good word pairs.
 */
export async function naturalizeAlbanianCoachText(
  draft: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const trimmed = draft.trim();
  if (!trimmed) return draft;

  const prompt = `You are a native Albanian (shqip) editor for Coach Alex — a sarcastic gym/nutrition coach in a fitness app.

Rewrite the DRAFT below into natural spoken Albanian that a real Albanian coach would text a client.

What to fix (in general — not a word list):
- Stiff dictionary Albanian and word-for-word English translations → everyday gym/kitchen language
- Formal/literary verbs → normal coaching verbs people actually say
- Nonsense or wrong food wording (e.g. a word that means a person instead of food) → the real food term
- Robot / report tone → keep sarcastic, human coach voice woven through the whole message

Hard constraints (do not break):
- Keep EVERY number, unit (g, kcal, ml, kg, %), and percentage EXACTLY the same
- Keep quoted meal/food names EXACTLY character-for-character (e.g. "Oats with Dried Fruit and Milk")
- Keep the same factual meaning and advice — do not add, remove, or invent coaching claims
- Keep the sarcasm/attitude; rewrite the wording, not the content
- Plain text only — no markdown

Output ONLY the rewritten Albanian message. No preamble.

DRAFT:
${trimmed}`;

  const rewritten = await runTextPrompt(prompt, {
    maxTokens: options?.maxTokens ?? Math.min(1200, Math.max(400, trimmed.length * 2)),
  });
  const out = rewritten.trim();
  return out || draft;
}

/** Run Albanian naturalization when app locale is Albanian; otherwise return text unchanged. */
export async function maybeNaturalizeCoachReply(
  text: string,
  locale?: string | null,
  options?: { maxTokens?: number }
): Promise<string> {
  if (resolveAiLanguagePreference(locale) !== "al") return text;
  if (!text.trim()) return text;
  try {
    return await naturalizeAlbanianCoachText(text, options);
  } catch {
    return text;
  }
}
