"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isNativeApp } from "@/lib/native-app";

/**
 * Renders `native` only inside the Capacitor shell after mount.
 * Web always gets `web` (or children) — no hydration mismatch.
 */
export function NativeOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativeApp());
  }, []);
  return <>{native ? children : fallback}</>;
}

/** Inverse of NativeOnly — hide on native after mount; show on web always. */
export function WebOnly({ children }: { children: ReactNode }) {
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativeApp());
  }, []);
  if (native) return null;
  return <>{children}</>;
}
