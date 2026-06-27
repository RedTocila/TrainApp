"use client";

import { buttonVariants } from "@/components/ui/button";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function OpenAiCoachChatButton({
  children,
  className,
  icon: Icon,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
  onClick?: () => void;
}) {
  const { openChat } = useAiCoachChat();

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        openChat();
      }}
      className={cn(buttonVariants({ className }))}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
