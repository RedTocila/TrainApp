"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Trophy } from "lucide-react";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { InstantNavLink } from "@/components/instant-nav-link";
import { useHidesChallengesInApp } from "@/components/ios/use-native-app";
import { usePlatformCopy } from "@/components/locale-provider";
import { getHasLivePublishedChallenge } from "@/lib/actions/challenges";
import { cn } from "@/lib/utils";

export function ChallengesHeaderLink({ className }: { className?: string }) {
  const pathname = usePathname();
  const { pendingHref, setPendingHref } = useDashboardNavPending();
  const platform = usePlatformCopy();
  const hidden = useHidesChallengesInApp();
  const [live, setLive] = useState(false);
  const path = pendingHref ?? pathname;
  const active = path === "/dashboard/challenges" || path.startsWith("/dashboard/challenges/");

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    void getHasLivePublishedChallenge().then((isLive) => {
      if (!cancelled) setLive(isLive);
    });
    return () => {
      cancelled = true;
    };
  }, [hidden]);

  if (hidden) return null;

  return (
    <InstantNavLink
      href="/dashboard/challenges"
      onNavigateStart={setPendingHref}
      aria-label={platform.eliteUpgrade.challenges}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex items-center justify-center text-muted-foreground",
        active && "text-primary",
        className
      )}
    >
      <Trophy className="h-5 w-5" aria-hidden />
      {live ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background"
        />
      ) : null}
    </InstantNavLink>
  );
}
