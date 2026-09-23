"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type KeyboardEvent } from "react";
import { ArrowUp, Loader2, Mic, Sparkles, Square } from "lucide-react";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { ChatCommandInput } from "@/components/chat-command-input";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { buttonVariants } from "@/components/ui/button";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { getAiPlanBuilderProfile } from "@/lib/actions/ai-plan-builder";
import { buildPricingHref } from "@/lib/pricing-nav";
import { hasAiAccess } from "@/lib/subscription";
import { cn } from "@/lib/utils";

export function AiBuildPromptPanel({
  placeholder,
  buildPrompt,
  onSubmitted,
  accent = "violet",
  /** When known (e.g. plan builder page already gated), skip the access fetch. */
  hasAiAccess: hasAiAccessProp,
}: {
  placeholder: string;
  /** Maps the typed focus into the message Alex receives in Act mode. */
  buildPrompt: (focus: string) => string;
  onSubmitted?: () => void;
  accent?: "violet" | "emerald";
  hasAiAccess?: boolean;
}) {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const pathname = usePathname();
  const { openChat } = useAiCoachChat();
  const ai = platform.ai;
  const [aiAccess, setAiAccess] = useState<boolean | null>(
    () => (typeof hasAiAccessProp === "boolean" ? hasAiAccessProp : null)
  );
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof hasAiAccessProp === "boolean") {
      setAiAccess(hasAiAccessProp);
      return;
    }
    let cancelled = false;
    void getAiPlanBuilderProfile().then((result) => {
      if (cancelled) return;
      if ("profile" in result) {
        setAiAccess(hasAiAccess(result.profile));
      } else {
        // Fail open so the field still works; chat enforces limits.
        setAiAccess(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasAiAccessProp]);

  const voice = useVoiceDictation({
    locale,
    value: prompt,
    onChange: setPrompt,
    onError: (message) => setError(message),
    enabled: aiAccess !== false,
    permissionMessage: ai.voicePermission,
    unsupportedMessage: ai.voiceUnsupported,
  });

  const hasDraft = Boolean(prompt.trim());
  const showMicAction = voice.isActive || voice.isBusy || !hasDraft;
  const canSubmit = hasDraft && !voice.isBusy && !voice.isActive;
  const composerLocked = voice.isBusy;
  // AI Build always opens Act mode — match Alex Act send/mic styling.
  const actionBtnTone =
    "bg-red-600 text-white shadow-[0_0_14px_rgba(220,38,38,0.4)]";

  const handleSubmit = () => {
    const focus = prompt.trim();
    if (!focus || voice.isBusy || voice.isActive) return;
    setError(null);
    openChat(buildPrompt(focus), { mode: "act" });
    onSubmitted?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (aiAccess === false) {
    const accentIcon =
      accent === "emerald"
        ? "bg-emerald-500/10 text-emerald-400"
        : "bg-violet-500/10 text-violet-400";
    const accentBorder =
      accent === "emerald"
        ? "border-emerald-500/20 bg-emerald-500/5"
        : "border-violet-500/20 bg-violet-500/5";
    return (
      <div className={cn("rounded-2xl border p-4 text-center", accentBorder)}>
        <div
          className={cn(
            "mx-auto flex h-10 w-10 items-center justify-center rounded-xl",
            accentIcon
          )}
        >
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="mt-3 font-bold">
          {accent === "emerald"
            ? platform.aiUpgrade.aiNutritionPlan
            : platform.aiUpgrade.aiWorkoutPlan}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {platform.aiUpgrade.unlockFeature}
        </p>
        <Link
          href={buildPricingHref(pathname)}
          className={cn(buttonVariants({ size: "sm" }), "mt-3")}
        >
          {platform.aiUpgrade.viewAiPlan}
        </Link>
      </div>
    );
  }

  const voiceAria =
    voice.status === "transcribing"
      ? ai.voiceTranscribing
      : voice.isActive
        ? ai.voiceStopAria
        : ai.voiceStartAria;

  const fieldPlaceholder =
    voice.status === "listening"
      ? ai.voiceListening
      : voice.status === "recording"
        ? ai.voiceRecording
        : voice.status === "transcribing"
          ? ai.voiceTranscribing
          : placeholder;

  return (
    <div className="space-y-3 overflow-visible p-1">
      <div
        className={cn(
          "chat-command-shell grid w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-1.5 rounded-2xl border border-border/70 bg-secondary/60 p-1.5 pl-3 shadow-sm backdrop-blur-sm transition-[box-shadow,border-color] duration-200",
          voice.isActive
            ? "overflow-visible border-primary/50 shadow-[0_0_0_1px_rgba(var(--primary-rgb),0.18),0_0_18px_rgba(var(--primary-rgb),0.22)]"
            : "overflow-hidden"
        )}
      >
        <div className="relative col-start-1 row-start-1 min-w-0 self-stretch">
          <ChatCommandInput
            value={prompt}
            onChange={(value) => {
              setError(null);
              setPrompt(value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={fieldPlaceholder}
            disabled={composerLocked}
            minLines={6}
            className={cn(
              "chat-command-input-wrap min-w-0 h-full",
              voice.isActive && "pr-6"
            )}
          />
          {voice.isActive ? (
            <span
              className="chat-voice-bars pointer-events-none absolute right-1 bottom-2 text-primary"
              aria-hidden
            >
              <span />
              <span />
              <span />
              <span />
            </span>
          ) : null}
        </div>

        {showMicAction ? (
          <button
            type="button"
            onClick={voice.toggle}
            disabled={composerLocked}
            aria-label={voiceAria}
            title={voiceAria}
            className={cn(
              "col-start-2 mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity",
              actionBtnTone,
              voice.isActive && "chat-voice-active chat-voice-active--act",
              composerLocked
                ? "cursor-not-allowed opacity-45"
                : "hover:opacity-90"
            )}
          >
            {voice.isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : voice.isActive ? (
              <Square
                className="relative z-10 h-3.5 w-3.5 fill-current"
                strokeWidth={0}
              />
            ) : (
              <Mic className="h-4 w-4" strokeWidth={2.5} />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label={platform.aria.sendMessage}
            className={cn(
              "col-start-2 mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity",
              actionBtnTone,
              canSubmit ? "hover:opacity-90" : "cursor-not-allowed opacity-45"
            )}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
