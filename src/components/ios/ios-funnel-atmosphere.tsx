"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** Near-black canvas used across the native funnel (darker than default card chrome). */
export const IOS_FUNNEL_BG = "#0c0c0e";

/**
 * Original welcome atmosphere: deep black, red/zinc blooms, subtle dot grid.
 * Reused by the funnel shell so every iOS step matches welcome.
 */
export function IosFunnelAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -right-16 bottom-24 h-64 w-64 rounded-full bg-zinc-700/30 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}

/** Full-bleed hero photo for the native welcome screen; fades to the funnel black behind the CTAs. */
export function IosWelcomeBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <Image
        src="/ios/welcome-bg.jpg"
        alt=""
        fill
        preload
        unoptimized
        className="object-cover object-center"
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${IOS_FUNNEL_BG}cc 0%, ${IOS_FUNNEL_BG}73 26%, transparent 42%, transparent 55%, ${IOS_FUNNEL_BG}d9 80%, ${IOS_FUNNEL_BG} 100%)`,
        }}
      />
    </div>
  );
}

export function IosFunnelCanvas({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("relative min-h-dvh overflow-hidden text-zinc-50", className)}
      style={{ backgroundColor: IOS_FUNNEL_BG }}
    >
      <IosFunnelAtmosphere />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
