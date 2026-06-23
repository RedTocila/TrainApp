import { cn } from "@/lib/utils";

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const pct = Math.round(confidence * 100);
  const tone =
    pct >= 80 ? "text-green-400 bg-green-500/15" : pct >= 60 ? "text-amber-400 bg-amber-500/15" : "text-orange-400 bg-orange-500/15";

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone,
        className
      )}
    >
      {pct}% confidence
    </span>
  );
}
