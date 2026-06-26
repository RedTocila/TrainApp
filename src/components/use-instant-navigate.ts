"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, type MouseEvent, type PointerEvent } from "react";

const NAVIGATE_DEBOUNCE_MS = 300;

function isCurrentRoute(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type InstantNavigateOptions = {
  tapSlop?: number;
  /** Navigate on finger down — more reliable on mobile tab bars. */
  pressToNavigate?: boolean;
};

export function useInstantNavigate(
  href: string,
  tapSlopOrOptions: number | InstantNavigateOptions = 12
) {
  const options =
    typeof tapSlopOrOptions === "number"
      ? { tapSlop: tapSlopOrOptions }
      : tapSlopOrOptions;
  const { tapSlop = 12, pressToNavigate = false } = options;

  const router = useRouter();
  const pathname = usePathname();
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const navigated = useRef(false);

  const navigate = useCallback(() => {
    if (isCurrentRoute(pathname, href)) return;
    if (navigated.current) return;
    navigated.current = true;
    router.push(href);
    window.setTimeout(() => {
      navigated.current = false;
    }, NAVIGATE_DEBOUNCE_MS);
  }, [href, pathname, router]);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (pressToNavigate) {
        e.preventDefault();
        navigate();
        return;
      }
      pointerStart.current = { x: e.clientX, y: e.clientY };
    },
    [navigate, pressToNavigate]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (pressToNavigate) return;
      if (e.button !== 0 || !pointerStart.current) return;
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      pointerStart.current = null;
      if (dx > tapSlop || dy > tapSlop) return;
      e.preventDefault();
      navigate();
    },
    [navigate, pressToNavigate, tapSlop]
  );

  const handlePointerCancel = useCallback(() => {
    pointerStart.current = null;
  }, []);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (pressToNavigate) {
        e.preventDefault();
        return;
      }
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
    [navigate, pressToNavigate]
  );

  return {
    navigate,
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
  };
}

export function useInstantAction(
  action: () => void,
  tapSlopOrOptions: number | InstantNavigateOptions = 12
) {
  const options =
    typeof tapSlopOrOptions === "number"
      ? { tapSlop: tapSlopOrOptions }
      : tapSlopOrOptions;
  const { tapSlop = 12, pressToNavigate = false } = options;

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

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (pressToNavigate) {
        e.preventDefault();
        run();
        return;
      }
      pointerStart.current = { x: e.clientX, y: e.clientY };
    },
    [pressToNavigate, run]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (pressToNavigate) return;
      if (e.button !== 0 || !pointerStart.current) return;
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      pointerStart.current = null;
      if (dx > tapSlop || dy > tapSlop) return;
      e.preventDefault();
      run();
    },
    [pressToNavigate, run, tapSlop]
  );

  const handlePointerCancel = useCallback(() => {
    pointerStart.current = null;
  }, []);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (pressToNavigate) {
        e.preventDefault();
        return;
      }
      if (e.detail === 0) return;
      if (e.defaultPrevented || e.button !== 0) return;
      e.preventDefault();
      run();
    },
    [pressToNavigate, run]
  );

  return {
    run,
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
  };
}
