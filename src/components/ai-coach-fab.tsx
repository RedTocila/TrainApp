"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

export function AiCoachFab() {
  const platform = usePlatformCopy();
  const { isOpen, openChat } = useAiCoachChat();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isOpen) return null;

  return createPortal(
    <button
      type="button"
      onClick={openChat}
      aria-label={platform.nav.aiCoach}
      className={cn(
        "fixed z-[70] overflow-hidden rounded-full",
        "border-2 border-primary/50 shadow-xl shadow-primary/35",
        "pressable transition-[transform,box-shadow] duration-200",
        "hover:scale-105 hover:shadow-primary/50 active:scale-95",
        // Sit clearly above the mobile bottom nav, inset from the right edge
        "bottom-[calc(var(--dashboard-mobile-nav-height,4.25rem)+1rem)] right-4",
        "lg:bottom-6 lg:right-6"
      )}
    >
      <AiCoachAvatar size="fab" className="h-14 w-14" />
    </button>,
    document.body
  );
}
