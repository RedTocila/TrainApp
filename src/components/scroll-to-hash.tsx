"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { scrollToSection } from "@/lib/task-navigation";

export function ScrollToHash() {
  const pathname = usePathname();

  useEffect(() => {
    const run = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      window.setTimeout(() => scrollToSection(hash), 150);
    };

    run();
    window.addEventListener("hashchange", run);
    return () => window.removeEventListener("hashchange", run);
  }, [pathname]);

  return null;
}
