"use client";

import { useEffect, useRef } from "react";

const PULL_THRESHOLD_PX = 72;

export function DashboardPullToRefresh() {
  const refreshingRef = useRef(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const passedThresholdRef = useRef(false);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (!main) return;

    const isAtTop = () => main.scrollTop <= 0 && window.scrollY <= 0;

    const onTouchStart = (event: TouchEvent) => {
      if (!isAtTop() || refreshingRef.current) return;
      startYRef.current = event.touches[0]?.clientY ?? 0;
      pullingRef.current = true;
      passedThresholdRef.current = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;
      const currentY = event.touches[0]?.clientY ?? 0;
      const delta = currentY - startYRef.current;
      if (delta > PULL_THRESHOLD_PX && isAtTop()) {
        passedThresholdRef.current = true;
      }
    };

    const onTouchEnd = () => {
      if (pullingRef.current && passedThresholdRef.current && isAtTop() && !refreshingRef.current) {
        refreshingRef.current = true;
        window.location.reload();
      }

      pullingRef.current = false;
      passedThresholdRef.current = false;
    };

    main.addEventListener("touchstart", onTouchStart, { passive: true });
    main.addEventListener("touchmove", onTouchMove, { passive: true });
    main.addEventListener("touchend", onTouchEnd);
    main.addEventListener("touchcancel", onTouchEnd);

    return () => {
      main.removeEventListener("touchstart", onTouchStart);
      main.removeEventListener("touchmove", onTouchMove);
      main.removeEventListener("touchend", onTouchEnd);
      main.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return null;
}
