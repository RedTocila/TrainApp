"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useInstantNavigate } from "@/components/use-instant-navigate";

type InstantNavLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "onClick" | "onPointerDown" | "onPointerUp" | "onPointerCancel"
> & {
  href: string;
  children: ReactNode;
  tapSlop?: number;
  pressToNavigate?: boolean;
  onNavigateStart?: (href: string) => void;
};

export function InstantNavLink({
  href,
  children,
  prefetch = true,
  tapSlop,
  pressToNavigate,
  onNavigateStart,
  ...props
}: InstantNavLinkProps) {
  const {
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
  } = useInstantNavigate(href, { tapSlop, pressToNavigate, onNavigateStart });

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  );
}
