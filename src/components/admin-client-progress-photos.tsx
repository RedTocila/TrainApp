"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, ImageIcon } from "lucide-react";
import type { AdminProgressPhotoMonth } from "@/lib/actions/admin-progress-photos";
import { AppDialog } from "@/components/app-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const POSE_LABELS = {
  front: "Front",
  back: "Back",
  side: "Side",
} as const;

function PoseThumb({
  label,
  url,
  onClick,
}: {
  label: string;
  url: string | null;
  onClick?: () => void;
}) {
  if (!url) {
    return (
      <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-primary/25 bg-primary/5 text-muted-foreground">
        <Camera className="h-5 w-5 text-primary/60" />
        <span className="text-[11px] font-semibold">{label}</span>
        <span className="px-1 text-center text-[9px] font-medium leading-tight text-muted-foreground/80">
          No snapshot yet
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-primary/20 bg-muted/30 shadow-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1.5 text-left text-[11px] font-semibold text-white">
        {label}
      </span>
    </button>
  );
}

export function AdminClientProgressPhotos({
  months,
}: {
  months: AdminProgressPhotoMonth[];
}) {
  const [lightbox, setLightbox] = useState<{
    monthLabel: string;
    label: string;
    url: string;
  } | null>(null);

  const latest = months[0] ?? null;
  const completeCount = months.filter((m) => m.complete).length;

  return (
    <>
      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card shadow-md ring-1 ring-primary/15">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Camera className="h-5 w-5" />
                </span>
                Progress photos
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Client snapshots — front, back, and side. Prefer live Snapshot; From
                gallery is also allowed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/15 text-primary">
                {months.length} month{months.length === 1 ? "" : "s"}
              </Badge>
              <Badge
                variant="outline"
                className="border-emerald-500/30 text-emerald-400"
              >
                {completeCount} complete
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {months.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-10 text-center">
              <ImageIcon className="h-8 w-8 text-primary/50" />
              <p className="text-sm font-semibold">No progress photos yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                When the client adds photos, Snapshot and From gallery uploads will
                show up here by month.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {latest ? (
                <div className="rounded-xl border border-primary/20 bg-background/60 p-3 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">Latest · {latest.monthLabel}</p>
                    {latest.complete ? (
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Complete set
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-400">
                        Partial — missing poses
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(Object.keys(POSE_LABELS) as Array<keyof typeof POSE_LABELS>).map(
                      (pose) => (
                        <PoseThumb
                          key={pose}
                          label={POSE_LABELS[pose]}
                          url={latest.urls[pose]}
                          onClick={
                            latest.urls[pose]
                              ? () =>
                                  setLightbox({
                                    monthLabel: latest.monthLabel,
                                    label: POSE_LABELS[pose],
                                    url: latest.urls[pose]!,
                                  })
                              : undefined
                          }
                        />
                      )
                    )}
                  </div>
                </div>
              ) : null}

              {months.length > 1 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Earlier months
                  </p>
                  {months.slice(1).map((month) => (
                    <div
                      key={month.monthKey}
                      className="rounded-xl border border-border/60 bg-secondary/10 p-3"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{month.monthLabel}</p>
                        {month.complete ? (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Complete set
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Partial
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          Object.keys(POSE_LABELS) as Array<keyof typeof POSE_LABELS>
                        ).map((pose) => (
                          <PoseThumb
                            key={pose}
                            label={POSE_LABELS[pose]}
                            url={month.urls[pose]}
                            onClick={
                              month.urls[pose]
                                ? () =>
                                    setLightbox({
                                      monthLabel: month.monthLabel,
                                      label: POSE_LABELS[pose],
                                      url: month.urls[pose]!,
                                    })
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <AppDialog
        open={lightbox != null}
        onClose={() => setLightbox(null)}
        title={lightbox ? `${lightbox.monthLabel} · ${lightbox.label}` : ""}
        className="max-w-lg"
      >
        {lightbox ? (
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl bg-muted">
            <Image
              src={lightbox.url}
              alt={`${lightbox.monthLabel} ${lightbox.label}`}
              fill
              className={cn("object-contain")}
              unoptimized
            />
          </div>
        ) : null}
      </AppDialog>
    </>
  );
}
