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
  /** Full mask height covering layout + keyboard band. */
  maskHeight: number;
};

function readVisualViewportFrame(): VisualViewportFrame {
  if (typeof window === "undefined") {
    return {
      offsetTop: 0,
      height: 800,
      underlayTop: 800,
      underlayHeight: 800,
      keyboardBand: 0,
      maskHeight: 1600,
    };
  }

  const vv = window.visualViewport;
  const offsetTop = vv ? Math.max(0, vv.offsetTop) : 0;
  const height = vv ? Math.max(0, Math.round(vv.height)) : window.innerHeight;
  const vvBottom = offsetTop + height;

  // Layout size can stay large while the visual viewport shrinks with the keyboard.
  const layoutHeight = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    vvBottom
  );

  // Include browser chrome / accessory bar that sits above the keys (often translucent).
  const keyboardBand = Math.max(0, layoutHeight - vvBottom);
  const underlayHeight = Math.max(
    keyboardBand + 480,
    window.innerHeight,
    layoutHeight - vvBottom + 480,
    900
  );
  const maskHeight = Math.max(
    layoutHeight + underlayHeight,
    vvBottom + underlayHeight,
    offsetTop + height + underlayHeight,
    window.innerHeight * 2
  );

  return {
    offsetTop,
    height,
    underlayTop: Math.max(0, vvBottom - 4),
    underlayHeight,
    keyboardBand,
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
    // Keyboard animation often finishes after the first resize event.
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
