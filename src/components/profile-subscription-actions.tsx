"use client";
import { useCoachCopy, useCoachLabels } from "@/components/locale-provider";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelSubscription } from "@/lib/actions/subscriptions";
import { SarcasticGiveUpDialog } from "@/components/sarcastic-give-up-dialog";
import { Button } from "@/components/ui/button";

export function ProfileSubscriptionActions() {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const router = useRouter();
  const [giveUpOpen, setGiveUpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGiveUp = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelSubscription();
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setGiveUpOpen(false);
      router.refresh();
    });
  };

  const copy = coachCopy.cancelSubscription;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setGiveUpOpen(true)}
        className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
      >
        {coachLabels.giveUpOnPlan}
      </Button>
      {error && <p className="w-full text-sm text-red-400">{error}</p>}
      <SarcasticGiveUpDialog
        open={giveUpOpen}
        onClose={() => setGiveUpOpen(false)}
        onConfirm={handleGiveUp}
        isPending={isPending}
        title={copy.title}
        message={copy.message}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
      />
    </>
  );
}
