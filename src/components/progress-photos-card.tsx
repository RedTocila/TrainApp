"use client";

import { format } from "date-fns";
import { Check, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { compressImageFile } from "@/lib/image-compress";
import {
  getProgressPhotoSets,
  getSignedProgressPhotoUrls,
  saveProgressPhotoPath,
} from "@/lib/actions/progress-photos";
import {
  formatProgressMonthLabel,
  progressMonthFolder,
  progressMonthKey,
  PROGRESS_PHOTO_POSES,
  progressSetComplete,
} from "@/lib/progress-photo-utils";
import { createClient } from "@/lib/supabase/client";
import {
  progressPhotoPath,
  STORAGE_BUCKETS,
  type ProgressPhotoPose,
} from "@/lib/supabase/storage";
import type { ProgressPhotoSet } from "@/lib/types";
import { ImageSourceButtons } from "@/components/image-source-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PoseUrls = Record<ProgressPhotoPose, string | null>;

const EMPTY_URLS: PoseUrls = { front: null, back: null, side: null };

function PhotoSlot({
  label,
  url,
  uploading,
  onPick,
}: {
  label: string;
  url: string | null;
  uploading: boolean;
  onPick: (file: File) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative flex aspect-[3/4] w-full max-w-[7.5rem] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/30 sm:max-w-none",
          url && "border-solid border-border/80"
        )}
      >
        {url ? (
          <Image
            src={url}
            alt={label}
            fill
            unoptimized
            sizes="(max-width: 640px) 120px, 150px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-2 py-3 text-center text-muted-foreground">
            {uploading ? (
              <span className="text-xs font-medium">Uploading…</span>
            ) : (
              <>
                <span className="text-[11px] font-medium">Add photo</span>
                <ImageSourceButtons
                  layout="icons"
                  disabled={uploading}
                  onSelect={onPick}
                  cameraLabel={`Take ${label} photo`}
                  galleryLabel={`Choose ${label} from gallery`}
                />
              </>
            )}
          </div>
        )}
        {url && !uploading && (
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
            <ImageSourceButtons
              layout="icons"
              disabled={uploading}
              onSelect={onPick}
              cameraLabel={`Retake ${label} photo`}
              galleryLabel={`Replace ${label} from gallery`}
            />
          </div>
        )}
        {url && !uploading && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

export function ProgressPhotosCard({
  clientId,
  initialSets,
}: {
  clientId: string;
  initialSets: ProgressPhotoSet[];
}) {
  const currentMonth = progressMonthKey();
  const [sets, setSets] = useState(initialSets);
  const [currentUrls, setCurrentUrls] = useState<PoseUrls>(EMPTY_URLS);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyUrls, setHistoryUrls] = useState<PoseUrls>(EMPTY_URLS);
  const [uploadingPose, setUploadingPose] = useState<ProgressPhotoPose | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingPose(null);
    }
  };

  const currentComplete = currentSet ? progressSetComplete(currentSet) : false;

  return (
    <Card id="dashboard-progress-photos">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Progress photos
            {currentComplete && (
              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-400">
                This month complete
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload front, back & side each month — take a photo or choose from your gallery
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-bold">{formatProgressMonthLabel(currentMonth)}</p>
          <div className="grid grid-cols-3 gap-3">
            {PROGRESS_PHOTO_POSES.map(({ pose, label }) => (
              <PhotoSlot
                key={pose}
                label={label}
                url={currentUrls[pose]}
                uploading={uploadingPose === pose || isPending}
                onPick={(file) => void handleUpload(pose, file)}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Photos are compressed before upload to save storage.
          </p>
        </div>

        {pastSets.length > 0 && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">Previous months</p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={historyIndex <= 0}
                  onClick={() => setHistoryIndex((i) => i - 1)}
                  aria-label="Earlier month"
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
                  aria-label="Later month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {selectedHistory && (
              <div className="grid grid-cols-3 gap-3">
                {PROGRESS_PHOTO_POSES.map(({ pose, label }) => (
                  <div key={pose} className="space-y-1.5">
                    <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-secondary/20">
                      {historyUrls[pose] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={historyUrls[pose]!}
                          alt={`${label} ${format(selectedHistory.month_key, "MMM yyyy")}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          No photo
                        </div>
                      )}
                    </div>
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
    </Card>
  );
}
