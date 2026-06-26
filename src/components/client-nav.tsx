"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
import { usePlatformCopy } from "@/components/locale-provider";
import { isTrainPath } from "@/lib/train-nav";

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

  function isNavItemActive(pathname: string, href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const sidebarLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
          <Link
            href="/dashboard"
            className={sidebarLinkClass(pathname === "/dashboard")}
          >
            <Home className="h-4 w-4" />
            {platform.nav.home}
          </Link>

          <Link
            href={programsNavItem.href}
            className={sidebarLinkClass(programsActive)}
          >
            <Dumbbell className="h-4 w-4" />
            {programsNavItem.label}
          </Link>

          {standardNavItems.slice(1).map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={sidebarLinkClass(active)}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
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

      <nav className="dashboard-mobile-nav fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="flex justify-around px-1 pt-1.5">
          <Link
            href="/dashboard"
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium leading-none",
              pathname === "/dashboard" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <motion.div whileTap={{ scale: 0.9 }}>
              <Home className="h-5 w-5" />
            </motion.div>
            <span className="truncate">{standardNavItems[0].mobileLabel}</span>
          </Link>

          <Link
            href={programsNavItem.href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium leading-none",
              programsActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <motion.div whileTap={{ scale: 0.9 }}>
              <Dumbbell className="h-5 w-5" />
            </motion.div>
            <span className="truncate">{programsNavItem.mobileLabel}</span>
          </Link>

          {standardNavItems.slice(1).map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium leading-none",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <motion.div whileTap={{ scale: 0.9 }}>
                  <item.icon className="h-5 w-5" />
                </motion.div>
                <span className="truncate">{item.mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
