"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect } from "react";

export function usePrefetchRoutes(routes: readonly string[]) {
  const router = useRouter();

  useLayoutEffect(() => {
    for (const href of routes) {
      try {
        router.prefetch(href);
      } catch {
        // Prefetch is best-effort.
      }
    }
  }, [router, routes]);
}
