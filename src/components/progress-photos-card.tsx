"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CalendarClock, ChevronRight, ImageIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  getProgressPhotoDisplaySet,
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
import { ProgressPhotoEditMenu } from "@/components/progress-photo-edit-menu";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { FullScreenFlow } from "@/components/programs/full-screen-flow";
import {
  dashboard,
  DashboardSectionHeader,
} from "@/components/dashboard-ui";
import { DashboardStatusIcon } from "@/components/section-completed-badge";
import { useCoachCopy, useLocale, usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";
import { DASHBOARD_PROGRESS_PHOTOS_PATH } from "@/lib/dashboard-day-routes";
import {
  DashboardCardNavBody,
  DashboardCardNavLink,
  dashboardInteractive,
} from "@/components/dashboard-card-nav-link";
import {
  getProgressPhotosSetsCache,
  getProgressPhotosUrlsCache,
  isProgressPhotosUrlsCacheFresh,
  setProgressPhotosSetsCache,
  setProgressPhotosUrlsCache,
  type PoseUrls,
} from "@/lib/dashboard-route-cache";

const EMPTY_URLS: PoseUrls = { front: null, back: null, side: null };

function hasPopulatedUrls(urls: PoseUrls): boolean {
  return Boolean(urls.front || urls.back || urls.side);
}

function urlsCoverSet(urls: PoseUrls, set: Pick<ProgressPhotoSet, "front_path" | "back_path" | "side_path">): boolean {
  return (["front", "back", "side"] as const).every(
    (pose) => !set[`${pose}_path`] || Boolean(urls[pose])
  );
}

type PhotoPreview = { url: string; label: string };

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
        {url && !uploading ? (
          <ProgressPhotoEditMenu
            label={label}
            disabled={uploading}
            onPick={onPick}
            onRemove={onRemove}
          />
        ) : null}
      </div>
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
  const router = useRouter();
  const locale = useLocale();
  const photoPoses = getProgressPhotoPoses(locale);
  const currentMonth = progressMonthKey();
  const cachedSets = getProgressPhotosSetsCache(clientId);
  const initialSetsResolved = cachedSets ?? initialSets;
  const [sets, setSets] = useState(initialSetsResolved);
  const displaySet = useMemo(
    () => getProgressPhotoDisplaySet(sets),
    [sets]
  );
  const [currentUrls, setCurrentUrls] = useState<PoseUrls>(() => {
    const set = getProgressPhotoDisplaySet(initialSetsResolved);
    if (!set) return EMPTY_URLS;
    const cached = getProgressPhotosUrlsCache(clientId, set.month_key);
    if (cached && hasPopulatedUrls(cached) && urlsCoverSet(cached, set)) {
      return cached;
    }
    if (
      initialCurrentUrls &&
      hasPopulatedUrls(initialCurrentUrls) &&
      urlsCoverSet(initialCurrentUrls, set)
    ) {
      return initialCurrentUrls;
    }
    return EMPTY_URLS;
  });
  const [uploadingPose, setUploadingPose] = useState<ProgressPhotoPose | null>(null);
  const [preview, setPreview] = useState<PhotoPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  useEffect(() => {
    router.prefetch(DASHBOARD_PROGRESS_PHOTOS_PATH);
  }, [router]);

  useEffect(() => {
    setProgressPhotosSetsCache(clientId, sets);
  }, [clientId, sets]);

  const currentSet = useMemo(
    () => sets.find((s) => s.month_key === currentMonth) ?? null,
    [sets, currentMonth]
  );

  const refreshSets = useCallback(() => {
    startTransition(async () => {
      const fetched = await getProgressPhotoSets(clientId);
      setSets(fetched);
      setProgressPhotosSetsCache(clientId, fetched);
      const set = getProgressPhotoDisplaySet(fetched);
      if (set && progressSetHasPhotos(set)) {
        const urls = await getSignedProgressPhotoUrls(clientId, set);
        setCurrentUrls(urls);
        setProgressPhotosUrlsCache(clientId, set.month_key, urls);
      }
    });
  }, [clientId]);

  const loadUrls = useCallback(
    async (set: ProgressPhotoSet | null) => {
      if (!set || !progressSetHasPhotos(set)) {
        setCurrentUrls(EMPTY_URLS);
        return;
      }
      const urls = await getSignedProgressPhotoUrls(clientId, set);
      setCurrentUrls(urls);
      setProgressPhotosUrlsCache(clientId, set.month_key, urls);
    },
    [clientId]
  );

  useEffect(() => {
    if (!displaySet || !progressSetHasPhotos(displaySet)) {
      setCurrentUrls(EMPTY_URLS);
      return;
    }

    const cached = getProgressPhotosUrlsCache(clientId, displaySet.month_key);
    if (
      cached &&
      hasPopulatedUrls(cached) &&
      urlsCoverSet(cached, displaySet) &&
      isProgressPhotosUrlsCacheFresh(clientId, displaySet.month_key)
    ) {
      setCurrentUrls(cached);
      return;
    }

    void loadUrls(displaySet);
  }, [clientId, displaySet, loadUrls]);

  const handleRemove = async (pose: ProgressPhotoPose) => {
    const monthKey = displaySet?.month_key ?? currentMonth;
    setError(null);
    setUploadingPose(pose);
    try {
      const result = await removeProgressPhotoPath(clientId, monthKey, pose);
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
    if (displaySet && progressSetHasPhotos(displaySet)) {
      return formatProgressCycleLabel(new Date(displaySet.created_at));
    }
    return formatProgressMonthLabel(currentMonth);
  }, [displaySet, currentMonth]);

  return (
    <>
      <div
        id="dashboard-progress-photos"
        className={cn(
          dashboard.tile,
          "relative cursor-pointer p-4 transition-opacity hover:opacity-95 active:opacity-90"
        )}
      >
        <DashboardCardNavLink
          href={DASHBOARD_PROGRESS_PHOTOS_PATH}
          ariaLabel={platform.photos.title}
        />
        <DashboardCardNavBody>
        <DashboardSectionHeader
          icon={ImageIcon}
          iconClassName="text-primary"
          title={platform.photos.title}
          subtitle={platform.photos.description}
          action={
            currentComplete ? (
              <DashboardStatusIcon
                status="completed"
                aria-label={platform.photos.monthComplete}
              />
            ) : null
          }
        />
        <div className="mt-4 space-y-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">{cycleLabel}</p>
              {countdown ? (
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
              ) : null}
            </div>
            <div className={cn("grid grid-cols-3 gap-3", dashboardInteractive)}>
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

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
        </DashboardCardNavBody>
        <ChevronRight
          className="pointer-events-none absolute bottom-4 right-4 z-[2] h-5 w-5 text-muted-foreground"
          aria-hidden
        />
      </div>

      {giveUpDialog}
      <FullScreenFlow
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.label ?? ""}
      >
        {preview ? (
          <div className="flex items-center justify-center py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt={preview.label}
              className="max-h-[min(80vh,48rem)] w-full object-contain"
            />
          </div>
        ) : null}
      </FullScreenFlow>
    </>
  );
}
