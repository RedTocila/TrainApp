"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsNativeApp } from "@/components/ios/use-native-app";
import { appLoginUrl } from "@/lib/website-signup";

export function OpenAppPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nativeApp = useIsNativeApp();
  const email = searchParams.get("email")?.trim() ?? "";

  useEffect(() => {
    if (!nativeApp) return;
    const params = new URLSearchParams({ from: "ios", next: "/dashboard" });
    if (email) params.set("email", email);
    router.replace(`/login?${params.toString()}`);
  }, [nativeApp, email, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border-border/80 bg-background/95 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Smartphone className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-black">Open RUTINA</CardTitle>
          <CardDescription>
            {email
              ? `Sign in to the app with ${email}, or keep using the browser.`
              : "Sign in to the app with the account you just created, or keep using the browser."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            type="button"
            className="w-full"
            onClick={() => window.location.assign(appLoginUrl(email))}
          >
            Open in the app
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => router.push("/dashboard")}
          >
            Continue in the browser
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
