"use client";

import { useEffect, useState } from "react";

const FADE_MS = 280;

/**
 * Server-rendered splash that paints with the first HTML (critical CSS in root layout).
 * Fades out on client mount — React owns the node so hydration stays valid.
 * No artificial minimum display time.
 */
export function StartupSplash() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    let timeoutId = 0;
    const raf = requestAnimationFrame(() => {
      setPhase("fading");
      timeoutId = window.setTimeout(() => setPhase("gone"), FADE_MS);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      id="startup-splash"
      className={phase === "fading" ? "startup-splash startup-splash--hide" : "startup-splash"}
      aria-hidden="true"
    >
      <div className="startup-splash__mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.png" alt="" className="startup-splash__logo" />
      </div>
    </div>
  );
}
