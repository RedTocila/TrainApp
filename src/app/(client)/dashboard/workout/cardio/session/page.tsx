import { notFound, redirect } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import {
  getScheduledCardioById,
  getScheduledCardiosForDate,
} from "@/lib/actions/user-cardio";
import { getCardioCompletionForDate } from "@/lib/actions/task-completions";
import { ActiveCardioClient } from "@/components/active-cardio-client";
import { PageTransition } from "@/components/page-transition";
import { formatDateKey } from "@/lib/utils";

export default async function CardioSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; cardioId?: string }>;
}) {
  const profile = await requireClient();
  const params = await searchParams;
  const dateKey = params.date?.trim() || formatDateKey(new Date());
  const requestedCardioId = params.cardioId?.trim() || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    notFound();
  }

  const scheduled = requestedCardioId
    ? await getScheduledCardioById(profile.id, dateKey, requestedCardioId)
    : (await getScheduledCardiosForDate(profile.id, dateKey))[0] ?? null;

  if (!scheduled?.client_cardio) {
    redirect("/dashboard");
  }

  const cardioId = scheduled.cardio_id ?? scheduled.client_cardio.id;
  const completion = await getCardioCompletionForDate(
    profile.id,
    dateKey,
    cardioId
  );

  return (
    <PageTransition>
      <ActiveCardioClient
        clientId={profile.id}
        dateKey={dateKey}
        scheduled={scheduled}
        initiallyCompleted={completion.completed}
      />
    </PageTransition>
  );
}
