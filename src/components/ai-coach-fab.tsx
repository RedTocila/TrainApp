"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { InstantNavLink } from "@/components/instant-nav-link";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

/** Exact liquid-glass chrome from the mobile nav pill (shared with the left nav). */
export const DASHBOARD_NAV_GLASS_CLASS =
  "rounded-full border border-zinc-300/90 bg-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/15 dark:bg-background/35 dark:shadow-[0_8px_28px_rgba(0,0,0,0.22)]";

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

  // Accent-red always; glow only while on the AI route.
  const linkClass = cn(
    "relative flex items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground",
    "transition-[transform,box-shadow] duration-150 ease-out will-change-transform active:scale-[0.9]",
    active
      ? "shadow-[0_0_28px_rgba(var(--primary-rgb),0.55),0_8px_28px_rgba(var(--primary-rgb),0.35)]"
      : "shadow-[0_8px_28px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.22)]"
  );

  const icon = (
    <Sparkles
      className="relative z-[1] h-6 w-6"
      strokeWidth={2.25}
      aria-hidden
    />
  );

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
          "pointer-events-auto h-14 w-14 shrink-0 lg:hidden"
        )}
      >
        {icon}
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
        "fixed z-[70] hidden h-14 w-14 lg:bottom-6 lg:right-6 lg:flex"
      )}
    >
      {icon}
    </InstantNavLink>,
    document.body
  );
}
