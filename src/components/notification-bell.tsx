"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, X } from "lucide-react";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { Button } from "@/components/ui/button";
import {
  getAdminNotifications,
  markAdminNotificationRead,
  markAdminNotificationsAllRead,
} from "@/lib/actions/admin-notifications";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";

const PANEL_WIDTH = 360;
const PANEL_GAP = 8;
const VIEWPORT_PAD = 12;

type PanelPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function positionFromBell(bell: DOMRect): PanelPosition {
  const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);
  const preferredLeft = bell.right - width;
  const left = Math.min(
    Math.max(VIEWPORT_PAD, preferredLeft),
    window.innerWidth - width - VIEWPORT_PAD
  );
  const top = Math.min(bell.bottom + PANEL_GAP, window.innerHeight - VIEWPORT_PAD);
  const maxHeight = Math.max(
    220,
    Math.min(window.innerHeight - top - VIEWPORT_PAD, window.innerHeight * 0.72)
  );

  return { top, left, width, maxHeight };
}

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const bellRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [badgeCount, setBadgeCount] = useState(unreadCount);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setBadgeCount(unreadCount);
  }, [unreadCount]);

  useLockBodyScroll(open);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }

    const updatePosition = () => {
      const rect = bellRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelPos(positionFromBell(rect));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const loadNotifications = () => {
    setLoading(true);
    startTransition(async () => {
      try {
        const next = await getAdminNotifications();
        setItems(next);
        setBadgeCount(next.filter((item) => !item.read).length);
      } finally {
        setLoading(false);
      }
    });
  };

  const handleOpen = () => {
    setOpen(true);
    loadNotifications();
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAdminNotificationsAllRead();
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
      setBadgeCount(0);
    });
  };

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markAdminNotificationRead(id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
      setBadgeCount((count) => Math.max(0, count - 1));
    });
  };

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        onClick={handleOpen}
        className="relative rounded-lg p-2 transition-colors hover:bg-secondary"
        aria-label={
          badgeCount > 0
            ? `Notifications, ${badgeCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" />
        {badgeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </button>

      {mounted && open && panelPos
        ? createPortal(
            <div className="fixed inset-0 z-[130]">
              <button
                type="button"
                aria-label="Close notifications"
                className="absolute inset-0 bg-black/40"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Notifications"
                className="absolute z-10 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
                style={{
                  top: panelPos.top,
                  left: panelPos.left,
                  width: panelPos.width,
                  maxHeight: panelPos.maxHeight,
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-black sm:text-base">Notifications</h2>
                    <p className="text-[11px] text-muted-foreground sm:text-xs">
                      {badgeCount > 0
                        ? `${badgeCount} unread`
                        : "You're all caught up"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {badgeCount > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 px-2 text-[11px] sm:text-xs"
                        disabled={isPending}
                        onClick={handleMarkAllRead}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setOpen(false)}
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div
                  data-scroll-lock-scrollable
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
                >
                  {loading && items.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Loading…
                    </p>
                  ) : items.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No notifications yet
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={cn(
                              "w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary/70",
                              !item.read && "bg-primary/5"
                            )}
                            onClick={() => {
                              if (!item.read) handleMarkRead(item.id);
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold leading-snug">
                                  {item.title}
                                </p>
                                {item.body ? (
                                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                    {item.body}
                                  </p>
                                ) : null}
                                <p className="mt-1.5 text-[11px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(item.created_at), {
                                    addSuffix: true,
                                  })}
                                </p>
                              </div>
                              {!item.read ? (
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                              ) : null}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
