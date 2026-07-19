"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** CSS page-enter keyed by route — one compositor animation, no Framer cost. */
export function RouteEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
