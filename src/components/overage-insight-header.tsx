"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { OpenAiCoachChatButton } from "@/components/open-ai-coach-chat-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OverageInsightHeader({
  title,
  subtitle,
  titleClassName,
  howToFixLabel,
  chatPrompt,
  showHowToFix,
  closeAriaLabel,
  onClose,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  titleClassName?: string;
  howToFixLabel: string;
  chatPrompt?: string;
  showHowToFix?: boolean;
  closeAriaLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-border px-5 py-4">
      <div className="flex items-start gap-3">
        <AiCoachAvatar size="sm" className="mt-0.5 h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1 pr-1">
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
        <Button
          variant="ghost"
          size="icon"
          className="-mr-1 -mt-1 h-9 w-9 shrink-0"
          onClick={onClose}
          aria-label={closeAriaLabel}
        >
          <X className="h-5 w-5" />
        </Button>
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
