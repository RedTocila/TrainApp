import { classifyCoachIntent, isPlanMutatingIntent } from "@/lib/ai/coach-intent";
import { normalizeUserText } from "@/lib/ai/constraint-language";

/**
 * Explicit "do something" verbs. Nouns alone ("my workout") are not enough —
 * "I skipped my workout today" must stay a normal Ask-mode chat.
 */
const ACTION_VERB_RE =
  /\b(?:make|create|build|generate|design|write|give me|put together|set up|prepare|change|modify|adjust|update|tweak|edit|swap|switch|replace|remove|delete|add|schedule|(?:want|need) (?:a|an|new)|krijo|bej|ndrysho|nderto|me jep|jep)\b/;
const POLITE_REQUEST_RE = /^(?:can|could|would|will) you\b|^(?:please|pls)\b/;

/** Ask mode has no build/edit tools — detect requests that need Act mode before calling the model. */
export function isAskModeBuildRequest(
  message: string,
  hasExistingPlan: boolean
): boolean {
  const text = normalizeUserText(message);
  if (!text || !ACTION_VERB_RE.test(text)) return false;
  const intent = classifyCoachIntent(message, { hasExistingPlan });
  if (!isPlanMutatingIntent(intent.primary)) return false;
  // "What's a good 3-day plan?" is advice; "Can you build me a plan?" is a request.
  return !intent.isQuestion || POLITE_REQUEST_RE.test(text);
}

/** Final replies that point the client at Act mode (the model is told to say this in Ask mode). */
export function mentionsActMode(reply: string): boolean {
  return /\bact mode\b|\bact\b.*\b(?:mode|switch|toggle)\b|\bmodalitet\w* (?:act|vepro)\b|\bvepro\b/i.test(reply);
}

export function askModeSwitchReply(locale: string | null | undefined): string {
  return locale === "al"
    ? "Në modalitetin Pyet të jap këshilla dhe regjistroj gjëra shpejt, por nuk ndërtoj apo ndryshoj plane. Kalo në modalitetin Vepro (butoni pranë kapëses) dhe ta bëj menjëherë."
    : "In Ask mode I can give advice and log quick stuff, but I can't build or change plans. Switch to Act mode (the button next to the paperclip) and I'll do it right away.";
}
