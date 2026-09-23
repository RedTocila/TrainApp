import type { ChatMessage } from "@/lib/ai/types";
import type { CoachChatMode } from "@/lib/ai/coach-chat-tools";

/** Survives dialog close/reopen within the same session for a short window. */
export const COACH_CHAT_CACHE_TTL_MS = 10 * 60 * 1000;

export type CoachChatCacheSnapshot = {
  messages: ChatMessage[];
  chatMode: CoachChatMode;
  updatedAt: number;
};

let cache: CoachChatCacheSnapshot | null = null;

function isFresh(snapshot: CoachChatCacheSnapshot, now = Date.now()): boolean {
  return now - snapshot.updatedAt < COACH_CHAT_CACHE_TTL_MS;
}

export function getCachedCoachChat(): CoachChatCacheSnapshot | null {
  if (!cache) return null;
  if (!isFresh(cache)) {
    cache = null;
    return null;
  }
  return cache;
}

export function setCachedCoachChat(snapshot: {
  messages: ChatMessage[];
  chatMode: CoachChatMode;
}): void {
  if (snapshot.messages.length === 0) {
    cache = null;
    return;
  }
  cache = {
    messages: snapshot.messages,
    chatMode: snapshot.chatMode,
    updatedAt: Date.now(),
  };
}

export function clearCoachChatCache(): void {
  cache = null;
}
