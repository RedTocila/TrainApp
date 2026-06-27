"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { registerForChallenge } from "@/lib/actions/challenge-bracket";
import { Button } from "@/components/ui/button";

export function ChallengeRegisterButton({
  challengeId,
  isRegistered,
}: {
  challengeId: string;
  isRegistered: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isRegistered) {
    return (
      <p className="text-sm font-medium text-emerald-400">
        You are registered for this challenge.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await registerForChallenge(challengeId);
            if (result.error) setError(result.error);
          });
        }}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        {isPending ? "Registering…" : "Register for challenge"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
