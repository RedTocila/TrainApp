"use client";
import { useCoachCopy, usePlatformCopy } from "@/components/locale-provider";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar, HeartPulse, Pencil, Plus, Trash2 } from "lucide-react";
import { CardioFormDialog } from "@/components/cardio-form-dialog";
import { CardioScheduleDialog } from "@/components/cardio-schedule-dialog";
import { CardioTypeGrid } from "@/components/cardio-type-grid";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import type { CardioType } from "@/lib/cardio-catalog";
import { deleteClientCardio } from "@/lib/actions/user-cardio";
import type { ClientCardio } from "@/lib/types";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function CardioListPage({ initialCardio }: { initialCardio: ClientCardio[] }) {
  const coachCopy = useCoachCopy();
  const platform = usePlatformCopy();
  const router = useRouter();
  const [cardioList, setCardioList] = useState(initialCardio);
  const [formOpen, setFormOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editing, setEditing] = useState<ClientCardio | null>(null);
  const [preset, setPreset] = useState<CardioType | null>(null);
  const [presetTitle, setPresetTitle] = useState("");
  const [scheduling, setScheduling] = useState<ClientCardio | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

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
    setPreset(null);
    setPresetTitle("");
    setFormOpen(true);
  };

  const openFromType = (type: CardioType) => {
    setEditing(null);
    setPreset(type);
    setPresetTitle(platform.cardio.types[type.id as keyof typeof platform.cardio.types] ?? type.id);
    setFormOpen(true);
  };

  const openEdit = (item: ClientCardio) => {
    setEditing(item);
    setPreset(null);
    setPresetTitle("");
    setFormOpen(true);
  };

  const openSchedule = (item: ClientCardio) => {
    setScheduling(item);
    setScheduleOpen(true);
  };

  const handleDelete = (item: ClientCardio) => {
    confirmGiveUp({
      ...coachCopy.deleteCardio(item.title),
      onConfirm: async () => {
        const result = await deleteClientCardio(item.id);
        if (!result.error) refresh();
      },
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
            <HeartPulse className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-black">{platform.cardio.title}</h1>
            <p className="text-xs text-muted-foreground">{platform.common.sessions(cardioList.length)}</p>
          </div>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {platform.common.add}
        </Button>
      </div>

      <CardioTypeGrid onSelect={openFromType} />

      {cardioList.length > 0 && (
        <h2 className="text-sm font-semibold text-muted-foreground">
          {platform.cardio.mySessions}
        </h2>
      )}

      {cardioList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <HeartPulse className="h-10 w-10 text-orange-400" />
            <div>
              <p className="font-medium">{platform.cardio.emptyTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {platform.cardio.emptyHint}
              </p>
            </div>
            <Button onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              {platform.cardio.addCardio}
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
                          <Badge variant="secondary">{platform.common.min(item.duration_minutes)}</Badge>
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
                          {platform.cardio.openYoutube}
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openSchedule(item)}>
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        {platform.cardio.schedule}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        {platform.common.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => handleDelete(item)}
                        aria-label={platform.aria.deleteItem(item.title)}
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
        preset={preset}
        presetTitle={presetTitle}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />

      <CardioScheduleDialog
        open={scheduleOpen}
        cardio={scheduling}
        onClose={() => setScheduleOpen(false)}
        onScheduled={refresh}
      />
      {giveUpDialog}
    </>
  );
}
