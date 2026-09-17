"use client";

import type { ReactNode } from "react";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { OpenAiCoachChatButton } from "@/components/open-ai-coach-chat-button";
import { cn } from "@/lib/utils";

export function OverageInsightHeader({
  title,
  subtitle,
  titleClassName,
  howToFixLabel,
  chatPrompt,
  showHowToFix,
  onClose,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  titleClassName?: string;
  howToFixLabel: string;
  chatPrompt?: string;
  showHowToFix?: boolean;
  closeAriaLabel?: string;
  onClose: () => void;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3">
        <AiCoachAvatar size="sm" className="mt-0.5 h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "text-base font-black leading-snug tracking-tight sm:text-lg",
              titleClassName
            )}
          >
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {showHowToFix ? (
        <OpenAiCoachChatButton
          className="mt-3 h-9 w-full rounded-full text-sm font-semibold"
          prompt={chatPrompt}
          onClick={onClose}
        >
          {howToFixLabel}
        </OpenAiCoachChatButton>
      ) : null}
    </div>
  );
}
