"use client";

import { usePathname } from "next/navigation";
import { AiCoachChatDialog } from "@/components/ai-coach-chat-dialog";
import { AiCoachChatProvider } from "@/components/ai-coach-chat-context";

export function DashboardAiCoachProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onAiRoute = pathname.startsWith("/dashboard/ai");

  return (
    <AiCoachChatProvider>
      {children}
      {!onAiRoute ? <AiCoachChatDialog /> : null}
    </AiCoachChatProvider>
  );
}
