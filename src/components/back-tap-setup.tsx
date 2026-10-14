"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { usePlatformCopy } from "@/components/locale-provider";
import { prepareBackTapShortcut } from "@/lib/live-workout";

/** iPhone-only. Back Tap lists saved Shortcuts, so this adds Current set first. */
export function BackTapSetup() {
  const platform = usePlatformCopy();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios");
  }, []);

  if (!visible) return null;

  return (
    <div className="text-center">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {platform.workout.backTapHint}
      </p>
      <button
        type="button"
        className="mt-1 text-[12px] font-semibold text-primary"
        onClick={() =>
          void prepareBackTapShortcut({
            title: platform.workout.quickSet,
            message: platform.workout.backTapHint,
            dismiss: platform.common.done,
          })
        }
      >
        {platform.workout.backTapAdd}
      </button>
    </div>
  );
}
