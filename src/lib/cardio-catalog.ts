import {
  Activity,
  ArrowUp,
  Bike,
  CircleDot,
  Dumbbell,
  Flame,
  Footprints,
  Hand,
  Mountain,
  Music,
  PersonStanding,
  Ship,
  Snowflake,
  Swords,
  Target,
  Trees,
  Trophy,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type CardioLocation = "gym" | "outdoor" | "everywhere";

export interface CardioType {
  id: string;
  location: CardioLocation;
  icon: LucideIcon;
  defaultDuration?: number;
}

export const CARDIO_LOCATIONS: CardioLocation[] = ["gym", "outdoor", "everywhere"];

export const CARDIO_CATALOG: CardioType[] = [
  // Gym
  { id: "treadmill", location: "gym", icon: Footprints, defaultDuration: 30 },
  { id: "incline_walk", location: "gym", icon: ArrowUp, defaultDuration: 30 },
  { id: "elliptical", location: "gym", icon: Activity, defaultDuration: 30 },
  { id: "stationary_bike", location: "gym", icon: Bike, defaultDuration: 30 },
  { id: "spin_bike", location: "gym", icon: Bike, defaultDuration: 45 },
  { id: "rowing_machine", location: "gym", icon: Waves, defaultDuration: 20 },
  { id: "stair_climber", location: "gym", icon: ArrowUp, defaultDuration: 20 },
  { id: "assault_bike", location: "gym", icon: Flame, defaultDuration: 15 },
  { id: "ski_erg", location: "gym", icon: Snowflake, defaultDuration: 20 },
  { id: "arc_trainer", location: "gym", icon: Activity, defaultDuration: 30 },
  { id: "battle_ropes", location: "gym", icon: Waves, defaultDuration: 15 },
  { id: "sled_push", location: "gym", icon: Dumbbell, defaultDuration: 20 },

  // Outdoor
  { id: "running", location: "outdoor", icon: PersonStanding, defaultDuration: 30 },
  { id: "trail_running", location: "outdoor", icon: Mountain, defaultDuration: 45 },
  { id: "outdoor_cycling", location: "outdoor", icon: Bike, defaultDuration: 45 },
  { id: "hiking", location: "outdoor", icon: Trees, defaultDuration: 60 },
  { id: "brisk_walking", location: "outdoor", icon: Footprints, defaultDuration: 30 },
  { id: "swimming", location: "outdoor", icon: Waves, defaultDuration: 30 },
  { id: "open_water_swim", location: "outdoor", icon: Waves, defaultDuration: 30 },
  { id: "rollerblading", location: "outdoor", icon: Wind, defaultDuration: 30 },
  { id: "kayaking", location: "outdoor", icon: Ship, defaultDuration: 45 },
  { id: "rock_climbing", location: "outdoor", icon: Mountain, defaultDuration: 60 },
  { id: "cross_country_ski", location: "outdoor", icon: Snowflake, defaultDuration: 45 },
  { id: "soccer", location: "outdoor", icon: Trophy, defaultDuration: 60 },
  { id: "basketball", location: "outdoor", icon: Target, defaultDuration: 45 },
  { id: "tennis", location: "outdoor", icon: Target, defaultDuration: 60 },

  // Everywhere
  { id: "walking", location: "everywhere", icon: Footprints, defaultDuration: 30 },
  { id: "jump_rope", location: "everywhere", icon: CircleDot, defaultDuration: 15 },
  { id: "hiit", location: "everywhere", icon: Zap, defaultDuration: 20 },
  { id: "dancing", location: "everywhere", icon: Music, defaultDuration: 30 },
  { id: "jumping_jacks", location: "everywhere", icon: PersonStanding, defaultDuration: 15 },
  { id: "burpees", location: "everywhere", icon: Flame, defaultDuration: 15 },
  { id: "shadow_boxing", location: "everywhere", icon: Hand, defaultDuration: 20 },
  { id: "stair_climbing", location: "everywhere", icon: ArrowUp, defaultDuration: 15 },
  { id: "mountain_climbers", location: "everywhere", icon: Mountain, defaultDuration: 15 },
  { id: "high_knees", location: "everywhere", icon: Activity, defaultDuration: 15 },
  { id: "bodyweight_circuit", location: "everywhere", icon: Dumbbell, defaultDuration: 20 },
  { id: "boxing", location: "everywhere", icon: Swords, defaultDuration: 30 },
  { id: "aerobics", location: "everywhere", icon: Music, defaultDuration: 30 },
  { id: "yoga_flow", location: "everywhere", icon: PersonStanding, defaultDuration: 30 },
  { id: "pilates", location: "everywhere", icon: Activity, defaultDuration: 30 },
];

export function getCardioByLocation(location: CardioLocation): CardioType[] {
  return CARDIO_CATALOG.filter((item) => item.location === location);
}

export function getCardioType(id: string): CardioType | undefined {
  return CARDIO_CATALOG.find((item) => item.id === id);
}

const CARDIO_LOCATION_STYLES: Record<
  CardioLocation,
  { accentClass: string; bgClass: string }
> = {
  gym: { accentClass: "text-blue-400", bgClass: "bg-blue-500/10" },
  outdoor: { accentClass: "text-green-400", bgClass: "bg-green-500/10" },
  everywhere: { accentClass: "text-violet-400", bgClass: "bg-violet-500/10" },
};

/** Match saved cardio title to catalog preset (e.g. from type picker). */
export function resolveCardioTypeFromTitle(
  title: string,
  typeLabels: Record<string, string>
): CardioType | undefined {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return undefined;

  for (const type of CARDIO_CATALOG) {
    const label = typeLabels[type.id];
    if (label && label.trim().toLowerCase() === normalized) {
      return type;
    }
  }

  for (const type of CARDIO_CATALOG) {
    const label = typeLabels[type.id];
    if (label && normalized.includes(label.trim().toLowerCase())) {
      return type;
    }
  }

  return undefined;
}

export function getCardioTypeDisplay(
  title: string,
  typeLabels: Record<string, string>
) {
  const type = resolveCardioTypeFromTitle(title, typeLabels);
  if (!type) return null;

  return {
    type,
    icon: type.icon,
    ...CARDIO_LOCATION_STYLES[type.location],
  };
}
