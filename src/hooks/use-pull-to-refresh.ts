"use client";

import { useEffect, useRef, useState } from "react";

const PULL_THRESHOLD = 72;
const MAX_PULL = 120;
const PULL_RESISTANCE = 0.45;
const MIN_REFRESH_MS = 600;

type PullToRefreshOptions = {
  scrollSelector: string;
  onRefresh: () => void | Promise<void>;
  enabled?: boolean;
};

export function usePullToRefresh({
  scrollSelector,
  onRefresh,
  enabled = true,
}: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const pullDistanceRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const scrollEl = document.querySelector<HTMLElement>(scrollSelector);
    if (!scrollEl) return;

    const resetPull = () => {
      pullingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current || scrollEl.scrollTop > 0) return;

      const touch = event.touches[0];
      touchStartYRef.current = touch.clientY;
      touchStartXRef.current = touch.clientX;
      pullingRef.current = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;

      if (scrollEl.scrollTop > 0) {
        resetPull();
        return;
      }

      const touch = event.touches[0];
      const deltaY = touch.clientY - touchStartYRef.current;
      const deltaX = touch.clientX - touchStartXRef.current;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        resetPull();
        return;
      }

      if (deltaY > 0) {
        event.preventDefault();
        const distance = Math.min(deltaY * PULL_RESISTANCE, MAX_PULL);
        pullDistanceRef.current = distance;
        setPullDistance(distance);
        return;
      }

      resetPull();
    };

    const finishPull = async () => {
      if (!pullingRef.current || refreshingRef.current) return;

      pullingRef.current = false;
      const distance = pullDistanceRef.current;

      if (distance < PULL_THRESHOLD) {
        resetPull();
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      pullDistanceRef.current = PULL_THRESHOLD;
      setPullDistance(PULL_THRESHOLD);

      const refreshStartedAt = Date.now();

      try {
        await onRefreshRef.current();
      } finally {
        const elapsed = Date.now() - refreshStartedAt;
        const remaining = Math.max(0, MIN_REFRESH_MS - elapsed);
        window.setTimeout(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          resetPull();
        }, remaining);
      }
    };

    scrollEl.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollEl.addEventListener("touchmove", onTouchMove, { passive: false });
    scrollEl.addEventListener("touchend", finishPull);
    scrollEl.addEventListener("touchcancel", finishPull);

    return () => {
      scrollEl.removeEventListener("touchstart", onTouchStart);
      scrollEl.removeEventListener("touchmove", onTouchMove);
      scrollEl.removeEventListener("touchend", finishPull);
      scrollEl.removeEventListener("touchcancel", finishPull);
    };
  }, [enabled, scrollSelector]);

  return {
    pullDistance,
    refreshing,
    pullProgress: Math.min(pullDistance / PULL_THRESHOLD, 1),
    pullThreshold: PULL_THRESHOLD,
  };
}
