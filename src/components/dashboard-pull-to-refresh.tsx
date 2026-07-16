"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 96;
const INDICATOR_SIZE = 40;
const STROKE = 3;

function PullRefreshSpinner({
  progress,
  spinning,
}: {
  progress: number;
  spinning: boolean;
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
      aria-label={spinning ? "Refreshing" : "Pull to refresh"}
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
  const [mounted, setMounted] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refreshingRef = useRef(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const passedThresholdRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (!main) return;

    const isAtTop = () => main.scrollTop <= 0 && window.scrollY <= 0;

    const resetPull = () => {
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
      pullingRef.current = true;
      passedThresholdRef.current = false;
      setPullDistance(0);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;

      const currentY = event.touches[0]?.clientY ?? 0;
      const delta = currentY - startYRef.current;

      if (delta <= 0 || !isAtTop()) {
        setPullDistance(0);
        passedThresholdRef.current = false;
        return;
      }

      const distance = Math.min(delta * 0.55, MAX_PULL_PX);
      setPullDistance(distance);
      passedThresholdRef.current = distance >= PULL_THRESHOLD_PX * 0.55;

      // Keep the rubber-band feel from fighting the browser once past a light pull.
      if (distance > 8 && event.cancelable) {
        event.preventDefault();
      }
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
        setPullDistance(PULL_THRESHOLD_PX * 0.55);
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
  const progress = Math.min(1, pullDistance / (PULL_THRESHOLD_PX * 0.55));
  const translateY = refreshing
    ? Math.max(pullDistance, 52)
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
      <PullRefreshSpinner progress={progress} spinning={refreshing} />
    </div>,
    document.body
  );
}
