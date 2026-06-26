"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, type MouseEvent, type PointerEvent } from "react";

const NAVIGATE_DEBOUNCE_MS = 300;

export function useInstantNavigate(href: string, tapSlop = 12) {
  const router = useRouter();
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const navigated = useRef(false);

  const navigate = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    router.push(href);
    window.setTimeout(() => {
      navigated.current = false;
    }, NAVIGATE_DEBOUNCE_MS);
  }, [href, router]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.button !== 0) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0 || !pointerStart.current) return;
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      pointerStart.current = null;
      if (dx > tapSlop || dy > tapSlop) return;
      e.preventDefault();
      navigate();
    },
    [navigate, tapSlop]
  );

  const handlePointerCancel = useCallback(() => {
    pointerStart.current = null;
  }, []);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (e.detail === 0) return;
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      e.preventDefault();
      navigate();
    },
    [navigate]
  );

  return {
    navigate,
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
  };
}

export function useInstantAction(action: () => void, tapSlop = 12) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const run = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    action();
    window.setTimeout(() => {
      fired.current = false;
    }, NAVIGATE_DEBOUNCE_MS);
  }, [action]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.button !== 0) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0 || !pointerStart.current) return;
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      pointerStart.current = null;
      if (dx > tapSlop || dy > tapSlop) return;
      e.preventDefault();
      run();
    },
    [run, tapSlop]
  );

  const handlePointerCancel = useCallback(() => {
    pointerStart.current = null;
  }, []);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (e.detail === 0) return;
      if (e.defaultPrevented || e.button !== 0) return;
      e.preventDefault();
      run();
    },
    [run]
  );

  return {
    run,
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
  };
}
