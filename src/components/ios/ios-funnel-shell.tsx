"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isNativeApp } from "@/lib/native-app";
import { isIosAppPath } from "@/lib/ios-routes";
import { RouteEnter } from "@/components/route-enter";
import {
  IosFunnelAtmosphere,
  IOS_FUNNEL_BG,
} from "@/components/ios/ios-funnel-atmosphere";
import { cn } from "@/lib/utils";

function useIosFunnelActive(force = false): boolean {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(force || isIosAppPath(pathname));

  useEffect(() => {
    if (force) {
      setActive(true);
      return;
    }
    setActive(
      isIosAppPath(pathname) ||
        searchParams.get("from") === "ios" ||
        isNativeApp()
    );
  }, [force, pathname, searchParams]);

  return active;
}

/** Lock dark + brand red while the native funnel is on screen. */
function useIosFunnelBrand(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.classList.add("dark");
    root.classList.remove("light");
    const prevAccent = root.dataset.accent;
    const prevPrimary = root.style.getPropertyValue("--primary");
    const prevAccentColor = root.style.getPropertyValue("--accent");
    const prevRing = root.style.getPropertyValue("--ring");
    const prevRgb = root.style.getPropertyValue("--primary-rgb");
    root.dataset.accent = "red";
    root.style.setProperty("--primary", "#dc2626");
    root.style.setProperty("--accent", "#dc2626");
    root.style.setProperty("--ring", "#dc2626");
    root.style.setProperty("--primary-rgb", "220, 38, 38");
    return () => {
      if (prevAccent) root.dataset.accent = prevAccent;
      else delete root.dataset.accent;
      if (prevPrimary) root.style.setProperty("--primary", prevPrimary);
      else root.style.removeProperty("--primary");
      if (prevAccentColor) root.style.setProperty("--accent", prevAccentColor);
      else root.style.removeProperty("--accent");
      if (prevRing) root.style.setProperty("--ring", prevRing);
      else root.style.removeProperty("--ring");
      if (prevRgb) root.style.setProperty("--primary-rgb", prevRgb);
      else root.style.removeProperty("--primary-rgb");
    };
  }, [active]);
}

/**
 * Near-black + dots + red bloom shell for `/ios/*` pages.
 */
export function IosFunnelShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  useIosFunnelBrand(true);

  return (
    <div
      className={cn(
        "relative min-h-dvh overflow-hidden text-zinc-50",
        "pb-[max(1.5rem,var(--safe-area-bottom))] pt-[max(0.75rem,var(--safe-area-top))]",
        className
      )}
      style={{ backgroundColor: IOS_FUNNEL_BG }}
    >
      <IosFunnelAtmosphere />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

/**
 * Auth layout: same centered card as web; near-black + dots when native / from=ios.
 */
export function AuthLayoutClient({ children }: { children: ReactNode }) {
  const ios = useIosFunnelActive(false);
  useIosFunnelBrand(ios);

  return (
    <div
      className={cn(
        "relative flex min-h-dvh justify-center overflow-hidden px-4 py-8 sm:py-10",
        ios && "text-zinc-50"
      )}
      style={ios ? { backgroundColor: IOS_FUNNEL_BG } : undefined}
    >
      {ios ? <IosFunnelAtmosphere /> : null}
      <div className="relative z-[1] my-auto w-full max-w-md">
        <RouteEnter>{children}</RouteEnter>
      </div>
    </div>
  );
}
