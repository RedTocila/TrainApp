"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isNativeApp } from "@/lib/native-app";
import { IOS_WELCOME_PATH } from "@/lib/ios-routes";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

export function AuthBackButton({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  const nativeApp = useSyncExternalStore(subscribe, isNativeApp, () => false);
  // The app has no marketing landing — its home is the welcome screen.
  const target = nativeApp && href === "/" ? IOS_WELCOME_PATH : href;

  return (
    <Link
      href={target}
      aria-label="Back"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
    </Link>
  );
}
