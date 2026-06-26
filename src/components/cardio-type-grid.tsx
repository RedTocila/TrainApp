"use client";

import { useState } from "react";
import { Building2, MapPin, Globe } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  CARDIO_LOCATIONS,
  getCardioByLocation,
  type CardioLocation,
  type CardioType,
} from "@/lib/cardio-catalog";
import { cn } from "@/lib/utils";

const LOCATION_META: Record<
  CardioLocation,
  { icon: typeof Building2; accentClass: string; bgClass: string }
> = {
  gym: {
    icon: Building2,
    accentClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
  },
  outdoor: {
    icon: MapPin,
    accentClass: "text-green-400",
    bgClass: "bg-green-500/10",
  },
  everywhere: {
    icon: Globe,
    accentClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
  },
};

function locationLabel(
  location: CardioLocation,
  platform: ReturnType<typeof usePlatformCopy>
) {
  switch (location) {
    case "gym":
      return platform.cardio.locationGym;
    case "outdoor":
      return platform.cardio.locationOutdoor;
    case "everywhere":
      return platform.cardio.locationEverywhere;
  }
}

function typeLabel(id: string, platform: ReturnType<typeof usePlatformCopy>) {
  return platform.cardio.types[id as keyof typeof platform.cardio.types] ?? id;
}

export function CardioTypeGrid({ onSelect }: { onSelect: (type: CardioType) => void }) {
  const platform = usePlatformCopy();
  const [activeLocation, setActiveLocation] = useState<CardioLocation>("gym");
  const types = getCardioByLocation(activeLocation);
  const meta = LOCATION_META[activeLocation];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {platform.cardio.browseTitle}
      </h2>

      <div className="flex flex-wrap gap-2">
        {CARDIO_LOCATIONS.map((location) => {
          const LocIcon = LOCATION_META[location].icon;
          const active = activeLocation === location;
          return (
            <button
              key={location}
              type="button"
              onClick={() => setActiveLocation(location)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary/40"
              )}
            >
              <LocIcon className="h-3.5 w-3.5" />
              {locationLabel(location, platform)}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {types.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onSelect(type)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-center transition-colors hover:border-orange-500/40 hover:bg-orange-500/[0.06]"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  meta.bgClass
                )}
              >
                <Icon className={cn("h-5 w-5", meta.accentClass)} />
              </div>
              <span className="text-[10px] font-semibold leading-tight">
                {typeLabel(type.id, platform)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
