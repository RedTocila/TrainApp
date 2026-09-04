"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { scrollDashboardMainToTop } from "@/lib/dashboard-scroll";

export { scrollDashboardMainToTop } from "@/lib/dashboard-scroll";

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
