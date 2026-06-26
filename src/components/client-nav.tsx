"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  Dumbbell,
  Home,
  User,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppLogo } from "@/components/app-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { ReferralNavButton } from "@/components/full-calendar-nav-button";
import { InstantNavLink } from "@/components/instant-nav-link";
import { usePrefetchRoutes } from "@/components/use-prefetch-routes";
import { usePlatformCopy } from "@/components/locale-provider";
import { isTrainPath } from "@/lib/train-nav";

const mobileNavLinkClass =
  "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium leading-none touch-manipulation select-none [-webkit-tap-highlight-color:transparent] active:scale-95 active:opacity-90";

export function ClientNav({ fullName }: { fullName: string }) {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const programsActive = isTrainPath(pathname);

  const standardNavItems = [
    { href: "/dashboard", label: platform.nav.home, mobileLabel: platform.nav.home, icon: Home, exact: true as const },
    { href: "/dashboard/ai", label: platform.nav.aiCoach, mobileLabel: platform.nav.aiCoach, icon: Bot },
    { href: "/dashboard/classes", label: platform.nav.liveCoaching, mobileLabel: platform.nav.live, icon: Video },
    { href: "/dashboard/profile", label: platform.nav.profile, mobileLabel: platform.nav.profile, icon: User },
  ];

  const programsNavItem = {
    href: "/dashboard/workout",
    label: platform.nav.programs,
    mobileLabel: platform.nav.programs,
  };

  const prefetchRoutes = useMemo(
    () => [
      "/dashboard",
      "/dashboard/workout",
      "/dashboard/nutrition",
      "/dashboard/ai",
      "/dashboard/classes",
      "/dashboard/profile",
    ],
    []
  );
  usePrefetchRoutes(prefetchRoutes);

  function isNavItemActive(pathname: string, href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const sidebarLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation",
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
            <ReferralNavButton />
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <InstantNavLink href="/dashboard" className={sidebarLinkClass(pathname === "/dashboard")}>
            <Home className="h-4 w-4" />
            {platform.nav.home}
          </InstantNavLink>

          <InstantNavLink
            href={programsNavItem.href}
            className={sidebarLinkClass(programsActive)}
          >
            <Dumbbell className="h-4 w-4" />
            {programsNavItem.label}
          </InstantNavLink>

          {standardNavItems.slice(1).map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <InstantNavLink key={item.href} href={item.href} className={sidebarLinkClass(active)}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </InstantNavLink>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {platform.nav.theme}
          </p>
          <ThemeToggle variant="segmented" />
        </div>
        <div className="border-t border-border p-4">
          <SignOutButton />
        </div>
      </aside>

      <nav className="dashboard-mobile-nav dashboard-instant-nav pointer-events-auto fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="flex justify-around px-1 pt-1.5">
          <InstantNavLink
            href="/dashboard"
            className={cn(
              mobileNavLinkClass,
              pathname === "/dashboard" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Home className="h-5 w-5" />
            <span className="truncate">{standardNavItems[0].mobileLabel}</span>
          </InstantNavLink>

          <InstantNavLink
            href={programsNavItem.href}
            tapSlop={16}
            className={cn(
              mobileNavLinkClass,
              programsActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Dumbbell className="h-5 w-5" />
            <span className="truncate">{programsNavItem.mobileLabel}</span>
          </InstantNavLink>

          {standardNavItems.slice(1).map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <InstantNavLink
                key={item.href}
                href={item.href}
                tapSlop={item.href.startsWith("/dashboard/ai") ? 16 : undefined}
                className={cn(
                  mobileNavLinkClass,
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="truncate">{item.mobileLabel}</span>
              </InstantNavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
