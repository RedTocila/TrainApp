import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import {
  CANONICAL_SITE_HOST,
  LEGACY_VERCEL_HOSTS,
  WWW_SITE_HOST,
} from "@/lib/site-config";

function missingSupabaseEnvResponse() {
  return new NextResponse(
    "RUTINA is missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel project settings, then redeploy.",
    { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}

function redirectToCanonicalHost(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host) return null;

  const shouldRedirect =
    host === WWW_SITE_HOST ||
    (process.env.VERCEL_ENV === "production" &&
      (LEGACY_VERCEL_HOSTS as readonly string[]).includes(host));

  if (!shouldRedirect) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = CANONICAL_SITE_HOST;
  return NextResponse.redirect(url, 308);
}

export async function proxy(request: NextRequest) {
  const canonicalRedirect = redirectToCanonicalHost(request);
  if (canonicalRedirect) return canonicalRedirect;

  if (!getSupabasePublicEnv()) {
    return missingSupabaseEnvResponse();
  }

  const { supabase, user, supabaseResponse } = await updateSession(request);
  if (!supabase) {
    return missingSupabaseEnvResponse();
  }

  const path = request.nextUrl.pathname;

  const isAuthPage = path === "/login" || path === "/register";
  const isAdminRoute = path.startsWith("/admin");
  const isDashboardRoute = path.startsWith("/dashboard");

  if (!user && (isAuthPage || path === "/")) {
    return supabaseResponse;
  }

  if (!user && (isAdminRoute || isDashboardRoute)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (isAuthPage) {
      const dest = profile?.role === "admin" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(dest, request.url));
    }

    if (isAdminRoute && profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (isDashboardRoute && profile?.role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (path === "/") {
      const dest = profile?.role === "admin" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!sentry-tunnel|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
