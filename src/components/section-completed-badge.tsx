import { cn } from "@/lib/utils";

export function SectionCompletedBadge() {
  return (
    <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-400">
      Completed
    </span>
  );
}

export function sectionCompletedCardClass(completed: boolean) {
  return cn(completed && "border-green-500/30 bg-green-500/5");
}
