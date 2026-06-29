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
      <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 bg-muted/20 text-muted-foreground">
        <ImageIcon className="h-4 w-4 opacity-50" />
        <span className="text-[10px] font-medium">{label}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-border/60 bg-muted/30"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-left text-[10px] font-semibold text-white">
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

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" />
            Progress photos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Monthly front, back, and side photos uploaded by the client.
          </p>
        </CardHeader>
        <CardContent>
          {months.length === 0 ? (
            <p className="text-sm text-muted-foreground">No progress photos yet.</p>
          ) : (
            <div className="space-y-4">
              {months.map((month) => (
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
                    {(Object.keys(POSE_LABELS) as Array<keyof typeof POSE_LABELS>).map(
                      (pose) => (
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
                      )
                    )}
                  </div>
                </div>
              ))}
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
