"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  Apple,
  BookOpen,
  Bell,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { NotificationBell } from "@/components/notification-bell";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/requests", label: "Requests", icon: Bell },
  { href: "/admin/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/admin/nutrition", label: "Nutrition", icon: Apple },
  { href: "/admin/blog", label: "Blog", icon: BookOpen },
];

export function AdminNav({
  fullName,
  unreadCount,
}: {
  fullName: string;
  unreadCount: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-card">
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
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
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
        <Link
          href="/admin/clients"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/admin/clients")
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Users className="h-4 w-4" />
          Clients
        </Link>
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
  );
}
