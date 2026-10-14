import type { SupabaseClient } from "@supabase/supabase-js";

export type RemoteCardioStatus = "idle" | "running" | "paused";

export type RemoteCardioTimer = {
  status: RemoteCardioStatus;
  accumulatedMs: number;
  segmentStartedAt: string | null;
  updatedAt: string;
};

type CardioTimerRow = {
  status: RemoteCardioStatus;
  accumulated_ms: number;
  segment_started_at: string | null;
  updated_at: string;
};

const COLUMNS = "status, accumulated_ms, segment_started_at, updated_at";

export function remoteCardioElapsedMs(
  timer: RemoteCardioTimer,
  now = Date.now()
): number {
  const extra =
    timer.status === "running" && timer.segmentStartedAt
      ? Math.max(0, now - Date.parse(timer.segmentStartedAt))
      : 0;
  return Math.max(0, timer.accumulatedMs + (Number.isFinite(extra) ? extra : 0));
}

function idleTimer(): RemoteCardioTimer {
  return {
    status: "idle",
    accumulatedMs: 0,
    segmentStartedAt: null,
    updatedAt: new Date(0).toISOString(),
  };
}

function mapRow(row: CardioTimerRow | null): RemoteCardioTimer {
  if (!row) return idleTimer();
  const status: RemoteCardioStatus =
    row.status === "running" || row.status === "paused" ? row.status : "idle";
  return {
    status,
    accumulatedMs: row.accumulated_ms ?? 0,
    segmentStartedAt: status === "idle" ? null : row.segment_started_at,
    updatedAt: row.updated_at,
  };
}

export function cardioTimerSetupError(message: string): string | null {
  if (/cardio_timers|schema cache/i.test(message)) {
    return "Cardio sync needs the latest database update.";
  }
  return null;
}

export async function readCardioTimer(
  admin: SupabaseClient,
  userId: string,
  date: string,
  cardioId: string
): Promise<{ timer: RemoteCardioTimer } | { error: string }> {
  const { data, error } = await admin
    .from("cardio_timers")
    .select(COLUMNS)
    .eq("client_id", userId)
    .eq("scheduled_date", date)
    .eq("cardio_id", cardioId)
    .maybeSingle();

  if (error) {
    return { error: cardioTimerSetupError(error.message) ?? error.message };
  }
  return { timer: mapRow((data as CardioTimerRow | null) ?? null) };
}

export async function writeCardioTimer(
  admin: SupabaseClient,
  userId: string,
  input: {
    date: string;
    cardioId: string;
    status: RemoteCardioStatus;
    accumulatedMs: number;
    segmentStartedAt: string | null;
  }
): Promise<{ timer: RemoteCardioTimer } | { error: string }> {
  if (input.status === "idle") {
    const updatedAt = new Date().toISOString();
    const { data, error } = await admin
      .from("cardio_timers")
      .upsert(
        {
          client_id: userId,
          scheduled_date: input.date,
          cardio_id: input.cardioId,
          status: "idle",
          accumulated_ms: 0,
          segment_started_at: null,
          updated_at: updatedAt,
        },
        { onConflict: "client_id,scheduled_date,cardio_id" }
      )
      .select(COLUMNS)
      .single();
    if (error) {
      return { error: cardioTimerSetupError(error.message) ?? error.message };
    }
    return { timer: mapRow(data as CardioTimerRow) };
  }

  const updatedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("cardio_timers")
    .upsert(
      {
        client_id: userId,
        scheduled_date: input.date,
        cardio_id: input.cardioId,
        status: input.status,
        accumulated_ms: Math.max(0, Math.round(input.accumulatedMs)),
        segment_started_at: input.segmentStartedAt,
        updated_at: updatedAt,
      },
      { onConflict: "client_id,scheduled_date,cardio_id" }
    )
    .select(COLUMNS)
    .single();

  if (error) {
    return { error: cardioTimerSetupError(error.message) ?? error.message };
  }
  return { timer: mapRow(data as CardioTimerRow) };
}
