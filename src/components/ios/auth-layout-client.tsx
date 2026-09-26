"use client";

import { Suspense, type ReactNode } from "react";
import { AuthLayoutClient } from "@/components/ios/ios-funnel-shell";
import { RouteEnter } from "@/components/route-enter";

export function AuthLayoutFrame({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh justify-center px-4 py-8 sm:py-10">
          <div className="my-auto w-full max-w-md">
            <RouteEnter>{children}</RouteEnter>
          </div>
        </div>
      }
    >
      <AuthLayoutClient>{children}</AuthLayoutClient>
    </Suspense>
  );
}
