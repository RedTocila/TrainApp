"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteChallenge } from "@/lib/actions/challenges";
import { Button } from "@/components/ui/button";

export function DeleteChallengeButton({ challengeId }: { challengeId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      aria-label="Delete challenge"
      onClick={() => startTransition(() => { void deleteChallenge(challengeId); })}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
