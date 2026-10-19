"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { InstantNavLink } from "@/components/instant-nav-link";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  isChallengesPath,
  readChallengesReturnPath,
  rememberChallengesReturnPath,
  subscribeChallengesReturn,
} from "@/lib/challenges-return-path";

/** Records the screen that opened challenges, including routes that skip the trophy link. */
export function ChallengesReturnTracker() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (isChallengesPath(pathname) && !isChallengesPath(from)) {
      rememberChallengesReturnPath(from);
    }
  }, [pathname]);

  return null;
}

/** Challenges list: return to the dashboard screen that opened this page. */
export function ChallengesCatalogBackButton() {
  const platform = usePlatformCopy();
  const { setPendingHref } = useDashboardNavPending();
  const href = useSyncExternalStore(
    subscribeChallengesReturn,
    readChallengesReturnPath,
    () => "/dashboard"
  );

  return (
    <InstantNavLink
      href={href}
      exactMatch={href === "/dashboard"}
      onNavigateStart={setPendingHref}
      aria-label={platform.common.back}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary/80"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
    </InstantNavLink>
  );
}

/** Challenge detail: step back to the previous screen, never a fixed live-classes route. */
export function ChallengeDetailBackButton() {
  const router = useRouter();
  const platform = usePlatformCopy();
  const { setPendingHref } = useDashboardNavPending();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }
        setPendingHref("/dashboard/challenges");
        router.push("/dashboard/challenges");
      }}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {platform.common.back}
    </Button>
  );
}
