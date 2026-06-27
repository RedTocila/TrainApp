"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, PlayCircle, Radio, Video } from "lucide-react";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  canJoinLive,
  getClassStatus,
  type ClassStatus,
} from "@/lib/class-utils";
import { getClassStreamUrl } from "@/lib/class-stream";
import type { FitnessClass } from "@/lib/types";
import { isValidYoutubeUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const statusLabels: Record<ClassStatus, string> = {
  upcoming: "Upcoming live",
  live: "Live now",
  replay: "Replay available",
  ended: "Session ended",
};

const statusStyles: Record<ClassStatus, string> = {
  upcoming: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  live: "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse",
  replay: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  ended: "bg-muted text-muted-foreground border-border",
};

export function ClassSessionPanel({ fitnessClass }: { fitnessClass: FitnessClass }) {
  const status = getClassStatus(fitnessClass);
  const joinable = canJoinLive(fitnessClass);
  const youtubeLive =
    joinable &&
    status !== "replay" &&
    !!fitnessClass.meeting_url &&
    isValidYoutubeUrl(fitnessClass.meeting_url);
  const streamUrl = getClassStreamUrl(
    fitnessClass.meeting_url,
    fitnessClass.replay_url,
    status === "replay"
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("border", statusStyles[status])}>
          {status === "live" && <Radio className="mr-1 h-3 w-3" />}
          {statusLabels[status]}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {format(new Date(fitnessClass.scheduled_at), "EEEE, MMMM d · h:mm a")}
          {fitnessClass.duration_minutes > 0 && ` · ${fitnessClass.duration_minutes} min`}
        </span>
      </div>

      {streamUrl && (status === "replay" || youtubeLive) && (
        <ExerciseVideoPlayer
          videoUrl={streamUrl}
          title={fitnessClass.title}
          autoplay={status === "live"}
        />
      )}

      {status !== "replay" && joinable && fitnessClass.meeting_url && !youtubeLive && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold">
                {status === "live" ? "Class is live — join now" : "Join link is open"}
              </p>
              <p className="text-sm text-muted-foreground">
                Opens in your meeting app. Link becomes available 15 minutes before start.
              </p>
            </div>
            <a
              href={fitnessClass.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ className: "shrink-0" })}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Join live class
            </a>
          </CardContent>
        </Card>
      )}

      {youtubeLive && status === "live" && (
        <p className="text-xs text-muted-foreground">
          Stream not loading?{" "}
          <a
            href={fitnessClass.meeting_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Open on YouTube
          </a>
        </p>
      )}

      {status === "upcoming" && !joinable && fitnessClass.meeting_url && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
            <Video className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              The live stream appears 15 minutes before the class starts. Add this session to your
              calendar so you don&apos;t miss it.
            </p>
          </CardContent>
        </Card>
      )}

      {status === "ended" && !fitnessClass.replay_url && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
            <PlayCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This session has ended. The replay will appear here once your coach adds the YouTube
              recording link.
            </p>
          </CardContent>
        </Card>
      )}

      {status === "replay" && fitnessClass.meeting_url && (
        <p className="text-xs text-muted-foreground">
          Missed the live session?{" "}
          <a
            href={fitnessClass.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Original YouTube link
          </a>
        </p>
      )}
    </div>
  );
}

export function ClassStatusBadge({ fitnessClass }: { fitnessClass: FitnessClass }) {
  const status = getClassStatus(fitnessClass);

  return (
    <Badge variant="outline" className={cn("border text-xs", statusStyles[status])}>
      {statusLabels[status]}
    </Badge>
  );
}

export function ClassCardAction({ fitnessClass }: { fitnessClass: FitnessClass }) {
  const status = getClassStatus(fitnessClass);

  if (status === "live" && canJoinLive(fitnessClass)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
        <Radio className="h-3 w-3" />
        Join live
      </span>
    );
  }

  if (status === "replay") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
        <PlayCircle className="h-3 w-3" />
        Watch replay
      </span>
    );
  }

  return (
    <Link href={`/dashboard/classes/${fitnessClass.slug}`} className="text-xs font-semibold text-primary">
      View details
    </Link>
  );
}
