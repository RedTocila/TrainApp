"use client";

import { useState, type MouseEvent } from "react";
import { X } from "lucide-react";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { OpenAiCoachChatButton } from "@/components/open-ai-coach-chat-button";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";
import {
  getNutritionStatusAdvice,
  type NutritionDayContext,
  type NutritionDayStatus,
} from "@/lib/nutrition-day-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  NutritionDayStatus,
  { button: string; title: string; dialog: string }
> = {
  good: {
    button: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    title: "text-emerald-400",
    dialog: "border-emerald-500/30 bg-emerald-500/5",
  },
  bad: {
    button: "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
    title: "text-amber-400",
    dialog: "border-amber-500/30 bg-amber-500/5",
  },
  missed: {
    button: "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20",
    title: "text-red-400",
    dialog: "border-red-500/30 bg-red-500/5",
  },
  too_much: {
    button: "border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20",
    title: "text-orange-400",
    dialog: "border-orange-500/30 bg-orange-500/5",
  },
};

export function NutritionStatusAdviceButton({
  status,
  context,
  className,
  variant = "chip",
  onClick,
}: {
  status: NutritionDayStatus;
  context: NutritionDayContext;
  className?: string;
  variant?: "chip" | "banner";
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);
  const advice = getNutritionStatusAdvice(status, coachCopy, coachLabels, context);
  const styles = STATUS_STYLES[status];

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          onClick?.(event);
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          variant === "banner"
            ? cn(
                "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors active:scale-[0.99]",
                styles.dialog,
                "hover:brightness-110"
              )
            : cn(
                "max-w-full shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase leading-snug tracking-wide transition-colors",
                styles.button
              ),
          className
        )}
      >
        {variant === "banner" ? (
          <>
            <AiCoachAvatar size="sm" className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-black", styles.title)}>{advice.title}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {advice.message}
              </p>
              {advice.detail ? (
                <p className="mt-1.5 text-xs text-muted-foreground/80">{advice.detail}</p>
              ) : null}
            </div>
          </>
        ) : (
          advice.title
        )}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-6 sm:pt-10">
          <button
            type="button"
            aria-label={platform.aria.close}
            className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 flex max-h-[min(85vh,28rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <AiCoachAvatar size="sm" className="h-10 w-10 shrink-0" />
                <div>
                  <h2 className={cn("text-lg font-black", styles.title)}>
                    {advice.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {coachCopy.mealInsights.coachName}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label={platform.aria.close}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className={cn("rounded-xl border px-3 py-3", styles.dialog)}>
                <p className="text-sm leading-relaxed">{advice.message}</p>
                {advice.detail ? (
                  <p className="mt-2 text-xs text-muted-foreground">{advice.detail}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 border-t border-border px-5 py-3">
              <OpenAiCoachChatButton className="w-full" onClick={() => setOpen(false)}>
                {platform.ai.askAlex}
              </OpenAiCoachChatButton>
              <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
                {coachLabels.illDoBetter}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
