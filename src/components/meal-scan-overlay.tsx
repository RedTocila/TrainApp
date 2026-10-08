"use client";

import { cn } from "@/lib/utils";

export function MealScanOverlay({
  imageUrl,
  statusLabel,
  imageAlt,
  className,
}: {
  imageUrl?: string | null;
  statusLabel: string;
  imageAlt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[80] flex flex-col bg-black",
        className
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-950" aria-hidden />
      )}
      <div className="absolute inset-0 bg-black/25" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.55)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/75 via-black/35 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <div className="relative min-h-0 w-full flex-1">
          <div
            className="pointer-events-none absolute inset-4 rounded-[1.75rem] border border-white/10"
            aria-hidden
          />
          <span className="meal-scan-corner meal-scan-corner--tl" aria-hidden />
          <span className="meal-scan-corner meal-scan-corner--tr" aria-hidden />
          <span className="meal-scan-corner meal-scan-corner--bl" aria-hidden />
          <span className="meal-scan-corner meal-scan-corner--br" aria-hidden />

          <div className="meal-scan-sweep pointer-events-none absolute inset-x-0" aria-hidden>
            <div className="meal-scan-fade meal-scan-fade--up" />
            <div className="meal-scan-fade meal-scan-fade--down" />
            <div className="meal-scan-line" />
          </div>
        </div>

        <div className="flex shrink-0 justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-3">
          <p
            className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-center text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/95 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
            role="status"
            aria-live="polite"
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.95)]" />
            </span>
            {statusLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
