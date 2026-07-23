"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
  "pressable flex h-full min-w-0 flex-1 items-center justify-center touch-manipulation select-none [-webkit-tap-highlight-color:transparent] transition-[transform,opacity,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 active:opacity-90";

function NavLiveIcon({
  icon: Icon,
  showDot,
  className,
}: {
  icon: LucideIcon;
  showDot: boolean;
  className?: string;
}) {
  return (
    <span className="relative inline-flex">
      <Icon className={className} />
      {showDot ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-card animate-pulse" />
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
  useEffect(() => {
    if (hideNav) return;
    const mains = [
      document.querySelector<HTMLElement>(".dashboard-main"),
      document.querySelector<HTMLElement>(".dashboard-day-pager"),
    ].filter(Boolean) as HTMLElement[];
    if (mains.length === 0) return;

    const onScroll = () => {
      setNavCompact(true);
      window.clearTimeout(scrollIdleTimer.current);
      scrollIdleTimer.current = window.setTimeout(() => {
        setNavCompact(false);
      }, 140);
    };

    for (const el of mains) {
      el.addEventListener("scroll", onScroll, { passive: true });
    }
    return () => {
      for (const el of mains) {
        el.removeEventListener("scroll", onScroll);
      }
      window.clearTimeout(scrollIdleTimer.current);
    };
  }, [hideNav, pathname]);

  if (hideNav) return null;

  const standardNavItems = [
    { href: "/dashboard", label: platform.nav.home, icon: Home, exact: true as const },
    { href: "/dashboard/ai", label: platform.nav.aiCoach, icon: Bot },
    { href: "/dashboard/classes", label: platform.nav.liveCoaching, icon: Trophy },
    { href: "/dashboard/profile", label: platform.nav.profile, icon: User },
  ];

  const programsNavItem = {
    href: "/dashboard/workout",
    label: platform.nav.programs,
  };

  function isNavItemActive(pathname: string, href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

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
          <InstantNavLink
            href="/dashboard"
            onNavigateStart={setPendingHref}
            className={sidebarLinkClass(homeActive)}
          >
            <Home className="h-4 w-4" />
            {platform.nav.home}
          </InstantNavLink>

          <InstantNavLink
            href={programsNavItem.href}
            onNavigateStart={setPendingHref}
            className={sidebarLinkClass(programsActive)}
          >
            <Dumbbell className="h-4 w-4" />
            {programsNavItem.label}
          </InstantNavLink>

          {standardNavItems.slice(1).map((item) => {
            const active = isNavItemActive(activePath, item.href);
            const showLiveDot = liveChallengeActive && item.href === "/dashboard/classes";
            return (
              <InstantNavLink
                key={item.href}
                href={item.href}
                onNavigateStart={setPendingHref}
                className={sidebarLinkClass(active)}
              >
                {showLiveDot ? (
                  <NavLiveIcon icon={item.icon} showDot className="h-4 w-4" />
                ) : (
                  <item.icon className="h-4 w-4" />
                )}
                {item.label}
              </InstantNavLink>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <SignOutButton />
        </div>
      </aside>

      <div className="dashboard-mobile-nav pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center bg-transparent px-3 pb-[max(0.75rem,var(--safe-area-bottom))] lg:hidden">
        <nav
          className={cn(
            "dashboard-instant-nav pointer-events-auto isolate flex w-full max-w-md items-center justify-around",
            "rounded-full border border-border/50 bg-background/45 shadow-[0_8px_28px_rgba(0,0,0,0.08)] backdrop-blur-2xl",
            "transition-[transform,height,padding,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "dark:border-white/15 dark:bg-background/35 dark:shadow-[0_8px_28px_rgba(0,0,0,0.22)]",
            navCompact
              ? "h-11 scale-[0.92] px-2"
              : "h-14 scale-100 px-2.5"
          )}
          aria-label="Primary"
        >
          <InstantNavLink
            href="/dashboard"
            pressToNavigate
            onNavigateStart={setPendingHref}
            aria-label={standardNavItems[0].label}
            className={cn(
              mobileNavLinkClass,
              homeActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Home className={iconSize} />
          </InstantNavLink>

          <InstantNavLink
            href={programsNavItem.href}
            pressToNavigate
            tapSlop={16}
            onNavigateStart={setPendingHref}
            aria-label={programsNavItem.label}
            className={cn(
              mobileNavLinkClass,
              programsActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Dumbbell className={iconSize} />
          </InstantNavLink>

          {standardNavItems.slice(1).map((item) => {
            const active = isNavItemActive(activePath, item.href);
            const showLiveDot = liveChallengeActive && item.href === "/dashboard/classes";
            return (
              <InstantNavLink
                key={item.href}
                href={item.href}
                pressToNavigate
                onNavigateStart={setPendingHref}
                tapSlop={item.href.startsWith("/dashboard/ai") ? 16 : undefined}
                aria-label={item.label}
                className={cn(
                  mobileNavLinkClass,
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {showLiveDot ? (
                  <NavLiveIcon icon={item.icon} showDot className={iconSize} />
                ) : (
                  <item.icon className={iconSize} />
                )}
              </InstantNavLink>
            );
          })}
        </nav>
      </div>
    </>
  );
}
