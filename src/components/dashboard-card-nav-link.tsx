"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marks a zone that should capture clicks instead of the card navigation link. */
export const dashboardInteractive = "pointer-events-auto";

const interactiveDescendants =
  "[&_a]:pointer-events-auto [&_a]:relative [&_a]:z-[2] [&_button]:pointer-events-auto [&_button]:relative [&_button]:z-[2] [&_input]:pointer-events-auto [&_input]:relative [&_input]:z-[2] [&_label]:pointer-events-auto [&_label]:relative [&_label]:z-[2] [&_[role=button]]:pointer-events-auto [&_[role=button]]:relative [&_[role=button]]:z-[2]";

/** Invisible overlay link — pair with `dashboardInteractive` on control groups. */
export function DashboardCardNavLink({
  href,
  ariaLabel,
  prefetch = true,
}: {
  href: string;
  ariaLabel: string;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-label={ariaLabel}
      tabIndex={-1}
      className="absolute inset-0 z-0 rounded-[inherit]"
    />
  );
}

/** Wraps card body so only interactive descendants receive pointer events. */
export function DashboardCardNavBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pointer-events-none relative z-[1]", interactiveDescendants, className)}>
      {children}
    </div>
  );
}
