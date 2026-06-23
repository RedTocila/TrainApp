"use client";

export function AiFoodDemoIllustration() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-secondary/40 p-4">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        How AI meal logging works
      </p>
      <div className="grid grid-cols-3 items-center gap-2 text-center sm:gap-4">
        <div className="space-y-2">
          <div className="mx-auto flex h-20 w-16 items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 sm:h-24 sm:w-20">
            <span className="text-2xl sm:text-3xl" aria-hidden>
              📷
            </span>
          </div>
          <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Take a photo</p>
        </div>
        <div className="text-primary">
          <svg viewBox="0 0 24 24" className="mx-auto h-6 w-6 sm:h-8 sm:w-8" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="space-y-2">
          <div className="mx-auto rounded-lg border border-green-500/30 bg-green-500/10 p-2 sm:p-3">
            <p className="text-xs font-semibold text-green-400 sm:text-sm">Grilled chicken bowl</p>
            <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
              520 cal · 42g P · 38g C · 18g F
            </p>
          </div>
          <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Macros filled</p>
        </div>
      </div>
    </div>
  );
}
