"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { AppOverlay } from "@/components/app-overlay";
import { usePlatformCopy } from "@/components/locale-provider";
import { deleteOwnAccount } from "@/lib/actions/profile";
import { openAppleSubscriptionManagement, shouldUseAppleIap } from "@/lib/native-iap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteOwnAccountSection({
  appleBilled = false,
}: {
  appleBilled?: boolean;
}) {
  const platform = usePlatformCopy();
  const copy = platform.profile;
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openedAppleSettings, setOpenedAppleSettings] = useState(false);
  const [isPending, startTransition] = useTransition();

  const phrase = copy.deleteAccountPhrase;
  const matches = typed.trim() === phrase;

  useEffect(() => {
    if (!open) {
      setTyped("");
      setError(null);
      setOpenedAppleSettings(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, isPending]);

  const handleClose = () => {
    if (!isPending) setOpen(false);
  };

  const canDelete = matches && (!appleBilled || openedAppleSettings);

  const openAppleSettings = () => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        if (shouldUseAppleIap()) {
          await openAppleSubscriptionManagement();
        } else {
          window.open(
            "https://apps.apple.com/account/subscriptions",
            "_blank",
            "noopener,noreferrer"
          );
        }
        setOpenedAppleSettings(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.deleteAccountFailed);
      }
    });
  };

  const handleDelete = () => {
    if (!canDelete || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteOwnAccount(typed.trim());
      if (result?.error) {
        setError(
          result.error === "confirmation_mismatch"
            ? copy.deleteAccountMismatch
            : result.error || copy.deleteAccountFailed
        );
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="dashboard-flat-card flex w-full items-center gap-3 rounded-3xl p-4 text-left active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Trash2 className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">{copy.deleteAccount}</p>
          <p className="text-xs text-muted-foreground">{copy.deleteAccountHint}</p>
        </div>
      </button>

      <AppOverlay
        open={open}
        onClose={handleClose}
        closeOnBackdrop={!isPending}
        presentation="center"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-own-account-title"
          className="relative z-10 flex w-full max-w-md flex-col gap-5 px-4"
        >
          <div className="space-y-1.5 text-center">
            <h2
              id="delete-own-account-title"
              className="text-xl font-black leading-tight"
            >
              {copy.deleteAccountTitle}
            </h2>
            <p className="text-sm leading-snug text-muted-foreground">
              {appleBilled ? copy.deleteAccountAppleDescription : copy.deleteAccountDescription}
            </p>
          </div>

          {appleBilled ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={openAppleSettings}
              className="h-11 w-full"
            >
              {copy.deleteAccountAppleOpenSettings}
            </Button>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="delete-confirm-phrase" className="text-center sm:text-left">
              {copy.deleteAccountTypeLabel}{" "}
              <span className="font-black tracking-wide text-foreground">
                {phrase}
              </span>
            </Label>
            <Input
              id="delete-confirm-phrase"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={copy.deleteAccountPlaceholder}
              disabled={isPending}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 border-border/60 bg-background/40 font-semibold tracking-wide backdrop-blur-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleDelete();
                }
              }}
            />
          </div>

          {error ? (
            <p className="text-center text-sm text-destructive">{error}</p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={!canDelete || isPending}
              onClick={handleDelete}
              className="h-11 w-full bg-red-500/90 hover:bg-red-500"
            >
              {isPending ? copy.deleteAccountDeleting : copy.deleteAccountConfirm}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={handleClose}
              className="h-11 w-full text-muted-foreground hover:text-foreground"
            >
              {platform.common.cancel}
            </Button>
          </div>
        </div>
      </AppOverlay>
    </>
  );
}
