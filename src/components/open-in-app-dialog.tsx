"use client";

import { Smartphone } from "lucide-react";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { Button } from "@/components/ui/button";
import { appLoginUrl } from "@/lib/website-signup";

export function OpenInAppDialog({
  email,
  onContinue,
}: {
  email: string;
  onContinue: () => void;
}) {
  const openApp = () => {
    window.location.assign(appLoginUrl(email));
  };

  return (
    <AppOverlay open onClose={onContinue} closeOnBackdrop={false}>
      <AppOverlayPanel
        maxWidth="max-w-md"
        dismissible={false}
        showHandle={false}
        aria-labelledby="open-app-title"
      >
        <div className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 id="open-app-title" className="text-2xl font-black tracking-tight">
              You&apos;re in
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your plan is active. Open RUTINA on your phone and sign in
              {email ? ` with ${email}` : ""}, or keep going in the browser.
            </p>
          </div>
          <div className="space-y-2">
            <Button type="button" className="w-full" onClick={openApp}>
              Open in the app
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={onContinue}>
              Continue in the browser
            </Button>
          </div>
        </div>
      </AppOverlayPanel>
    </AppOverlay>
  );
}
