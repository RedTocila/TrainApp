"use client";

import { usePathname } from "next/navigation";
import { BuildWorkoutButton } from "@/components/build-workout-button";
import { ProgramsPageHeader } from "@/components/programs/programs-page-header";
import { ProgramsExercisesToggle } from "@/components/programs-exercises-toggle";

export function WorkoutPageHeader({ title }: { title: string }) {
  const pathname = usePathname();
  const showHubToggle =
    pathname === "/dashboard/workout" ||
    pathname.startsWith("/dashboard/workout/exercises") ||
    pathname.startsWith("/dashboard/workout/folder") ||
    pathname.startsWith("/dashboard/workout/workouts") ||
    pathname.startsWith("/dashboard/workout/plans") ||
    (pathname.startsWith("/dashboard/workout/cardio") &&
      !pathname.startsWith("/dashboard/workout/cardio/session"));

  return (
    <ProgramsPageHeader
      title={title}
      tabs={showHubToggle ? <ProgramsExercisesToggle /> : null}
      actions={<BuildWorkoutButton />}
    />
  );
}
