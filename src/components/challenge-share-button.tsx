"use client";

import { useCallback, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlatformCopy } from "@/components/locale-provider";
import { getChallengeShareUrl } from "@/lib/challenge-url";
import { cn } from "@/lib/utils";

export function ChallengeShareButton({
  slug,
  title,
  variant = "default",
  className,
}: {
  slug: string;
  title: string;
  variant?: "default" | "card";
  className?: string;
}) {
  const copy = usePlatformCopy().challenges.share;
  const [copied, setCopied] = useState(false);
  const url = getChallengeShareUrl(slug);

  const share = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({
            title,
            text: copy.message.replace("{title}", title),
            url,
          });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        window.prompt(copy.fallbackPrompt, url);
      }
    },
    [copy.fallbackPrompt, copy.message, title, url]
  );

  if (variant === "card") {
    return (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={copied ? copy.copied : copy.button}
        onClick={share}
        className={cn(
          "h-8 w-8 rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white",
          className
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={share}
      className={cn(
        "border-border/80 bg-secondary/40 text-foreground hover:bg-secondary",
        className
      )}
    >
      {copied ? (
        <Check className="mr-2 h-4 w-4 text-emerald-400" />
      ) : (
        <Share2 className="mr-2 h-4 w-4" />
      )}
      {copied ? copy.copied : copy.button}
    </Button>
  );
}
