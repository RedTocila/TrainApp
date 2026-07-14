"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function clearDashboardMainInlineStyles() {
  const main = document.querySelector<HTMLElement>(".dashboard-main");
  if (!main) return;

  main.style.position = "";
  main.style.top = "";
  main.style.left = "";
  main.style.right = "";
  main.style.width = "";
  main.style.height = "";
  main.style.overflow = "";
  main.style.pointerEvents = "";
  main.style.touchAction = "";
}

export function scrollDashboardMainToTop() {
  const main = document.querySelector<HTMLElement>(".dashboard-main");
  if (!main) return;
  main.scrollTop = 0;
}

export function DashboardMainReset() {
  const pathname = usePathname();

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    clearDashboardMainInlineStyles();

    // Keep dashboard at the top on every route open — run twice to beat late layout.
    scrollDashboardMainToTop();
    const frame = window.requestAnimationFrame(() => {
      scrollDashboardMainToTop();
    });
    const timeout = window.setTimeout(() => {
      scrollDashboardMainToTop();
    }, 50);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [pathname]);

  return null;
}
