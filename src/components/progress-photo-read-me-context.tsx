"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CoachReadMeDialog } from "@/components/coach-read-me-dialog";
import { SupportContactButton } from "@/components/support-contact-button";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  hasProgressPhotoReadMeAcknowledged,
  setProgressPhotoReadMeAcknowledged,
} from "@/lib/progress-photo-read-me-storage";

type ProgressPhotoReadMeContextValue = {
  canUploadPhotos: boolean;
  hydrated: boolean;
  readMeOpen: boolean;
  openReadMe: () => void;
  closeReadMe: () => void;
  ensureCanUpload: () => boolean;
};

const ProgressPhotoReadMeContext = createContext<ProgressPhotoReadMeContextValue | null>(
  null
);

export function ProgressPhotoReadMeProvider({
  clientId,
  autoPrompt = false,
  children,
}: {
  clientId: string;
  autoPrompt?: boolean;
  children: ReactNode;
}) {
  const platform = usePlatformCopy();
  const [hydrated, setHydrated] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [readMeOpen, setReadMeOpen] = useState(false);

  useEffect(() => {
    const acked = hasProgressPhotoReadMeAcknowledged(clientId);
    setHasAcknowledged(acked);
    setHydrated(true);
    if (autoPrompt && !acked) {
      setReadMeOpen(true);
    }
  }, [clientId, autoPrompt]);

  const acknowledgeReadMe = useCallback(() => {
    setProgressPhotoReadMeAcknowledged(clientId);
    setHasAcknowledged(true);
    setReadMeOpen(false);
  }, [clientId]);

  const openReadMe = useCallback(() => setReadMeOpen(true), []);

  const closeReadMe = useCallback(() => {
    setReadMeOpen(false);
  }, []);

  const ensureCanUpload = useCallback(() => {
    if (hasAcknowledged) return true;
    setReadMeOpen(true);
    return false;
  }, [hasAcknowledged]);

  const value = useMemo(
    () => ({
      canUploadPhotos: hydrated && hasAcknowledged,
      hydrated,
      readMeOpen,
      openReadMe,
      closeReadMe,
      ensureCanUpload,
    }),
    [hydrated, hasAcknowledged, readMeOpen, openReadMe, closeReadMe, ensureCanUpload]
  );

  return (
    <ProgressPhotoReadMeContext.Provider value={value}>
      {children}
      <CoachReadMeDialog
        open={readMeOpen}
        onClose={closeReadMe}
        onAccept={acknowledgeReadMe}
        title={platform.photos.readMeTitle}
        points={platform.photos.readMeBody}
        gotItLabel={platform.photos.readMeGotIt}
        agreeLabel={platform.photos.readMeAgreeLabel}
        required={!hasAcknowledged}
        footer={
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
            <span>{platform.photos.readMeSupportHint}</span>
            <SupportContactButton className="inline-flex" buttonClassName="h-7 w-7" />
          </div>
        }
      />
    </ProgressPhotoReadMeContext.Provider>
  );
}

export function useProgressPhotoReadMe() {
  const context = useContext(ProgressPhotoReadMeContext);
  if (!context) {
    throw new Error(
      "useProgressPhotoReadMe must be used within ProgressPhotoReadMeProvider"
    );
  }
  return context;
}
