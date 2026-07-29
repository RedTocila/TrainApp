"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Tag,
  Trophy,
  Users,
  Video,
  X,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { NotificationBell } from "@/components/notification-bell";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/classes", label: "Classes", icon: Video },
  { href: "/admin/challenges", label: "Challenges", icon: Trophy },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/admin/offers", label: "Offers", icon: Tag },
  { href: "/admin/mail", label: "Mail", icon: Mail },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminMobileHeader({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="mobile-top-safe fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Open admin menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-black tracking-tight">
            COACH<span className="text-primary">PANEL</span>
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell unreadCount={unreadCount} />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[120] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-label="Close menu backdrop"
          />
          <aside className="absolute left-0 top-0 h-full w-[84%] max-w-xs border-r border-border bg-card p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-black tracking-tight">Admin Menu</h2>
              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
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
          </aside>
        </div>
      ) : null}
    </>
  );
}
