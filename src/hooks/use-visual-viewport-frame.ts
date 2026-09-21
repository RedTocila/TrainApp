"use client";

import { useEffect, useState } from "react";

export type VisualViewportFrame = {
  /** Offset from the layout viewport top (iOS keyboard scroll). */
  offsetTop: number;
  /** Visible height excluding the software keyboard. */
  height: number;
  /**
   * Opaque fill from the bottom of the visual viewport downward — covers the
   * keyboard band so underlying page content cannot show through (iOS).
   */
  underlayTop: number;
  underlayHeight: number;
  /** Full mask height covering layout + keyboard band. */
  maskHeight: number;
};

function readVisualViewportFrame(): VisualViewportFrame {
  if (typeof window === "undefined") {
    return {
      offsetTop: 0,
      height: 800,
      underlayTop: 800,
      underlayHeight: 480,
      maskHeight: 1280,
    };
  }

  const vv = window.visualViewport;
  const offsetTop = vv ? Math.max(0, vv.offsetTop) : 0;
  const height = vv ? Math.max(0, vv.height) : window.innerHeight;
  const vvBottom = offsetTop + height;

  // Layout size can stay large while the visual viewport shrinks with the keyboard.
  const layoutHeight = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight,
    vvBottom
  );

  // Paint well past the keyboard / accessory bar (translucent on iOS).
  // Use a tall band so dashboard content never peeks under the chat sheet.
  const keyboardBand = Math.max(0, layoutHeight - vvBottom);
  const underlayHeight = Math.max(
    window.innerHeight,
    layoutHeight,
    keyboardBand + 320,
    720
  );
  const maskHeight = Math.max(
    layoutHeight + underlayHeight,
    vvBottom + underlayHeight,
    window.innerHeight * 2
  );

  return {
    offsetTop,
    height,
    underlayTop: Math.max(0, vvBottom - 2),
    underlayHeight,
    maskHeight,
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
