"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Video,
  Bell,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { NotificationBell } from "@/components/notification-bell";

const navItems = [
  { href: "/admin", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, exact: true },
  { href: "/admin/requests", label: "Requests", shortLabel: "Requests", icon: Bell },
  { href: "/admin/classes", label: "Classes", shortLabel: "Classes", icon: Video },
  { href: "/admin/clients", label: "Clients", shortLabel: "Clients", icon: Users },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({
  fullName,
  unreadCount,
}: {
  fullName: string;
  unreadCount: number;
}) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center justify-between border-b border-border p-6">
          <div>
            <h1 className="text-xl font-black tracking-tight">
              COACH<span className="text-primary">PANEL</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{fullName}</p>
          </div>
          <NotificationBell unreadCount={unreadCount} />
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
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
        <div className="grid grid-cols-4 py-2">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-0.5 px-1 py-1 text-[9px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <motion.div whileTap={{ scale: 0.9 }}>
                  <item.icon className="h-5 w-5" />
                </motion.div>
                <span className="max-w-full truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
