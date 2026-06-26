"use client";

import Link from "next/link";
import { CalendarDays, Gift } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useFullCalendar } from "@/components/full-calendar-provider";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildReferralsHref, REFERRALS_PATH } from "@/lib/referrals-nav";

export function ReferralNavButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const platform = usePlatformCopy();

  if (pathname === REFERRALS_PATH) return null;

  const href = buildReferralsHref(pathname);

  return (
    <Link
      href={href}
      prefetch
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        router.push(href);
      }}
      className={cn(
        buttonVariants({ variant: "outline", size: "icon" }),
        "h-8 w-8 shrink-0 touch-manipulation select-none rounded-full [-webkit-tap-highlight-color:transparent] active:scale-95 sm:h-9 sm:w-9",
        className
      )}
      aria-label={platform.profile.referrals}
    >
      <Gift className="h-4 w-4" />
    </Link>
  );
}

export function FullCalendarNavButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const { openCalendar, hasCalendar } = useFullCalendar();

  if (pathname !== "/dashboard" || !hasCalendar) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("h-8 w-8 shrink-0 rounded-full sm:h-9 sm:w-9", className)}
      onClick={openCalendar}
      aria-label={platform.calendar.fullCalendar}
    >
      <CalendarDays className="h-4 w-4" />
    </Button>
  );
}

export function FullCalendarOpenButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const { openCalendar, hasCalendar } = useFullCalendar();

  if (pathname !== "/dashboard" || !hasCalendar) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-auto shrink-0 px-2 text-xs font-medium text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={openCalendar}
    >
      {platform.calendar.fullCalendar}
    </Button>
  );
}
