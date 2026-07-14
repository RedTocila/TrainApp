"use client";

import { useEffect } from "react";

const LOCK_CLASS = "body-scroll-locked";

let lockCount = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";
let previousMainOverflow = "";
let previousMainTouchAction = "";

function getScrollRoots() {
  return {
    body: document.body,
    html: document.documentElement,
    main: document.querySelector<HTMLElement>(".dashboard-main"),
  };
}

function lockScroll() {
  const { body, html, main } = getScrollRoots();
  if (lockCount === 0) {
    previousBodyOverflow = body.style.overflow;
    previousHtmlOverflow = html.style.overflow;
    previousMainOverflow = main?.style.overflow ?? "";
    previousMainTouchAction = main?.style.touchAction ?? "";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    html.classList.add(LOCK_CLASS);
    if (main) {
      main.style.overflow = "hidden";
      main.style.touchAction = "none";
    }
  }
  lockCount += 1;
}

function unlockScroll() {
  const { body, html, main } = getScrollRoots();
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;
  body.style.overflow = previousBodyOverflow;
  html.style.overflow = previousHtmlOverflow;
  html.classList.remove(LOCK_CLASS);
  if (main) {
    main.style.overflow = previousMainOverflow;
    main.style.touchAction = previousMainTouchAction;
  }
}

function isInsideScrollableDialog(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const dialog = target.closest('[role="dialog"]');
  if (!dialog) return false;

  const scrollable = target.closest(
    "[data-scroll-lock-scrollable], .overflow-y-auto, .overflow-auto"
  );
  if (!(scrollable instanceof HTMLElement)) return false;
  return scrollable.scrollHeight > scrollable.clientHeight + 1;
}

/**
 * Locks page / dashboard scrolling and clicks while a popup is open.
 * Nested popups share a counter so unlocking one does not unlock others.
 */
export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    lockScroll();

    const onTouchMove = (event: TouchEvent) => {
      if (isInsideScrollableDialog(event.target)) return;
      event.preventDefault();
    };

    const onWheel = (event: WheelEvent) => {
      if (isInsideScrollableDialog(event.target)) return;
      event.preventDefault();
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("wheel", onWheel);
      unlockScroll();
    };
  }, [locked]);
}
