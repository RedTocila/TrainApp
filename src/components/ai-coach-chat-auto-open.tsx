"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";

export function AiCoachChatAutoOpen() {
  const searchParams = useSearchParams();
  const { openChat } = useAiCoachChat();

  useEffect(() => {
    if (searchParams.get("chat") === "1") {
      openChat();
    }
  }, [searchParams, openChat]);

  return null;
}
