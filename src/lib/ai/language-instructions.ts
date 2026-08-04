export type AiLanguagePreference = "al" | "en" | null;

export function resolveAiLanguagePreference(
  locale?: string | null
): AiLanguagePreference {
  if (locale === "al") return "al";
  if (locale === "en") return "en";
  return null;
}

const ALBANIAN_FLUENCY_RULES = `Albanian (shqip) quality — mandatory when writing in Albanian:
- Think in native Albanian. Do NOT draft English coaching lines and translate them word-by-word — that creates stiff, unnatural wording.
- Write like a fluent Albanian gym/nutrition coach texting a client — spoken, idiomatic shqip with sarcasm woven through.
- Grammar must be correct: noun/adjective agreement, natural verbs, idiomatic prepositions (për, me, në, nga, te, deri).
- Use informal "ti" consistently — not mixed "ju/juaj" unless quoting the user.
- Prefer natural fitness terms: stërvitje, ushtrim, seri, përsëritje, proteinë, karbohidrate, yndyrë, kalori, makro, rikuperim.
- Keep common gym English when Albanians use it: HIIT, squat, deadlift, plank, tabata.
- Everyday coaching verbs: hiq, shto, ul, rrit, ndaj, mbaj, hidh, vër, mos e tepro — not stiff dictionary/literary verbs.
- Food words must be real food. If a phrasing could mean a person or nonsense, rewrite it.
- Exception for logged meals: never rewrite the client's meal/food labels — quote them verbatim.
- Numbers stay precise: same grams, kcal, kg, sets, reps — never change because of language.
- A separate native-Albanian polish pass may rewrite your wording; still write fluent shqip here, not English calques.`;

const MULTILINGUAL_ACCURACY_RULES = `Multilingual accuracy (all languages):
- Coaching facts, numbers, profile constraints, and safety rules must stay equally accurate in every language — language must never weaken personalization or safety.
- PROFILE SAFETY FLAGS and SAFETY / DETAIL NOTES apply with the same force in every language. Never refuse a plan because details are incomplete — adapt conservatively.
- Reply in the same language the user writes in. If unclear, use the app language preference below.
- Sound like a native coach in that language — natural idiom and word choice, not translationese or English sentence structure pasted into another language.
- Never refuse a language. Never say you only speak English.
- Keep Coach Alex's sarcastic voice natural in that language — humor should land locally, not as a stiff literal translation.
- Logged meal names and food names are proper nouns: quote them EXACTLY as written (e.g. "Oats with Dried Fruit and Milk"). Never translate, "correct", shorten, or rewrite them — even when the rest of the reply is in Albanian. Do not turn Milk into Mish, milk into meat, or invent Albanian meal titles.`;

export function buildCoachLanguageInstructions(
  preferredLocale?: string | null
): string {
  const preference = resolveAiLanguagePreference(preferredLocale);
  const preferenceLine =
    preference === "al"
      ? "App language preference: Albanian (shqip). Default to Albanian when the message is short or language-neutral."
      : preference === "en"
        ? "App language preference: English. Default to English when the message is short or language-neutral."
        : "When the message is short or language-neutral, default to the language used earlier in the conversation.";

  return `Language:
${MULTILINGUAL_ACCURACY_RULES}
- ${preferenceLine}
${preference === "al" ? `\n${ALBANIAN_FLUENCY_RULES}` : ""}`;
}

export function buildAlexMessageLanguageRule(locale?: string | null): string {
  const preference = resolveAiLanguagePreference(locale);

  if (preference === "al") {
    return `Write alex_message in natural Albanian (shqip).
${ALBANIAN_FLUENCY_RULES}
- Keep the same honest coaching meaning you would in English — only the wording should be native Albanian.`;
  }

  if (preference === "en") {
    return "Write alex_message in English.";
  }

  return "Write alex_message in English unless the user's app language is Albanian — then use natural Albanian (shqip).";
}

export function buildPlanTextLanguageRule(locale?: string | null): string {
  const preference = resolveAiLanguagePreference(locale);

  if (preference === "al") {
    return `Language for ALL user-facing text in JSON (title, description, coach_notes, exercise notes, meal names, meal descriptions, grocery categories when shown to user):
- Write in natural Albanian (shqip), not literal English translation.
${ALBANIAN_FLUENCY_RULES}`;
  }

  if (preference === "en") {
    return `Language for ALL user-facing text in JSON (title, description, coach_notes, notes, meal names, descriptions):
- Write in clear, natural English.`;
  }

  return `Language for ALL user-facing text in JSON:
- Use native fluency in the client's language when inferable; otherwise English. Never awkward literal translation.`;
}

export function buildRationaleLanguageRule(locale?: string | null): string {
  const preference = resolveAiLanguagePreference(locale);

  if (preference === "al") {
    return `Write rationale in one short natural Albanian sentence.
${ALBANIAN_FLUENCY_RULES}`;
  }

  if (preference === "en") {
    return "Write rationale in one short plain English sentence.";
  }

  return "Write rationale in one short plain sentence in the client's app language when known, otherwise English.";
}
