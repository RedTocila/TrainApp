"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function usePrefetchRoutes(routes: readonly string[]) {
  const router = useRouter();

  useEffect(() => {
    for (const href of routes) {
      router.prefetch(href);
    }
  }, [router, routes]);
}
