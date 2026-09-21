"use client";

import { useEffect, useState } from "react";

export type VisualViewportFrame = {
  /** Offset from the layout viewport top (iOS keyboard scroll). */
  offsetTop: number;
  /** Visible height excluding the software keyboard. */
  height: number;
  /**
   * Opaque fill from the bottom of the visual viewport downward — covers the
   * keyboard / browser-chrome band so underlying page content cannot show through.
   */
  underlayTop: number;
  underlayHeight: number;
  /** Gap between visual viewport bottom and layout bottom (keyboard + chrome). */
  keyboardBand: number;
  /** True when a software keyboard (or large chrome band) is open. */
  keyboardOpen: boolean;
};

function readVisualViewportFrame(): VisualViewportFrame {
  if (typeof window === "undefined") {
    return {
      offsetTop: 0,
      height: 800,
      underlayTop: 800,
      underlayHeight: 0,
      keyboardBand: 0,
      keyboardOpen: false,
    };
  }

  const vv = window.visualViewport;
  const offsetTop = vv ? Math.max(0, vv.offsetTop) : 0;
  const height = vv ? Math.max(0, Math.round(vv.height)) : window.innerHeight;
  const vvBottom = offsetTop + height;

  // Do NOT use scrollHeight — tall pages would look like a permanent "keyboard".
  const layoutHeight = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight,
    vvBottom
  );

  const keyboardBand = Math.max(0, layoutHeight - vvBottom);
  // Ignore tiny URL-bar / subpixel gaps; treat real keyboard as a clear shrink.
  const keyboardOpen = keyboardBand > 80;

  return {
    offsetTop,
    height,
    underlayTop: Math.max(0, vvBottom - 2),
    underlayHeight: keyboardOpen ? keyboardBand + 160 : 0,
    keyboardBand,
    keyboardOpen,
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

    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setFrame(readVisualViewportFrame());
      });
    };
    sync();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.addEventListener("focusin", sync);
    window.addEventListener("focusout", sync);

    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("focusin", sync);
      window.removeEventListener("focusout", sync);
    };
  }, [enabled]);

  return frame;
}
