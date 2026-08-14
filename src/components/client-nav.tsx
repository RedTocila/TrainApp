"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import {
  Dumbbell,
  Home,
  Trophy,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AiCoachFab } from "@/components/ai-coach-fab";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { AppLogo } from "@/components/app-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { InstantNavLink } from "@/components/instant-nav-link";
import { usePrefetchRoutes } from "@/components/use-prefetch-routes";
import { usePlatformCopy } from "@/components/locale-provider";
import { getHasLivePublishedChallenge } from "@/lib/actions/challenges";
import {
  isActiveWorkoutSessionPath,
  isHomeNavActive,
  isProgramsNavActive,
} from "@/lib/train-nav";

const mobileNavLinkClass =
  "pressable relative z-[1] flex h-full min-w-0 flex-1 items-center justify-center touch-manipulation select-none [-webkit-tap-highlight-color:transparent] transition-[transform,opacity,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 active:opacity-90";

function NavIconWithDot({
  icon: Icon,
  showDot,
  className,
}: {
  icon: LucideIcon;
  showDot: boolean;
  className?: string;
}) {
  return (
    <span className="relative z-[1] inline-flex">
      <Icon className={className} />
      {showDot ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background"
        />
      ) : null}
    </span>
  );
}

export function ClientNav({
  fullName,
}: {
  fullName: string;
}) {
  const pathname = usePathname();
  const { pendingHref, setPendingHref } = useDashboardNavPending();
  const { isOpen: alexChatOpen } = useAiCoachChat();
  const platform = usePlatformCopy();
  const reduceMotion = useReducedMotion();
  const activePath = pendingHref ?? pathname;
  const hideNav = isActiveWorkoutSessionPath(activePath);
  const hideMobileChrome = hideNav || alexChatOpen;
  const programsActive = isProgramsNavActive(activePath);
  const homeActive = isHomeNavActive(activePath);
  const [liveChallengeActive, setLiveChallengeActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getHasLivePublishedChallenge().then((live) => {
      if (!cancelled) setLiveChallengeActive(live);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const prefetchRoutes = useMemo(
    () => [
      "/dashboard",
      "/dashboard/workout",
      "/dashboard/nutrition",
      "/dashboard/ai",
      "/dashboard/classes",
      "/dashboard/challenges",
      "/dashboard/profile",
    ],
    []
  );
  usePrefetchRoutes(prefetchRoutes);

  useEffect(() => {
    if (!hideMobileChrome) return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--dashboard-mobile-nav-height");
    root.style.setProperty("--dashboard-mobile-nav-height", "0px");
    return () => {
      if (previous) {
        root.style.setProperty("--dashboard-mobile-nav-height", previous);
      } else {
        root.style.removeProperty("--dashboard-mobile-nav-height");
      }
    };
  }, [hideMobileChrome]);

  if (hideNav) return null;

  const mobileNavItems: {
    href: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
    showDot?: boolean;
    tapSlop?: number;
  }[] = [
    {
      href: "/dashboard",
      label: platform.nav.home,
      icon: Home,
      active: homeActive,
    },
    {
      href: "/dashboard/workout",
      label: platform.nav.programs,
      icon: Dumbbell,
      active: programsActive,
      tapSlop: 16,
    },
    {
      href: "/dashboard/classes",
      label: platform.nav.liveCoaching,
      icon: Trophy,
      active:
        activePath === "/dashboard/classes" ||
        activePath.startsWith("/dashboard/classes/"),
      // Always draw attention; pulse when a challenge is live.
      showDot: true,
    },
    {
      href: "/dashboard/profile",
      label: platform.nav.profile,
      icon: User,
      active:
        activePath === "/dashboard/profile" ||
        activePath.startsWith("/dashboard/profile/"),
    },
  ];

  const sidebarLinkClass = (active: boolean) =>
    cn(
      "pressable flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[transform,opacity,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] touch-manipulation active:scale-[0.98]",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    );

  return (
    <>
      <aside className="hidden h-dvh w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="border-b border-border p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <AppLogo href="/dashboard" />
              <p className="mt-1 text-sm text-muted-foreground">{platform.nav.welcome(fullName)}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {mobileNavItems.map((item) => (
            <InstantNavLink
              key={item.href}
              href={item.href}
              onNavigateStart={setPendingHref}
              className={sidebarLinkClass(item.active)}
            >
              {item.showDot ? (
                <NavIconWithDot icon={item.icon} showDot className="h-4 w-4" />
              ) : (
                <item.icon className="h-4 w-4" />
              )}
              {item.label}
            </InstantNavLink>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <SignOutButton />
        </div>
      </aside>

      {!alexChatOpen ? (
        <>
          <div className="dashboard-mobile-nav pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex items-end justify-center gap-2.5 bg-transparent px-3 pb-[max(0.75rem,var(--safe-area-bottom))] lg:hidden">
            <nav
              className={cn(
                "dashboard-instant-nav pointer-events-auto isolate relative flex h-14 w-full max-w-[min(28rem,calc(100%-3.75rem))] items-center justify-around p-1.5",
                "rounded-full border border-border/50 bg-background/45 shadow-[0_8px_28px_rgba(0,0,0,0.08)] backdrop-blur-2xl",
                "dark:border-white/15 dark:bg-background/35 dark:shadow-[0_8px_28px_rgba(0,0,0,0.22)]"
              )}
              aria-label="Primary"
            >
              {mobileNavItems.map((item) => (
                <InstantNavLink
                  key={item.href}
                  href={item.href}
                  pressToNavigate
                  onNavigateStart={setPendingHref}
                  tapSlop={item.tapSlop}
                  aria-label={item.label}
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    mobileNavLinkClass,
                    item.active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.active ? (
                    <motion.span
                      layoutId="mobile-nav-active-pill"
                      className="absolute inset-0 rounded-full bg-primary/12 dark:bg-primary/20"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
                      }
                      aria-hidden
                    />
                  ) : null}
                  {item.showDot ? (
                    <NavIconWithDot
                      icon={item.icon}
                      showDot
                      className={cn("h-6 w-6", liveChallengeActive && "animate-pulse")}
                    />
                  ) : (
                    <item.icon className="relative z-[1] h-6 w-6" />
                  )}
                </InstantNavLink>
              ))}
            </nav>
            <AiCoachFab placement="docked" onNavigateStart={setPendingHref} />
          </div>
          <AiCoachFab placement="corner" onNavigateStart={setPendingHref} />
        </>
      ) : null}
    </>
  );
}
