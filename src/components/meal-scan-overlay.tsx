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
      <div className="absolute inset-0 bg-black/55" aria-hidden />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col pt-[max(1rem,env(safe-area-inset-top,0px))] pb-4">
        {/* Full-bleed scan area */}
        <div className="relative min-h-0 w-full flex-1">
          {/* Corner brackets — accent */}
          <span
            className="pointer-events-none absolute left-3 top-3 h-10 w-10 border-l-[3px] border-t-[3px] border-primary"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute right-3 top-3 h-10 w-10 border-r-[3px] border-t-[3px] border-primary"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute bottom-3 left-3 h-10 w-10 border-b-[3px] border-l-[3px] border-primary"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute bottom-3 right-3 h-10 w-10 border-b-[3px] border-r-[3px] border-primary"
            aria-hidden
          />

          {/* Full-width scan beam + line (edge to edge) */}
          <div className="meal-scan-sweep pointer-events-none absolute inset-x-0" aria-hidden>
            <div className="h-28 w-full bg-gradient-to-b from-primary/35 to-transparent" />
            <div className="h-0.5 w-full bg-primary shadow-[0_0_16px_rgba(var(--primary-rgb),0.9)]" />
          </div>
        </div>

        <div className="flex shrink-0 justify-center px-4 pt-5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
          <p
            className="inline-flex items-center gap-2 rounded-full bg-black/85 px-5 py-2.5 text-center text-[0.7rem] font-bold uppercase tracking-[0.14em] text-primary"
            role="status"
            aria-live="polite"
          >
            <span
              className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary"
              aria-hidden
            />
            {statusLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
