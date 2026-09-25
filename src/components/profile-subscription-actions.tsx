"use client";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelSubscription } from "@/lib/actions/subscriptions";
import { SarcasticGiveUpDialog } from "@/components/sarcastic-give-up-dialog";
import { Button } from "@/components/ui/button";
import {
  openAppleSubscriptionManagement,
  restoreApplePurchases,
  shouldUseAppleIap,
} from "@/lib/native-iap";

export function ProfileSubscriptionActions({
  billedViaApple = false,
  showCancel = true,
}: {
  /** When the active sub was purchased through App Store IAP. */
  billedViaApple?: boolean;
  /** Show cancel / manage subscription control. */
  showCancel?: boolean;
}) {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const router = useRouter();
  const [giveUpOpen, setGiveUpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRestoring, setIsRestoring] = useState(false);
  // Only Apple-billed subscriptions should open App Store management — not every iOS user.
  const appleManaged = billedViaApple;
  const showRestore = shouldUseAppleIap() || billedViaApple;

  if (!showCancel && !showRestore) return null;

  const handleGiveUp = () => {
    setError(null);
    startTransition(async () => {
      if (appleManaged) {
        // Apple billing is canceled only in App Store management — do not
        // flip local status here or entitlements desync from Apple.
        try {
          await openAppleSubscriptionManagement();
          setGiveUpOpen(false);
          router.refresh();
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : platform.checkoutFlow.appleProcessorNote
          );
        }
        return;
      }
      const result = await cancelSubscription();
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setGiveUpOpen(false);
      router.refresh();
    });
  };

  const handleRestore = () => {
    if (isRestoring || isPending) return;
    setError(null);
    setIsRestoring(true);
    void (async () => {
      try {
        const result = await restoreApplePurchases();
        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : platform.checkoutFlow.appleProcessorNote
        );
      } finally {
        setIsRestoring(false);
      }
    })();
  };

  const copy = coachCopy.cancelSubscription;

  return (
    <>
      <div className="flex w-full flex-col gap-2">
        {showRestore ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRestore}
            disabled={isRestoring || isPending}
            className="w-full"
          >
            {isRestoring ? platform.common.saving : "Restore purchases"}
          </Button>
        ) : null}
        {showCancel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setGiveUpOpen(true)}
            className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
          >
            {appleManaged ? platform.checkoutFlow.appleManageCta : coachLabels.giveUpOnPlan}
          </Button>
        ) : null}
      </div>
      {error && <p className="col-span-2 w-full text-sm text-red-400">{error}</p>}
      {showCancel ? (
        <SarcasticGiveUpDialog
          open={giveUpOpen}
          onClose={() => setGiveUpOpen(false)}
          onConfirm={handleGiveUp}
          isPending={isPending}
          title={appleManaged ? platform.checkoutFlow.appleManageTitle : copy.title}
          message={
            appleManaged ? platform.checkoutFlow.appleManageMessage : copy.message
          }
          confirmLabel={
            appleManaged ? platform.checkoutFlow.appleManageConfirm : copy.confirm
          }
          cancelLabel={copy.cancel}
        />
      ) : null}
    </>
  );
}
