"use client";

import { useCallback, useState, useTransition } from "react";
import { SarcasticGiveUpDialog } from "@/components/sarcastic-give-up-dialog";

type ConfirmConfig = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
};

export function useSarcasticConfirm() {
  const [config, setConfig] = useState<ConfirmConfig | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirm = useCallback((cfg: ConfirmConfig) => {
    setConfig(cfg);
  }, []);

  const close = useCallback(() => {
    if (!isPending) setConfig(null);
  }, [isPending]);

  const handleConfirm = useCallback(() => {
    if (!config) return;
    startTransition(async () => {
      await config.onConfirm();
      setConfig(null);
    });
  }, [config]);

  const dialog = (
    <SarcasticGiveUpDialog
      open={!!config}
      onClose={close}
      onConfirm={handleConfirm}
      isPending={isPending}
      title={config?.title ?? ""}
      message={config?.message ?? ""}
      confirmLabel={config?.confirmLabel}
      cancelLabel={config?.cancelLabel}
    />
  );

  return { confirm, dialog, isPending };
}
