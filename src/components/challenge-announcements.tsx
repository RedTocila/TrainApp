"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Megaphone, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { usePlatformCopy } from "@/components/locale-provider";
import { PLATFORM_ADMIN_DISPLAY_NAME } from "@/lib/brand";
import type { ChallengeAnnouncement } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChallengeAnnouncements({
  announcements,
}: {
  announcements: ChallengeAnnouncement[];
}) {
  const copy = usePlatformCopy().challenges;
  const [open, setOpen] = useState(true);

  if (announcements.length === 0) return null;

  const fromAdminLabel = copy.announcementsFromAdmin.replace(
    "{name}",
    PLATFORM_ADMIN_DISPLAY_NAME
  );
  const latest = announcements[0];

  return (
    <section
      className="challenge-announcement-flashy challenge-announcement-flashy__enter relative overflow-hidden rounded-2xl border-2 border-red-500/50 bg-gradient-to-br from-red-500/20 via-orange-500/10 to-amber-500/15"
      aria-label={copy.announcementsTitle}
    >
      <div
        className="challenge-announcement-flashy__shimmer pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-red-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl" />

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5 sm:items-center"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/25 text-red-200 ring-2 ring-red-400/40">
              <Megaphone className="h-5 w-5 animate-pulse" />
              <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-amber-300 animate-pulse" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-red-200/90">
                {copy.announcementsTitle}
              </p>
              <p className="text-sm font-semibold text-amber-100">{fromAdminLabel}</p>
              {!open && latest && (
                <p className="mt-0.5 truncate text-sm text-red-50/90">{latest.title}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-red-400/40 bg-red-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-red-100 animate-pulse sm:inline">
              {copy.announcementsLiveBadge}
            </span>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-red-100 transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </div>
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-3 border-t border-red-400/20 px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
              {announcements.map((announcement, index) => (
                <article
                  key={announcement.id}
                  className={cn(
                    "rounded-xl border border-white/10 bg-black/25 p-4 backdrop-blur-sm",
                    index === 0 && "ring-1 ring-amber-400/30"
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-white">{announcement.title}</h3>
                    <time
                      className="text-xs font-medium text-red-100/70"
                      dateTime={announcement.created_at}
                    >
                      {format(new Date(announcement.created_at), "MMM d · h:mm a")}
                    </time>
                  </div>
                  <div className="prose prose-invert max-w-none prose-p:my-1 prose-p:text-sm prose-p:leading-relaxed prose-a:text-amber-300 prose-strong:text-white">
                    <ReactMarkdown>{announcement.body}</ReactMarkdown>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
