"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { cn } from "@/lib/utils";

export function AiCoachChatFeatureTile({
  icon: Icon,
  label,
  accentClass = "text-primary",
  bgClass = "bg-primary/10",
}: {
  icon: LucideIcon;
  label: string;
  accentClass?: string;
  bgClass?: string;
}) {
  const { openChat } = useAiCoachChat();

  return (
    <button
      type="button"
      onClick={openChat}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-secondary/40"
    >
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", bgClass)}>
        <Icon className={cn("h-6 w-6", accentClass)} />
      </div>
      <span className="text-xs font-semibold leading-tight">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
