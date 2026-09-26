"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { InstantNavLink } from "@/components/instant-nav-link";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

/** Exact liquid-glass chrome from the mobile nav pill (shared with the left nav). */
export const DASHBOARD_NAV_GLASS_CLASS =
  "rounded-full border border-zinc-300/90 bg-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/55 dark:shadow-[0_8px_28px_rgba(0,0,0,0.25)]";

function isAiCoachPath(pathname: string) {
  return pathname === "/dashboard/ai" || pathname.startsWith("/dashboard/ai/");
}

export function AiCoachFab({
  placement = "docked",
  onNavigateStart,
}: {
  /** `docked` sits beside the mobile nav pill; `corner` floats bottom-right on desktop. */
  placement?: "docked" | "corner";
  onNavigateStart?: (href: string) => void;
}) {
  const platform = usePlatformCopy();
  const pathname = usePathname();
  const active = isAiCoachPath(pathname);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Accent-colored Alex avatar; glow only while on the AI route.
  const linkClass = cn(
    "relative overflow-hidden rounded-full border-2 border-border/60 pressable transition-[transform,border-color,box-shadow] duration-200 hover:scale-105 hover:border-border active:scale-95",
    active
      ? "border-primary shadow-[0_0_28px_rgba(var(--primary-rgb),0.55),0_8px_28px_rgba(var(--primary-rgb),0.35)]"
      : null
  );

  const avatar = <AiCoachAvatar size="fab" className="h-full w-full" />;

  if (placement === "docked") {
    return (
      <InstantNavLink
        href="/dashboard/ai"
        pressToNavigate
        onNavigateStart={onNavigateStart}
        aria-label={platform.nav.aiCoach}
        aria-current={active ? "page" : undefined}
        className={cn(
          linkClass,
          "pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center lg:hidden"
        )}
      >
        {avatar}
      </InstantNavLink>
    );
  }

  if (!mounted) return null;

  return createPortal(
    <InstantNavLink
      href="/dashboard/ai"
      pressToNavigate
      onNavigateStart={onNavigateStart}
      aria-label={platform.nav.aiCoach}
      aria-current={active ? "page" : undefined}
      className={cn(
        linkClass,
        "fixed z-[70] hidden h-14 w-14 items-center justify-center lg:bottom-6 lg:right-6 lg:flex"
      )}
    >
      <AiCoachAvatar size="fab" className="h-14 w-14" />
    </InstantNavLink>,
    document.body
  );
}
