"use client";

import { Video } from "lucide-react";
import { ClassesCatalog } from "@/components/classes-catalog";
import { usePlatformCopy } from "@/components/locale-provider";
import type { FitnessClass } from "@/lib/types";

export function LiveHubPage({
  classes,
  requiresUpgrade = false,
}: {
  classes: FitnessClass[];
  requiresUpgrade?: boolean;
}) {
  const platform = usePlatformCopy();

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
      <header className="flex items-center gap-2">
        <Video className="h-5 w-5 text-primary" aria-hidden />
        <h1 className="text-lg font-black leading-none">{platform.nav.liveCoaching}</h1>
      </header>
      <ClassesCatalog classes={classes} requiresUpgrade={requiresUpgrade} />
    </div>
  );
}
