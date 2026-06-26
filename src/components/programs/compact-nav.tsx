"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useInstantNavigate } from "@/components/use-instant-navigate";
import { cn } from "@/lib/utils";

export function CompactSegment({
  href,
  label,
  icon: Icon,
  active,
  activeClass,
  onNavigateStart,
  exactMatch = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  activeClass: string;
  onNavigateStart?: (href: string) => void;
  exactMatch?: boolean;
}) {
  const { handlePointerDown, handlePointerUp, handlePointerCancel, handleClick } =
    useInstantNavigate(href, { onNavigateStart, exactMatch });

  return (
    <Link
      href={href}
      prefetch
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
        active
          ? cn("shadow-sm", activeClass)
          : "text-muted-foreground active:opacity-80 [@media(hover:hover)]:hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

export function CompactSubLink({
  href,
  label,
  icon: Icon,
  active,
  activeClass,
  onNavigateStart,
  iconOnly,
  exactMatch = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  activeClass: string;
  onNavigateStart?: (href: string) => void;
  iconOnly?: boolean;
  exactMatch?: boolean;
}) {
  const { handlePointerDown, handlePointerUp, handlePointerCancel, handleClick } =
    useInstantNavigate(href, { onNavigateStart, exactMatch });

  return (
    <Link
      href={href}
      prefetch
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      aria-current={active ? "page" : undefined}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full text-[11px] font-semibold transition-colors touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
        iconOnly ? "h-8 w-8" : "px-3 py-1.5",
        active
          ? activeClass
          : "text-muted-foreground active:opacity-80 [@media(hover:hover)]:hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {!iconOnly && <span>{label}</span>}
    </Link>
  );
}
