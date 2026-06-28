"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import Image from "next/image";
import { uploadProgressPhotoWithAiReview } from "@/lib/progress-photo-upload-flow";
import {
  getProgressPhotoSets,
  removeProgressPhotoPath,
} from "@/lib/actions/progress-photos";
import {
  progressPhotoPathsKey,
  resolveProgressPhotoUrls,
  upsertPhotoPathInSets,
} from "@/lib/progress-photo-urls";
import {
  formatProgressMonthLabel,
  getProgressPhotoTimelineRows,
  progressSetHasPhotos,
  type ProgressPhotoTimelineRow,
} from "@/lib/progress-photo-utils";
import { getProgressPhotoPoses } from "@/lib/locale-labels";
import { createClient } from "@/lib/supabase/client";
import type { ProgressPhotoPose } from "@/lib/supabase/storage";
import {
  getProgressPhotosSetsCache,
  getProgressPhotosUrlsCache,
  isProgressPhotosSetsCacheFresh,
  setProgressPhotosSetsCache,
  setProgressPhotosUrlsCache,
  type PoseUrls,
} from "@/lib/dashboard-route-cache";
import { DashboardDayDetailShell } from "@/components/dashboard-day-detail-shell";
import { ImageSourceButtons } from "@/components/image-source-buttons";
import { ProgressPhotoEditMenu } from "@/components/progress-photo-edit-menu";
import { ProgressPhotoAlexDialog } from "@/components/progress-photo-alex-dialog";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { useCoachCopy, useLocale, usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ProgressPhotoSet } from "@/lib/types";

const EMPTY_URLS: PoseUrls = { front: null, back: null, side: null };

type PoseFrame = {
  url: string;
  monthKey: string;
  title: string;
};

function buildPoseFrames(
  pose: ProgressPhotoPose,
  sets: ProgressPhotoSet[],
  urlsByMonth: Map<string, PoseUrls>
): PoseFrame[] {
  return [...sets]
    .filter((set) => {
      const path =
        pose === "front"
          ? set.front_path
          : pose === "back"
            ? set.back_path
            : set.side_path;
      return Boolean(path);
    })
    .sort((a, b) => a.month_key.localeCompare(b.month_key))
    .map((set) => {
      const urls = urlsByMonth.get(set.month_key) ?? EMPTY_URLS;
      return {
        url: urls[pose]!,
        monthKey: set.month_key,
        title: formatProgressMonthLabel(set.month_key),
      };
    })
    .filter((frame) => Boolean(frame.url));
}

const photoSlotPress =
  "transition-colors touch-manipulation select-none [-webkit-tap-highlight-color:transparent] active:scale-[0.99] hover:bg-card/60";

function PhotoSlot({
  label,
  url,
  uploading,
  canUpload,
  canModify,
  onPick,
  onRemove,
  onPreview,
}: {
  label: string;
  url: string | null;
  uploading: boolean;
  canUpload: boolean;
  canModify: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const platform = usePlatformCopy();

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary/20",
          (url || canUpload) && photoSlotPress,
          !url && "border-dashed",
          url && "cursor-pointer border-solid"
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
              sizes="(max-width: 640px) 33vw, 200px"
              className="object-cover"
            />
          </button>
        ) : canUpload ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-2 py-3 text-center text-muted-foreground">
            {uploading ? (
              <span className="text-xs font-medium">{platform.photos.analyzing}</span>
            ) : (
              <>
                <span className="text-[11px] font-medium">{platform.photos.addPhoto}</span>
                <ImageSourceButtons
                  layout="icon"
                  cameraOnly
                  disabled={uploading}
                  onSelect={onPick}
                  cameraLabel={platform.photos.takePosePhoto(label)}
                />
              </>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground/70">
            —
          </div>
        )}
        {url && canModify && !uploading ? (
          <ProgressPhotoEditMenu
            label={label}
            disabled={uploading}
            onPick={onPick}
            onRemove={onRemove}
          />
        ) : null}
      </div>
      <p className="text-center text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function PoseSlider({
  frames,
  poseLabel,
  index,
  onClose,
  onIndexChange,
}: {
  frames: PoseFrame[];
  poseLabel: string;
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const frame = frames[index];
  const canPrev = index > 0;
  const canNext = index < frames.length - 1;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && canPrev) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && canNext) onIndexChange(index + 1);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [canNext, canPrev, index, onClose, onIndexChange]);

  if (!frame) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={poseLabel}
    >
      <header className="mobile-top-safe flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
            {poseLabel} · {index + 1} / {frames.length}
          </p>
          <h2 className="truncate text-lg font-bold">{frame.title}</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close"
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-8">
        {canPrev ? (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            aria-label="Previous photo"
            className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:left-4"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.url}
          alt={`${poseLabel} ${frame.title}`}
          className="max-h-[calc(100dvh-8rem)] max-w-full object-contain"
        />

        {canNext ? (
          <button
            type="button"
            onClick={() => onIndexChange(index + 1)}
            aria-label="Next photo"
            className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:right-4"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TimelineRow({
  row,
  urls,
  uploadingPose,
  onUpload,
  onRemove,
  onOpenPose,
}: {
  row: ProgressPhotoTimelineRow;
  urls: PoseUrls;
  uploadingPose: ProgressPhotoPose | null;
  onUpload: (pose: ProgressPhotoPose, file: File) => void;
  onRemove: (pose: ProgressPhotoPose) => void;
  onOpenPose: (pose: ProgressPhotoPose, monthKey: string) => void;
}) {
  const locale = useLocale();
  const platform = usePlatformCopy();
  const photoPoses = getProgressPhotoPoses(locale);

  return (
    <div
      className={cn(
        "space-y-3",
        row.isUpcoming && "border-t border-border pt-8"
      )}
    >
      <div>
        {row.isUpcoming ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {platform.photos.nextCheckIn}
          </p>
        ) : null}
        <p className={cn("text-sm font-bold", row.isUpcoming && "mt-1")}>{row.title}</p>
        {row.subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{row.subtitle}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {photoPoses.map(({ pose, label }) => (
          <PhotoSlot
            key={pose}
            label={label}
            url={row.isUpcoming ? null : urls[pose]}
            uploading={uploadingPose === pose}
            canUpload={row.canUpload}
            canModify={row.canModify && !row.isUpcoming}
            onPick={(file) => onUpload(pose, file)}
            onRemove={() => onRemove(pose)}
            onPreview={() => onOpenPose(pose, row.monthKey)}
          />
        ))}
      </div>
    </div>
  );
}

export function ProgressPhotosHistoryPage({
  clientId,
}: {
  clientId: string;
}) {
  const coachCopy = useCoachCopy();
  const platform = usePlatformCopy();
  const cachedSets = getProgressPhotosSetsCache(clientId);
  const [sets, setSets] = useState<ProgressPhotoSet[]>(cachedSets ?? []);
  const [urlsByMonth, setUrlsByMonth] = useState<Map<string, PoseUrls>>(() => {
    const map = new Map<string, PoseUrls>();
    for (const set of cachedSets ?? []) {
      const cached = getProgressPhotosUrlsCache(clientId, set.month_key);
      if (cached) map.set(set.month_key, cached.urls);
    }
    return map;
  });
  const [uploadingPose, setUploadingPose] = useState<ProgressPhotoPose | null>(null);
  const [uploadingMonth, setUploadingMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alexDialog, setAlexDialog] = useState<{
    title: string;
    message: string;
    primaryLabel?: string;
  } | null>(null);
  const [slider, setSlider] = useState<{
    pose: ProgressPhotoPose;
    index: number;
  } | null>(null);
  const [, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();
  const locale = useLocale();
  const photoPoses = getProgressPhotoPoses(locale);

  const timelineRows = useMemo(() => getProgressPhotoTimelineRows(sets), [sets]);

  const monthKeysToLoad = useMemo(
    () => [...new Set(timelineRows.map((row) => row.monthKey))],
    [timelineRows]
  );

  useEffect(() => {
    let cancelled = false;
    const setsByMonth = new Map(sets.map((set) => [set.month_key, set]));

    async function loadUrls() {
      const toLoad = monthKeysToLoad.filter((monthKey) => {
        const set = setsByMonth.get(monthKey);
        if (!set || !progressSetHasPhotos(set)) return false;
        const cached = getProgressPhotosUrlsCache(clientId, monthKey);
        return !cached || cached.pathsKey !== progressPhotoPathsKey(set);
      });

      await Promise.all(
        toLoad.map(async (monthKey) => {
          const set = setsByMonth.get(monthKey);
          if (!set || cancelled) return;

          const urls = await resolveProgressPhotoUrls(set);
          if (cancelled) return;

          const pathsKey = progressPhotoPathsKey(set);
          setProgressPhotosUrlsCache(clientId, monthKey, urls, pathsKey);
          setUrlsByMonth((prev) => {
            const next = new Map(prev);
            next.set(monthKey, urls);
            return next;
          });
        })
      );

      if (cancelled) return;

      for (const monthKey of monthKeysToLoad) {
        const set = setsByMonth.get(monthKey);
        if (!set || !progressSetHasPhotos(set)) {
          setUrlsByMonth((prev) => {
            if (prev.has(monthKey)) return prev;
            const next = new Map(prev);
            next.set(monthKey, EMPTY_URLS);
            return next;
          });
          continue;
        }

        const cached = getProgressPhotosUrlsCache(clientId, monthKey);
        if (cached && cached.pathsKey === progressPhotoPathsKey(set)) {
          setUrlsByMonth((prev) => {
            if (prev.has(monthKey)) return prev;
            const next = new Map(prev);
            next.set(monthKey, cached.urls);
            return next;
          });
        }
      }
    }

    void loadUrls();
    return () => {
      cancelled = true;
    };
  }, [clientId, monthKeysToLoad, sets]);

  useEffect(() => {
    if (isProgressPhotosSetsCacheFresh(clientId)) return;
    void getProgressPhotoSets(clientId).then((fetched) => {
      setSets(fetched);
      setProgressPhotosSetsCache(clientId, fetched);
    });
  }, [clientId]);

  const refreshSets = useCallback(() => {
    startTransition(async () => {
      const fetched = await getProgressPhotoSets(clientId);
      setSets(fetched);
      setProgressPhotosSetsCache(clientId, fetched);
    });
  }, [clientId]);

  const handleUpload = async (monthKey: string, pose: ProgressPhotoPose, file: File) => {
    setError(null);
    setUploadingPose(pose);
    setUploadingMonth(monthKey);
    try {
      const supabase = createClient();
      const result = await uploadProgressPhotoWithAiReview({
        supabase,
        clientId,
        monthKey,
        pose,
        file,
        locale,
      });

      if (result.status === "rejected") {
        setAlexDialog({
          title: platform.photos.alexWrongPhotoTitle,
          message: result.analysis.alex_message,
          primaryLabel: platform.photos.retakePhoto,
        });
        return;
      }

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      if (result.analysis?.valid && result.analysis.alex_message) {
        setAlexDialog({
          title: platform.photos.alexAcceptedTitle,
          message: result.analysis.alex_message,
          primaryLabel: platform.common.done,
        });
      }

      const nextSets = upsertPhotoPathInSets(sets, clientId, monthKey, pose, result.path);
      setSets(nextSets);
      setProgressPhotosSetsCache(clientId, nextSets);

      const updatedSet = nextSets.find((set) => set.month_key === monthKey);
      if (updatedSet) {
        const signedUrls = await resolveProgressPhotoUrls(updatedSet);
        setUrlsByMonth((prev) => {
          const next = new Map(prev);
          next.set(monthKey, signedUrls);
          return next;
        });
        setProgressPhotosUrlsCache(
          clientId,
          monthKey,
          signedUrls,
          progressPhotoPathsKey(updatedSet)
        );
      }

      refreshSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : platform.photos.uploadFailed);
    } finally {
      setUploadingPose(null);
      setUploadingMonth(null);
    }
  };

  const handleRemove = async (monthKey: string, pose: ProgressPhotoPose) => {
    setError(null);
    setUploadingPose(pose);
    setUploadingMonth(monthKey);
    try {
      const result = await removeProgressPhotoPath(clientId, monthKey, pose);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrlsByMonth((prev) => {
        const next = new Map(prev);
        const current = next.get(monthKey) ?? { ...EMPTY_URLS };
        next.set(monthKey, { ...current, [pose]: null });
        return next;
      });
      refreshSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : platform.photos.removeFailed);
    } finally {
      setUploadingPose(null);
      setUploadingMonth(null);
    }
  };

  const openPoseSlider = (pose: ProgressPhotoPose, monthKey: string) => {
    const frames = buildPoseFrames(pose, sets, urlsByMonth);
    const index = frames.findIndex((frame) => frame.monthKey === monthKey);
    if (index >= 0) {
      setSlider({ pose, index });
    }
  };

  const sliderFrames = slider
    ? buildPoseFrames(slider.pose, sets, urlsByMonth)
    : [];
  const sliderPoseLabel =
    photoPoses.find((p) => p.pose === slider?.pose)?.label ?? "";

  return (
    <>
      <DashboardDayDetailShell>
        <div className="hidden lg:block">
          <Link href="/dashboard" className="inline-flex items-center gap-2">
            <ImageIcon className="h-6 w-6 shrink-0 text-primary" />
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">
              {platform.photos.title}
            </h1>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">{platform.photos.previousMonths}</p>

        <div className="space-y-8">
          {timelineRows
            .filter((row) => !row.isUpcoming)
            .map((row) => (
              <TimelineRow
                key={`${row.monthKey}-${row.canUpload || row.canModify ? "active" : "logged"}`}
                row={row}
                urls={urlsByMonth.get(row.monthKey) ?? EMPTY_URLS}
                uploadingPose={
                  (row.canUpload || row.canModify) && uploadingMonth === row.monthKey
                    ? uploadingPose
                    : null
                }
                onUpload={(pose, file) => void handleUpload(row.monthKey, pose, file)}
                onRemove={(pose) => {
                  const poseLabel =
                    photoPoses.find((p) => p.pose === pose)?.label ?? pose;
                  confirmGiveUp({
                    ...coachCopy.removeProgressPhoto(poseLabel),
                    onConfirm: () => void handleRemove(row.monthKey, pose),
                  });
                }}
                onOpenPose={openPoseSlider}
              />
            ))}
          {timelineRows
            .filter((row) => row.isUpcoming)
            .map((row) => (
              <TimelineRow
                key="next-check-in"
                row={row}
                urls={urlsByMonth.get(row.monthKey) ?? EMPTY_URLS}
                uploadingPose={
                  uploadingMonth === row.monthKey ? uploadingPose : null
                }
                onUpload={(pose, file) => void handleUpload(row.monthKey, pose, file)}
                onRemove={(pose) => {
                  const poseLabel =
                    photoPoses.find((p) => p.pose === pose)?.label ?? pose;
                  confirmGiveUp({
                    ...coachCopy.removeProgressPhoto(poseLabel),
                    onConfirm: () => void handleRemove(row.monthKey, pose),
                  });
                }}
                onOpenPose={openPoseSlider}
              />
            ))}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
      </DashboardDayDetailShell>

      {giveUpDialog}
      <ProgressPhotoAlexDialog
        open={alexDialog !== null}
        onClose={() => setAlexDialog(null)}
        title={alexDialog?.title ?? ""}
        message={alexDialog?.message ?? ""}
        primaryLabel={alexDialog?.primaryLabel}
      />
      {slider && sliderFrames.length > 0 ? (
        <PoseSlider
          frames={sliderFrames}
          poseLabel={sliderPoseLabel}
          index={slider.index}
          onClose={() => setSlider(null)}
          onIndexChange={(index) => setSlider((prev) => (prev ? { ...prev, index } : null))}
        />
      ) : null}
    </>
  );
}
