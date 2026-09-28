"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Button label that shows `full` when it fits on one line and swaps to `short`
 * (instead of an ellipsis) when it doesn't. Place directly inside the button.
 */
export function FitLabel({
  full,
  short,
  className,
}: {
  full: string;
  short: string;
  className?: string;
}) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const probeWrapRef = useRef<HTMLSpanElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [useShort, setUseShort] = useState(false);

  useLayoutEffect(() => {
    const label = labelRef.current;
    const probe = probeRef.current;
    const parent = label?.parentElement;
    if (!label || !probe || !parent) return;

    const measure = () => {
      const style = getComputedStyle(parent);
      const flowChildren = Array.from(parent.children).filter(
        (child) =>
          child !== probeWrapRef.current &&
          getComputedStyle(child).position !== "absolute"
      );
      const siblingsWidth = flowChildren
        .filter((child) => child !== label)
        .reduce((sum, child) => sum + (child as HTMLElement).offsetWidth, 0);
      const gap = parseFloat(style.columnGap) || 0;
      const available =
        parent.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0) -
        siblingsWidth -
        gap * Math.max(0, flowChildren.length - 1);
      setUseShort(probe.offsetWidth > available + 0.5);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [full]);

  return (
    <>
      <span ref={labelRef} className={cn("min-w-0 truncate", className)}>
        {useShort ? short : full}
      </span>
      <span
        ref={probeWrapRef}
        aria-hidden
        className="pointer-events-none invisible absolute h-0 w-0 overflow-hidden"
      >
        <span ref={probeRef} className={cn("whitespace-nowrap", className)}>
          {full}
        </span>
      </span>
    </>
  );
}
