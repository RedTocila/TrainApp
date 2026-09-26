"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native-app";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Native-only home greeting. Hidden on web so the existing dashboard is unchanged. */
export function NativeHomeGreeting({ fullName }: { fullName: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    const first = fullName.trim().split(/\s+/)[0] || "Athlete";
    setLabel(`${greetingForHour(new Date().getHours())}, ${first}`);
  }, [fullName]);

  if (!label) return null;

  return (
    <div className="px-1 pb-1 pt-1 sm:px-0">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        Today
      </p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">
        {label}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Here&apos;s what you should do today.
      </p>
    </div>
  );
}
