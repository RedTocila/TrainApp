import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { challengeRoomName } from "@/lib/challenge-utils";
import {
  getLivekitApiKey,
  getLivekitApiSecret,
  isLivekitConfigured,
} from "@/lib/livekit-config";
import { hasAiAccess } from "@/lib/subscription";

export async function POST(request: Request) {
  if (!isLivekitConfigured()) {
    return NextResponse.json({ error: "LiveKit is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, subscription_plan, subscription_status, subscription_expires_at")
    .eq("id", user.id)
    .single();

  if (!profile || !hasAiAccess(profile)) {
    return NextResponse.json({ error: "AI subscription required" }, { status: 403 });
  }

  let body: { challengeSlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const challengeSlug = body.challengeSlug?.trim();
  if (!challengeSlug) {
    return NextResponse.json({ error: "challengeSlug is required" }, { status: 400 });
  }

  const { data: challenge, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("slug", challengeSlug)
    .eq("published", true)
    .maybeSingle();

  if (error || !challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  const room = challengeRoomName(challenge);
  const isAdmin = profile.role === "admin";

  const token = new AccessToken(getLivekitApiKey()!, getLivekitApiSecret()!, {
    identity: user.id,
    name: profile.full_name?.trim() || "Member",
    ttl: "6h",
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: isAdmin,
  });

  const jwt = await token.toJwt();

  return NextResponse.json({ token, roomName: room });
}
