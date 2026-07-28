export type AiLanguagePreference = "al" | "en" | null;

export function resolveAiLanguagePreference(
  locale?: string | null
): AiLanguagePreference {
  if (locale === "al") return "al";
  if (locale === "en") return "en";
  return null;
}

const ALBANIAN_FLUENCY_RULES = `Albanian (shqip) quality — mandatory when writing in Albanian:
- Write native Albanian a fluent Albanian speaker would use in a gym or nutrition consult — NOT word-for-word English translated into Albanian.
- Grammar must be correct: proper noun/adjective agreement (gender, number, case), natural verb conjugation, and idiomatic prepositions (për, me, në, nga, te, deri).
- Use informal "ti" consistently (Coach Alex voice) — e.g. "ti", "te", "tënd/tënde", not mixed random "ju/juaj" unless quoting the user.
- Prefer natural Albanian fitness terms:
  - stërvitje, ushtrim, seri, përsëritje, pushim, ngarkesë, intensitet, ngrohje, shtrirje
  - proteinë, karbohidrate, yndyrë, kalori, deficit kalorik, surplus, makro
  - qëllim, rutinë, rikuperim, fleksibilitet, lëndim, kufizim lëvizjeje
- Keep widely used international terms when normal in Albanian gyms: HIIT, PCOS/SOPK, tabata, squat, deadlift, plank.
- Avoid English calques and false friends. Bad → better examples:
  - "leg day" → "stërvitje për këmbët" / "dita e këmbëve"
  - "meal prep" → "përgatitje vaktesh" / "gati vaktet paraprakisht"
  - "track macros" → "regjistro makrot"
  - "hit your protein" → "arri objektivin e proteinës"
  - "recovery day" → "ditë rikuperimi"
- Do not invent awkward Albanian for common foods/exercises — use standard Albanian names when they exist; otherwise keep the common international exercise name.
- Numbers stay precise in any language: same grams, kcal, kg, sets, reps, seconds — never round differently because of language.
- Medical/coaching boundaries stay equally strict in Albanian: practical suggestion + remind them to confirm with mjekun/doktorin when health, meds, or conditions are involved.`;

const MULTILINGUAL_ACCURACY_RULES = `Multilingual accuracy (all languages):
- Coaching facts, numbers, profile constraints, and safety rules must stay equally accurate in every language — language must never weaken personalization or safety.
- PROFILE SAFETY FLAGS and CRITICAL INFO GAPS apply with the same force in every language.
- Reply in the same language the user writes in. If unclear, use the app language preference below.
- Sound like a native coach in that language — natural idiom and word choice, not translationese or English sentence structure pasted into another language.
- Never refuse a language. Never say you only speak English.
- Keep Coach Alex's sarcastic voice natural in that language — humor should land locally, not as a stiff literal translation.`;

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
