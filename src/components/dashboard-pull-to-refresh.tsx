"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const PULL_THRESHOLD_PX = 72;

export function DashboardPullToRefresh() {
  const router = useRouter();
  const refreshingRef = useRef(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (!main) return;

    const onTouchStart = (event: TouchEvent) => {
      if (main.scrollTop > 0 || refreshingRef.current) return;
      startYRef.current = event.touches[0]?.clientY ?? 0;
      pullingRef.current = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;
      const currentY = event.touches[0]?.clientY ?? 0;
      const delta = currentY - startYRef.current;
      if (delta > PULL_THRESHOLD_PX && main.scrollTop <= 0) {
        pullingRef.current = false;
        refreshingRef.current = true;
        router.refresh();
        window.setTimeout(() => {
          refreshingRef.current = false;
        }, 1200);
      }
    };

    const onTouchEnd = () => {
      pullingRef.current = false;
    };

    main.addEventListener("touchstart", onTouchStart, { passive: true });
    main.addEventListener("touchmove", onTouchMove, { passive: true });
    main.addEventListener("touchend", onTouchEnd);

    return () => {
      main.removeEventListener("touchstart", onTouchStart);
      main.removeEventListener("touchmove", onTouchMove);
      main.removeEventListener("touchend", onTouchEnd);
    };
  }, [router]);

  return null;
}
