"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar, HeartPulse, Pencil, Plus, Trash2 } from "lucide-react";
import { CardioFormDialog } from "@/components/cardio-form-dialog";
import { CardioScheduleDialog } from "@/components/cardio-schedule-dialog";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { deleteClientCardio } from "@/lib/actions/user-cardio";
import type { ClientCardio } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function CardioListPage({ initialCardio }: { initialCardio: ClientCardio[] }) {
  const router = useRouter();
  const [cardioList, setCardioList] = useState(initialCardio);
  const [formOpen, setFormOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editing, setEditing] = useState<ClientCardio | null>(null);
  const [scheduling, setScheduling] = useState<ClientCardio | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      const { getClientCardioList } = await import("@/lib/actions/user-cardio");
      const fetched = await getClientCardioList();
      setCardioList(fetched);
      router.refresh();
    });
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item: ClientCardio) => {
    setEditing(item);
    setFormOpen(true);
  };

  const openSchedule = (item: ClientCardio) => {
    setScheduling(item);
    setScheduleOpen(true);
  };

  const handleDelete = (item: ClientCardio) => {
    if (!confirm(`Delete "${item.title}"? Scheduled sessions using it will be removed.`)) return;
    startTransition(async () => {
      const result = await deleteClientCardio(item.id);
      if (!result.error) refresh();
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black">My Cardio</h1>
          <p className="text-sm text-muted-foreground">
            Save cardio sessions with YouTube links and schedule them on your calendar
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add cardio
        </Button>
      </div>

      {cardioList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <HeartPulse className="h-10 w-10 text-orange-400" />
            <div>
              <p className="font-medium">No cardio saved yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a session with a YouTube follow-along, then schedule it on your calendar.
              </p>
            </div>
            <Button onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add cardio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {cardioList.map((item) => (
            <li key={item.id}>
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.title}</p>
                        {item.duration_minutes != null && (
                          <Badge variant="secondary">{item.duration_minutes} min</Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      )}
                      {item.youtube_url && (
                        <a
                          href={item.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs text-primary hover:underline"
                        >
                          Open on YouTube
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openSchedule(item)}>
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        Schedule
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => handleDelete(item)}
                        aria-label={`Delete ${item.title}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                  {item.youtube_url && (
                    <ExerciseVideoPlayer videoUrl={item.youtube_url} title={item.title} />
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CardioFormDialog
        open={formOpen}
        cardio={editing}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />

      <CardioScheduleDialog
        open={scheduleOpen}
        cardio={scheduling}
        onClose={() => setScheduleOpen(false)}
        onScheduled={refresh}
      />
    </>
  );
}
