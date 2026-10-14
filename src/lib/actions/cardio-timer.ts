"use server";

import { revalidatePath } from "next/cache";
import { requireSubscribedMutationAdmin } from "@/lib/actions/auth-client";
import {
  readCardioTimer,
  writeCardioTimer,
  type RemoteCardioStatus,
  type RemoteCardioTimer,
} from "@/lib/cardio-timer-db";

function dateOk(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export async function getRemoteCardioTimer(
  date: string,
  cardioId: string
): Promise<{ timer: RemoteCardioTimer } | { error: string }> {
  if (!dateOk(date) || !cardioId) return { error: "Missing cardio." };
  const mutation = await requireSubscribedMutationAdmin();
  if ("error" in mutation) return { error: mutation.error };
  return readCardioTimer(mutation.admin, mutation.userId, date, cardioId);
}

export async function saveRemoteCardioTimer(input: {
  date: string;
  cardioId: string;
  status: RemoteCardioStatus;
  accumulatedMs: number;
  segmentStartedAt: number | null;
}): Promise<{ timer: RemoteCardioTimer } | { error: string }> {
  if (!dateOk(input.date) || !input.cardioId) return { error: "Missing cardio." };
  const mutation = await requireSubscribedMutationAdmin();
  if ("error" in mutation) return { error: mutation.error };

  const result = await writeCardioTimer(mutation.admin, mutation.userId, {
    date: input.date,
    cardioId: input.cardioId,
    status: input.status,
    accumulatedMs: input.accumulatedMs,
    segmentStartedAt:
      input.segmentStartedAt != null
        ? new Date(input.segmentStartedAt).toISOString()
        : null,
  });
  if ("timer" in result) {
    revalidatePath("/dashboard");
  }
  return result;
}
