"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useInstantAction } from "@/components/use-instant-navigate";
import { cn } from "@/lib/utils";

type InstantNavButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "onPointerDown" | "onPointerUp" | "onPointerCancel" | "type"
> & {
  children: ReactNode;
  onAction: () => void;
  tapSlop?: number;
};

export function InstantNavButton({
  children,
  onAction,
  tapSlop,
  className,
  ...props
}: InstantNavButtonProps) {
  const {
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
  } = useInstantAction(onAction, tapSlop);

  return (
    <button
      type="button"
      className={cn(className)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}
