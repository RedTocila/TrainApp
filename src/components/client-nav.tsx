"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import {
  Bot,
  Dumbbell,
  Home,
  Trophy,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/app-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { InstantNavLink } from "@/components/instant-nav-link";
import { usePrefetchRoutes } from "@/components/use-prefetch-routes";
import { usePlatformCopy } from "@/components/locale-provider";
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
  liveChallengeActive = false,
}: {
  fullName: string;
  liveChallengeActive?: boolean;
}) {
  const pathname = usePathname();
  const { pendingHref, setPendingHref } = useDashboardNavPending();
  const platform = usePlatformCopy();
  const reduceMotion = useReducedMotion();
  const activePath = pendingHref ?? pathname;
  const hideNav = isActiveWorkoutSessionPath(activePath);
  const programsActive = isProgramsNavActive(activePath);
  const homeActive = isHomeNavActive(activePath);
  const [navCompact, setNavCompact] = useState(false);
  const scrollIdleTimer = useRef(0);

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
    if (!hideNav) return;
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
  }, [hideNav]);

  // Shrink floating pill while scrolling; restore when scrolling stops.
  // Capture on .dashboard-main so home day-page vertical scroll is included
  // (scroll does not bubble; day pages scroll inside the pager, not on main).
  useEffect(() => {
    if (hideNav) return;
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (!main) return;

    const onScroll = () => {
      setNavCompact(true);
      window.clearTimeout(scrollIdleTimer.current);
      scrollIdleTimer.current = window.setTimeout(() => {
        setNavCompact(false);
      }, 140);
    };

    main.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      main.removeEventListener("scroll", onScroll, { capture: true });
      window.clearTimeout(scrollIdleTimer.current);
    };
  }, [hideNav, pathname]);

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
      href: "/dashboard/ai",
      label: platform.nav.aiCoach,
      icon: Bot,
      active:
        activePath === "/dashboard/ai" || activePath.startsWith("/dashboard/ai/"),
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

  const iconSize = navCompact ? "h-5 w-5" : "h-6 w-6";

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

      <div className="dashboard-mobile-nav pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center bg-transparent px-3 pb-[max(0.75rem,var(--safe-area-bottom))] lg:hidden">
        <nav
          className={cn(
            "dashboard-instant-nav pointer-events-auto isolate relative flex w-full max-w-md items-center justify-around",
            "rounded-full border border-border/50 bg-background/45 shadow-[0_8px_28px_rgba(0,0,0,0.08)] backdrop-blur-2xl",
            "transition-[transform,height,padding,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "dark:border-white/15 dark:bg-background/35 dark:shadow-[0_8px_28px_rgba(0,0,0,0.22)]",
            navCompact
              ? "h-11 scale-[0.92] p-1"
              : "h-14 scale-100 p-1.5"
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
                  className={cn(iconSize, liveChallengeActive && "animate-pulse")}
                />
              ) : (
                <item.icon className={cn("relative z-[1]", iconSize)} />
              )}
            </InstantNavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
