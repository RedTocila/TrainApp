"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Dumbbell,
  Home,
  Apple,
  BookOpen,
  User,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppLogo } from "@/components/app-logo";
import { FullCalendarNavButton } from "@/components/full-calendar-nav-button";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/workout", label: "Workout", icon: Dumbbell },
  { href: "/dashboard/nutrition", label: "Nutrition", icon: Apple },
  { href: "/dashboard/blog", label: "Blog", icon: BookOpen },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export function ClientNav({ fullName }: { fullName: string }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="border-b border-border p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <AppLogo href="/dashboard" />
              <p className="mt-1 text-sm text-muted-foreground">Welcome, {fullName}</p>
            </div>
            <FullCalendarNavButton />
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Theme
          </p>
          <ThemeToggle variant="segmented" />
        </div>
        <form action={signOut} className="border-t border-border p-4">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="absolute -top-12 right-3">
          <ThemeToggle />
        </div>
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <motion.div whileTap={{ scale: 0.9 }}>
                  <item.icon className="h-5 w-5" />
                </motion.div>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
