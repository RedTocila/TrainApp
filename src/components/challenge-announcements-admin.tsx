"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Megaphone, Trash2 } from "lucide-react";
import {
  createChallengeAnnouncement,
  deleteChallengeAnnouncement,
} from "@/lib/actions/challenge-announcements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ChallengeAnnouncement } from "@/lib/types";

export function ChallengeAnnouncementsAdmin({
  challengeId,
  initialAnnouncements,
}: {
  challengeId: string;
  initialAnnouncements: ChallengeAnnouncement[];
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onSaved = () => {
    router.refresh();
  };

  useEffect(() => {
    setAnnouncements(initialAnnouncements);
  }, [initialAnnouncements]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Megaphone className="h-5 w-5 text-primary" />
          Announcements
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Post updates for participants — schedule changes, Zoom reminders, prize info, or anything
          else they need to know.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await createChallengeAnnouncement(challengeId, formData);
              if (result.error) {
                setError(result.error);
                return;
              }
              onSaved();
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="announcement-title">Title</Label>
            <Input
              id="announcement-title"
              name="title"
              required
              placeholder="Round 1 Zoom this Saturday"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="announcement-body">Message (Markdown supported)</Label>
            <Textarea
              id="announcement-body"
              name="body"
              rows={4}
              required
              placeholder="Join your group call at 10:00 AM. Have your progress photos ready."
              disabled={isPending}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="announcement-published"
              name="published"
              defaultChecked
              className="rounded"
              disabled={isPending}
            />
            <Label htmlFor="announcement-published">Published (visible on challenge page)</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Posting…" : "Post announcement"}
          </Button>
        </form>

        {announcements.length > 0 && (
          <ul className="space-y-3">
            {announcements.map((announcement) => (
              <li
                key={announcement.id}
                className="flex gap-3 rounded-xl border border-border/60 p-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{announcement.title}</p>
                    {!announcement.published && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {announcement.body}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(announcement.created_at), "MMM d, yyyy · h:mm a")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  aria-label="Delete announcement"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await deleteChallengeAnnouncement(
                        announcement.id,
                        challengeId
                      );
                      if (result.error) {
                        setError(result.error);
                        return;
                      }
                      setAnnouncements((prev) =>
                        prev.filter((item) => item.id !== announcement.id)
                      );
                      onSaved();
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
