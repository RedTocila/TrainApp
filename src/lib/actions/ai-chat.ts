"use server";

import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import {
  checkAlexCommandAllowed,
  consumeAlexCommand,
} from "@/lib/actions/usage-limits";
import { generateFitnessCoachReply } from "@/lib/ai/fitness-chat";
import type { ChatMessage } from "@/lib/ai/types";

export async function sendFitnessChatMessageAction(
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string } | { error: string }> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { error: "Not authenticated" };

  const access = await checkAlexCommandAllowed(profile);
  if (!access.allowed) return { error: access.error };

  const result = await generateFitnessCoachReply(profile.id, message, history);
  if ("error" in result) return result;

  await consumeAlexCommand(profile);
  return result;
}
