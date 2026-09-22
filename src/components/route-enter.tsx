"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { hidesDashboardChrome } from "@/lib/train-nav";

/** CSS page-enter keyed by route — one compositor animation, no Framer cost. */
export function RouteEnter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const fadeOnly = hidesDashboardChrome(pathname);

  return (
    <div
      key={pathname}
      className={cn("page-enter", fadeOnly && "page-enter--fade", className)}
    >
      {children}
    </div>
  );
}
