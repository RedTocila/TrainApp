"use client";

import { useEffect, useState } from "react";

export type VisualViewportFrame = {
  /** Offset from the layout viewport top (iOS keyboard scroll). */
  offsetTop: number;
  /** Visible height excluding the software keyboard. */
  height: number;
};

function readVisualViewportFrame(): VisualViewportFrame {
  if (typeof window === "undefined") {
    return { offsetTop: 0, height: 800 };
  }
  const vv = window.visualViewport;
  if (!vv) {
    return { offsetTop: 0, height: window.innerHeight };
  }
  return {
    offsetTop: Math.max(0, vv.offsetTop),
    height: Math.max(0, vv.height),
  };
}

/**
 * Tracks the visible viewport so overlays can sit above the software keyboard
 * and fill the usable area when the keyboard is closed.
 */
export function useVisualViewportFrame(enabled = true): VisualViewportFrame {
  const [frame, setFrame] = useState<VisualViewportFrame>(readVisualViewportFrame);

  useEffect(() => {
    if (!enabled) return;

    const sync = () => setFrame(readVisualViewportFrame());
    sync();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [enabled]);

  return frame;
}
