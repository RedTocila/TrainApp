import { Capacitor, registerPlugin } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";

type WatchSessionPlugin = {
  sync(options: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    apiBase: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
  }): Promise<void>;
  clear(): Promise<void>;
};

const WatchSession = registerPlugin<WatchSessionPlugin>("WatchSession");

/** Copy the signed-in Supabase session to the Apple Watch. iOS shell only. */
export async function syncWatchSession(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;

  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.access_token || !session.refresh_token) {
    await WatchSession.clear().catch(() => undefined);
    return;
  }

  await WatchSession.sync({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? 0,
    apiBase: window.location.origin,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  }).catch(() => undefined);
}
