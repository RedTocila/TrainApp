import { Flame, Leaf, Skull, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PersonalWorkoutDifficultyId } from "@/lib/workout-difficulty";

export const DIFFICULTY_ICONS: Record<PersonalWorkoutDifficultyId, LucideIcon> = {
  easy: Leaf,
  intermediate: Target,
  hard: Flame,
  impossible: Skull,
};

export const DIFFICULTY_BUTTON_STYLES: Record<
  PersonalWorkoutDifficultyId,
  { ring: string; icon: string }
> = {
  easy: {
    ring: "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15",
    icon: "text-emerald-400",
  },
  intermediate: {
    ring: "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/15",
    icon: "text-sky-400",
  },
  hard: {
    ring: "border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15",
    icon: "text-orange-400",
  },
  impossible: {
    ring: "border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15",
    icon: "text-fuchsia-400",
  },
};

export const DIFFICULTY_PANEL_STYLES: Record<
  PersonalWorkoutDifficultyId,
  { panel: string; icon: string; label: string }
> = {
  easy: {
    panel: "border-emerald-500/25 bg-emerald-500/8",
    icon: "text-emerald-400",
    label: "text-emerald-300",
  },
  intermediate: {
    panel: "border-sky-500/25 bg-sky-500/8",
    icon: "text-sky-400",
    label: "text-sky-300",
  },
  hard: {
    panel: "border-orange-500/30 bg-orange-500/8",
    icon: "text-orange-400",
    label: "text-orange-300",
  },
  impossible: {
    panel: "border-fuchsia-500/35 bg-fuchsia-500/10",
    icon: "text-fuchsia-400",
    label: "text-fuchsia-300",
  },
};
