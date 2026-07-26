"use client";

import { AiCoachChatDialog } from "@/components/ai-coach-chat-dialog";
import { AiCoachChatProvider } from "@/components/ai-coach-chat-context";

export function DashboardAiCoachProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AiCoachChatProvider>
      {children}
      <AiCoachChatDialog />
    </AiCoachChatProvider>
  );
}
