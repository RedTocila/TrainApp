"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { scrollToSection } from "@/lib/task-navigation";
import { scrollDashboardMainToTop } from "@/components/dashboard-main-reset";

export function ScrollToHash() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      scrollDashboardMainToTop();
      return;
    }

    const timer = window.setTimeout(() => scrollToSection(hash), 150);

    const onHashChange = () => {
      const next = window.location.hash.slice(1);
      if (next) scrollToSection(next);
      else scrollDashboardMainToTop();
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [pathname]);

  return null;
}
