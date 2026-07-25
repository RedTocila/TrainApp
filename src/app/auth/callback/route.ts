import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

function safeNextPath(next: string | null): string {
  const fallback = "/dashboard";
  if (!next || !next.startsWith("/")) return fallback;
  return next;
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

  // Already signed in (e.g. unlocked at signup, then tapped email later).
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  if (existingUser) {
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
  }

  // Expired / already-used / pre-confirmed signup link — password sign-in still works.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
