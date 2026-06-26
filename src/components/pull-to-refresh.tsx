"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { cn } from "@/lib/utils";

type PullToRefreshProps = {
  scrollSelector?: string;
  className?: string;
};

export function PullToRefresh({
  scrollSelector = "[data-pull-to-refresh]",
  className,
}: PullToRefreshProps) {
  const router = useRouter();
  const { pullDistance, refreshing, pullProgress } = usePullToRefresh({
    scrollSelector,
    onRefresh: () => {
      router.refresh();
    },
  });

  const visible = pullDistance > 0 || refreshing;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 z-30 flex items-end justify-center lg:hidden",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{
        top: "var(--dashboard-mobile-header-height)",
        height: Math.max(pullDistance, refreshing ? 48 : 0),
        transition: visible && !refreshing ? "none" : "height 0.2s ease, opacity 0.2s ease",
      }}
    >
      <RefreshCw
        className={cn(
          "mb-2 h-5 w-5 text-muted-foreground",
          refreshing && "animate-spin"
        )}
        style={{
          transform: refreshing ? undefined : `rotate(${pullProgress * 180}deg)`,
          opacity: refreshing ? 1 : 0.35 + pullProgress * 0.65,
        }}
      />
    </div>
  );
}
