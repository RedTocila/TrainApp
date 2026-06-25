"use server";

import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { generateFitnessCoachReply } from "@/lib/ai/fitness-chat";
import type { ChatMessage } from "@/lib/ai/types";
import { hasPaidAccess } from "@/lib/subscription";

export async function sendFitnessChatMessageAction(
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string } | { error: string }> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { error: "Not authenticated" };
  if (!hasPaidAccess(profile)) {
    return { error: "Upgrade to LevelUp AI to chat with your AI Coach." };
  }

  return generateFitnessCoachReply(profile.id, message, history);
}
