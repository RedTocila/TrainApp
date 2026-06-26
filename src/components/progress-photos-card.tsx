"use client";
import { useCoachCopy, useLocale, usePlatformCopy } from "@/components/locale-provider";

import { format } from "date-fns";
import { Check, CalendarClock, ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { compressImageFile } from "@/lib/image-compress";
import {
  getProgressPhotoSets,
  getSignedProgressPhotoUrls,
  removeProgressPhotoPath,
  saveProgressPhotoPath,
} from "@/lib/actions/progress-photos";
import {
  formatProgressCycleLabel,
  formatProgressMonthLabel,
  getProgressPhotoCountdown,
  progressMonthFolder,
  progressMonthKey,
  progressSetComplete,
  progressSetHasPhotos,
} from "@/lib/progress-photo-utils";
import { getProgressPhotoPoses } from "@/lib/locale-labels";
import { createClient } from "@/lib/supabase/client";
import {
  progressPhotoPath,
  STORAGE_BUCKETS,
  type ProgressPhotoPose,
} from "@/lib/supabase/storage";
import type { ProgressPhotoSet } from "@/lib/types";
import { ImageSourceButtons } from "@/components/image-source-buttons";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PoseUrls = Record<ProgressPhotoPose, string | null>;

const EMPTY_URLS: PoseUrls = { front: null, back: null, side: null };

type PhotoPreview = { url: string; label: string };

function PhotoPreviewOverlay({
  preview,
  onClose,
}: {
  preview: PhotoPreview;
  onClose: () => void;
}) {
  const platform = usePlatformCopy();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={platform.aria.close}
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={platform.aria.viewPhoto(preview.label)}
        className="relative z-10 flex max-h-[min(92vh,48rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">{preview.label}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={platform.aria.close}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt={preview.label}
            className="max-h-[min(75vh,40rem)] w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function PhotoSlot({
  label,
  url,
  uploading,
  onPick,
  onRemove,
  onPreview,
}: {
  label: string;
  url: string | null;
  uploading: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const platform = usePlatformCopy();
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative flex aspect-[3/4] w-full max-w-[7.5rem] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/30 sm:max-w-none",
          url && "border-solid border-border/80"
        )}
      >
        {url ? (
          <button
            type="button"
            onClick={onPreview}
            aria-label={platform.aria.viewPhoto(label)}
            className="absolute inset-0 cursor-zoom-in"
          >
            <Image
              src={url}
              alt={label}
              fill
              unoptimized
              sizes="(max-width: 640px) 120px, 150px"
              className="object-cover"
            />
          </button>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-2 py-3 text-center text-muted-foreground">
            {uploading ? (
              <span className="text-xs font-medium">{platform.photos.uploading}</span>
            ) : (
              <>
                <span className="text-[11px] font-medium">{platform.photos.addPhoto}</span>
                <ImageSourceButtons
                  layout="icon"
                  disabled={uploading}
                  onSelect={onPick}
                  galleryLabel={platform.photos.addPosePhoto(label)}
                />
              </>
            )}
          </div>
        )}
        {url && !uploading && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label={platform.aria.removePhoto(label)}
              className="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <span className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
              <Check className="h-3 w-3" />
            </span>
          </>
        )}
      </div>
      {url && !uploading && (
        <ImageSourceButtons
          layout="button"
          disabled={uploading}
          onSelect={onPick}
          galleryLabel={platform.photos.replace}
          className="h-7 w-full max-w-[7.5rem] text-xs sm:max-w-none"
        />
      )}
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

export function ProgressPhotosCard({
  clientId,
  initialSets,
  initialCurrentUrls,
}: {
  clientId: string;
  initialSets: ProgressPhotoSet[];
  initialCurrentUrls?: PoseUrls;
}) {
  const coachCopy = useCoachCopy();
  const platform = usePlatformCopy();
  const locale = useLocale();
  const photoPoses = getProgressPhotoPoses(locale);
  const currentMonth = progressMonthKey();
  const [sets, setSets] = useState(initialSets);
  const [currentUrls, setCurrentUrls] = useState<PoseUrls>(
    initialCurrentUrls ?? EMPTY_URLS
  );
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyUrls, setHistoryUrls] = useState<PoseUrls>(EMPTY_URLS);
  const [uploadingPose, setUploadingPose] = useState<ProgressPhotoPose | null>(null);
  const [preview, setPreview] = useState<PhotoPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();
  const skippedInitialUrlLoad = useRef(Boolean(initialCurrentUrls));

  const currentSet = useMemo(
    () => sets.find((s) => s.month_key === currentMonth) ?? null,
    [sets, currentMonth]
  );

  const pastSets = useMemo(
    () => sets.filter((s) => s.month_key !== currentMonth),
    [sets, currentMonth]
  );

  const selectedHistory = pastSets[historyIndex] ?? null;

  const refreshSets = useCallback(() => {
    startTransition(async () => {
      const fetched = await getProgressPhotoSets(clientId);
      setSets(fetched);
    });
  }, [clientId]);

  const loadUrls = useCallback(
    async (set: ProgressPhotoSet | null, target: "current" | "history") => {
      if (!set) {
        if (target === "current") setCurrentUrls(EMPTY_URLS);
        else setHistoryUrls(EMPTY_URLS);
        return;
      }
      const urls = await getSignedProgressPhotoUrls(clientId, set);
      if (target === "current") setCurrentUrls(urls);
      else setHistoryUrls(urls);
    },
    [clientId]
  );

  useEffect(() => {
    if (skippedInitialUrlLoad.current) {
      skippedInitialUrlLoad.current = false;
      return;
    }
    void loadUrls(currentSet, "current");
  }, [currentSet, loadUrls]);

  useEffect(() => {
    void loadUrls(selectedHistory, "history");
  }, [selectedHistory, loadUrls]);

  useEffect(() => {
    if (historyIndex >= pastSets.length) {
      setHistoryIndex(Math.max(0, pastSets.length - 1));
    }
  }, [pastSets.length, historyIndex]);

  const handleRemove = async (pose: ProgressPhotoPose) => {
    setError(null);
    setUploadingPose(pose);
    try {
      const result = await removeProgressPhotoPath(clientId, currentMonth, pose);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCurrentUrls((prev) => ({ ...prev, [pose]: null }));
      refreshSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : platform.photos.removeFailed);
    } finally {
      setUploadingPose(null);
    }
  };

  const handleUpload = async (pose: ProgressPhotoPose, file: File) => {
    setError(null);
    setUploadingPose(pose);
    try {
      const compressed = await compressImageFile(file);
      const monthFolder = progressMonthFolder(currentMonth);
      const extension = compressed.type === "image/webp" ? "webp" : "jpg";
      const path = progressPhotoPath(clientId, monthFolder, pose, extension);

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.progressPhotos)
        .upload(path, compressed, {
          upsert: true,
          cacheControl: "31536000",
          contentType: compressed.type,
        });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const result = await saveProgressPhotoPath(clientId, currentMonth, pose, path);
      if (result.error) {
        setError(result.error);
        return;
      }

      refreshSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : platform.photos.uploadFailed);
    } finally {
      setUploadingPose(null);
    }
  };

  const currentComplete = currentSet ? progressSetComplete(currentSet) : false;
  const countdown = useMemo(
    () => getProgressPhotoCountdown({ sets, currentSet }),
    [sets, currentSet]
  );
  const cycleLabel = useMemo(() => {
    if (currentSet && progressSetHasPhotos(currentSet)) {
      return formatProgressCycleLabel(new Date(currentSet.created_at));
    }
    return formatProgressMonthLabel(currentMonth);
  }, [currentSet, currentMonth]);

  return (
    <Card id="dashboard-progress-photos">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            {platform.photos.title}
            {currentComplete && (
              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-400">
                {platform.photos.monthComplete}
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {platform.photos.description}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">{cycleLabel}</p>
            {countdown && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  countdown.urgency === "complete" && "bg-primary/10 text-primary",
                  countdown.urgency === "soon" && "bg-amber-500/15 text-amber-400",
                  countdown.urgency === "normal" && "bg-secondary/50 text-muted-foreground"
                )}
              >
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                {countdown.label}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {photoPoses.map(({ pose, label }) => (
              <PhotoSlot
                key={pose}
                label={label}
                url={currentUrls[pose]}
                uploading={uploadingPose === pose || isPending}
                onPick={(file) => void handleUpload(pose, file)}
                onRemove={() => {
                  confirmGiveUp({
                    ...coachCopy.removeProgressPhoto(label),
                    onConfirm: () => handleRemove(pose),
                  });
                }}
                onPreview={() => {
                  const url = currentUrls[pose];
                  if (url) setPreview({ url, label });
                }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {platform.photos.compressHint}
          </p>
        </div>

        {pastSets.length > 0 && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{platform.photos.previousMonths}</p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={historyIndex <= 0}
                  onClick={() => setHistoryIndex((i) => i - 1)}
                  aria-label={platform.aria.earlierMonth}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[7rem] text-center text-xs text-muted-foreground">
                  {selectedHistory
                    ? formatProgressMonthLabel(selectedHistory.month_key)
                    : "—"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={historyIndex >= pastSets.length - 1}
                  onClick={() => setHistoryIndex((i) => i + 1)}
                  aria-label={platform.aria.laterMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {selectedHistory && (
              <div className="grid grid-cols-3 gap-3">
                {photoPoses.map(({ pose, label }) => (
                  <div key={pose} className="space-y-1.5">
                    {historyUrls[pose] ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreview({
                            url: historyUrls[pose]!,
                            label: `${label} · ${format(selectedHistory.month_key, "MMM yyyy")}`,
                          })
                        }
                        aria-label={platform.aria.viewPhoto(label)}
                        className="aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-secondary/20"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={historyUrls[pose]!}
                          alt={`${label} ${format(selectedHistory.month_key, "MMM yyyy")}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary/20 text-xs text-muted-foreground">
                        {platform.photos.noPhoto}
                      </div>
                    )}
                    <p className="text-center text-[11px] font-medium text-muted-foreground">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </CardContent>
      {giveUpDialog}
      {preview && (
        <PhotoPreviewOverlay preview={preview} onClose={() => setPreview(null)} />
      )}
    </Card>
  );
}
