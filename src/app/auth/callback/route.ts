import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

/** Only same-origin relative paths — block protocol-relative (`//evil`) and schemes. */
function safeNextPath(next: string | null): string {
  const fallback = "/dashboard";
  if (!next || typeof next !== "string") return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (/[\x00-\x1f]/.test(trimmed)) return fallback;
  return trimmed;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeNextPath(searchParams.get("next"));

  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  let successRedirect = NextResponse.redirect(`${origin}${nextPath}`);

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          successRedirect.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  // Recovery / invite / email-change must still apply even if a session exists
  // (wrong account signed in, or password-reset link after login).
  const mustProcessToken =
    Boolean(tokenHash && type) ||
    Boolean(code) ||
    type === "recovery" ||
    type === "invite" ||
    type === "email_change";

  if (existingUser && !mustProcessToken) {
    return successRedirect;
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return successRedirect;
    }
    console.error("[auth/callback] verifyOtp failed", error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return successRedirect;
    }
    console.error("[auth/callback] exchangeCodeForSession failed", error.message);
  } else if (existingUser) {
    return successRedirect;
  }

  // Expired / already-used / pre-confirmed signup link — password sign-in still works.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
