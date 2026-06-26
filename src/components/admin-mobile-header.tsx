"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { NotificationBell } from "@/components/notification-bell";

export function AdminMobileHeader({ unreadCount }: { unreadCount: number }) {
  return (
    <header className="mobile-top-safe sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
      <h1 className="text-lg font-black tracking-tight">
        COACH<span className="text-primary">PANEL</span>
      </h1>
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
  );
}
