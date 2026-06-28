"use server";

import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { generateFitnessCoachReply } from "@/lib/ai/fitness-chat";
import type { ChatMessage } from "@/lib/ai/types";
import { PLATFORM_AI_PRO_NAME } from "@/lib/brand";
import { hasAiAccess } from "@/lib/subscription";

export async function sendFitnessChatMessageAction(
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string } | { error: string }> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { error: "Not authenticated" };
  if (!hasAiAccess(profile)) {
    return { error: `Upgrade to ${PLATFORM_AI_PRO_NAME} to chat with your AI Coach.` };
  }

  return generateFitnessCoachReply(profile.id, message, history);
}
