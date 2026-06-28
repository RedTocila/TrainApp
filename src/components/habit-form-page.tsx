"use client";

import { useRouter } from "next/navigation";
import { deleteHabit } from "@/lib/actions/habits";
import { DashboardDayDetailShell } from "@/components/dashboard-day-detail-shell";
import { HabitForm } from "@/components/habit-form";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { useCoachCopy } from "@/components/locale-provider";
import type { ClientHabit } from "@/lib/types";

export function HabitFormPage({
  clientId,
  habit,
}: {
  clientId: string;
  habit?: ClientHabit | null;
}) {
  const router = useRouter();
  const coachCopy = useCoachCopy();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  const handleDelete = () => {
    if (!habit) return;
    confirmGiveUp({
      ...coachCopy.removeHabit,
      onConfirm: async () => {
        const result = await deleteHabit(habit.id);
        if (!result.error) {
          router.push("/dashboard");
          router.refresh();
        }
      },
    });
  };

  return (
    <DashboardDayDetailShell>
      <HabitForm
        clientId={clientId}
        habit={habit}
        onSaved={() => {
          router.push("/dashboard");
          router.refresh();
        }}
        onDelete={habit ? handleDelete : undefined}
      />
      {giveUpDialog}
    </DashboardDayDetailShell>
  );
}
