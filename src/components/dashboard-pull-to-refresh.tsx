"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

/** Finger travel (px) required before refresh arms. */
const PULL_THRESHOLD_PX = 72;
const PULL_RESISTANCE = 0.45;
const MAX_PULL_PX = 72;
const INDICATOR_SIZE = 40;
const STROKE = 3;

function PullRefreshSpinner({
  progress,
  spinning,
  refreshingLabel,
  pullLabel,
}: {
  progress: number;
  spinning: boolean;
  refreshingLabel: string;
  pullLabel: string;
}) {
  const radius = (INDICATOR_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);

  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/95 shadow-md backdrop-blur-sm",
        spinning && "animate-spin"
      )}
      role="status"
      aria-live="polite"
      aria-label={spinning ? refreshingLabel : pullLabel}
    >
      <svg
        width={INDICATOR_SIZE}
        height={INDICATOR_SIZE}
        viewBox={`0 0 ${INDICATOR_SIZE} ${INDICATOR_SIZE}`}
        className={cn(!spinning && "-rotate-90")}
        aria-hidden
      >
        <circle
          cx={INDICATOR_SIZE / 2}
          cy={INDICATOR_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted-foreground/25"
        />
        <circle
          cx={INDICATOR_SIZE / 2}
          cy={INDICATOR_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={spinning ? circumference * 0.25 : offset}
          className="stroke-primary transition-[stroke-dashoffset] duration-75 ease-out"
        />
      </svg>
    </div>
  );
}

export function DashboardPullToRefresh() {
  const platform = usePlatformCopy();
  const [mounted, setMounted] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refreshingRef = useRef(false);
  const startYRef = useRef(0);
  const trackingRef = useRef(false);
  const pullingRef = useRef(false);
  const passedThresholdRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (!main) return;

    const isAtTop = () => {
      if (window.scrollY > 0) return false;
      if (main.scrollTop > 0) return false;
      return true;
    };

    const resetPull = () => {
      trackingRef.current = false;
      pullingRef.current = false;
      passedThresholdRef.current = false;
      startYRef.current = 0;
      if (!refreshingRef.current) {
        setPullDistance(0);
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!isAtTop() || refreshingRef.current) return;
      startYRef.current = event.touches[0]?.clientY ?? 0;
      trackingRef.current = true;
      pullingRef.current = false;
      passedThresholdRef.current = false;
      setPullDistance(0);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!trackingRef.current || refreshingRef.current) return;

      const currentY = event.touches[0]?.clientY ?? 0;
      const delta = currentY - startYRef.current;

      // Scrolling content (finger up) — release tracking so overscroll never engages.
      if (delta <= 0 || !isAtTop()) {
        if (pullingRef.current) {
          setPullDistance(0);
        }
        pullingRef.current = false;
        passedThresholdRef.current = false;
        if (delta < -8 || !isAtTop()) {
          trackingRef.current = false;
        }
        return;
      }

      // Kill iOS rubber-band as soon as the finger pulls down at the top.
      if (event.cancelable) {
        event.preventDefault();
      }

      pullingRef.current = true;
      const distance = Math.min(delta * PULL_RESISTANCE, MAX_PULL_PX);
      setPullDistance(distance);
      passedThresholdRef.current = delta >= PULL_THRESHOLD_PX;
    };

    const onTouchEnd = () => {
      if (
        pullingRef.current &&
        passedThresholdRef.current &&
        isAtTop() &&
        !refreshingRef.current
      ) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullDistance(MAX_PULL_PX);
        window.setTimeout(() => {
          window.location.reload();
        }, 280);
        return;
      }

      resetPull();
    };

    main.addEventListener("touchstart", onTouchStart, { passive: true });
    main.addEventListener("touchmove", onTouchMove, { passive: false });
    main.addEventListener("touchend", onTouchEnd);
    main.addEventListener("touchcancel", onTouchEnd);

    return () => {
      main.removeEventListener("touchstart", onTouchStart);
      main.removeEventListener("touchmove", onTouchMove);
      main.removeEventListener("touchend", onTouchEnd);
      main.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  if (!mounted) return null;

  const visible = pullDistance > 4 || refreshing;
  const progress = Math.min(1, pullDistance / MAX_PULL_PX);
  const translateY = refreshing
    ? Math.max(pullDistance, 56)
    : Math.max(0, pullDistance);

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed left-0 right-0 z-[120] flex justify-center transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{
        top: "max(0.75rem, var(--safe-area-top))",
        transform: `translateY(${translateY}px)`,
      }}
      aria-hidden={!visible}
    >
      <PullRefreshSpinner
        progress={progress}
        spinning={refreshing}
        refreshingLabel={platform.common.refreshing}
        pullLabel={platform.common.pullToRefresh}
      />
    </div>,
    document.body
  );
}
