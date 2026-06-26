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
}

export function DashboardMainReset() {
  const pathname = usePathname();

  useEffect(() => {
    clearDashboardMainInlineStyles();

    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (main) {
      main.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}
