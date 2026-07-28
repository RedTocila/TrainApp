"use client";

import { buttonVariants } from "@/components/ui/button";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function OpenAiCoachChatButton({
  children,
  className,
  icon: Icon,
  prompt,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
  /** Opens chat and auto-sends this message when set. */
  prompt?: string;
  onClick?: () => void;
}) {
  const { openChat } = useAiCoachChat();

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        openChat(prompt);
      }}
      className={cn(buttonVariants({ className }))}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
