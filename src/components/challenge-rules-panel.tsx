import Link from "next/link";
import { BookOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { PlatformCopy } from "@/lib/platform-copy";
import { cn } from "@/lib/utils";

export function ChallengeRulesButton({
  copy,
  slug,
}: {
  copy: PlatformCopy["challenges"];
  slug: string;
}) {
  return (
    <Link
      href={`/dashboard/challenges/${slug}/rules`}
      className={cn(
        buttonVariants({ size: "sm" }),
        "border-amber-500/50 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 hover:text-amber-50"
      )}
    >
      <BookOpen className="mr-2 h-4 w-4 text-amber-300" />
      {copy.rulesAndInstructionsButton}
    </Link>
  );
}
